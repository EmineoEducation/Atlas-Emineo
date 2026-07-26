// ============================================================
// api/fr.js — Poste de travail Formateur Référent
// ------------------------------------------------------------
// GET  ?formation_id=&periode=&annee_scolaire=
//      -> prevu / realise / ecarts (3 etats) / digest de la periode
// GET  ?action=cron-digest
//      -> declenche par Vercel Cron (1er lundi du mois, cf vercel.json).
//         Auth: header Authorization: Bearer <CRON_SECRET> (auto Vercel).
//         Genere (sans envoyer) le digest de tous les titres ayant un FR.
// POST ?action=generate      { formation_id, campus, annee_scolaire? }
//      -> (re)genere le digest du mois en cours pour ce titre. Role: dir, fr.
// POST ?action=valider-envoyer  { digest_id, note_fr? }
//      -> le FR relit, ajuste eventuellement la note de coordination,
//         et envoie via Resend en un seul clic. Role: fr (titulaire du titre), dir.
//
// Principe : tout ce qui est chiffre (kpis, % par bloc, tableau des
// intervenants, sequences a venir) est calcule en JS a partir de la base —
// jamais par Claude. Claude ne redige que le titre et une suggestion de note
// de coordination, a partir des faits deja calcules (pas d'invention de
// chiffres). Cf. atlas-ecarts-roadmap-v2-le-mans.md, phase "Stack technique".
// ============================================================

const { getDB } = require('./_lib/db');
const { requireAuth, requireRole } = require('./_lib/auth');

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 2000;

// ── Dates ──────────────────────────────────────────────────────────────────
// Bornes du mois (UTC) contenant `ref`. Remplace bornesSemaine() : la cadence
// est passee d'hebdomadaire a mensuelle (1er lundi du mois, cf PPT v2.0).
function bornesMois(ref) {
  const d = new Date(ref);
  const debut = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
  const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { debut: debut.toISOString(), fin: fin.toISOString() };
}

function bornesMoisSuivant(ref) {
  const d = new Date(ref);
  const suivant = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return bornesMois(suivant);
}

function labelMois(iso) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch (_) { return iso; }
}

// Est-ce le premier lundi du mois (heure UTC) ? Utilise par le cron, qui est
// lui declenche chaque lundi (Vercel Hobby ne sait pas faire "1er lundi du
// mois" directement — cf vercel.json + note dans la roadmap).
function estPremierLundiDuMois(d) {
  return d.getUTCDay() === 1 && d.getUTCDate() <= 7;
}

function parseJSON(val, fallback) {
  if (val == null) return fallback;
  try { return JSON.parse(val); } catch (_) { return fallback; }
}

// Normalise un code competence pour comparaison tolerante entre formats
// heterogenes ("C.1", "C1", "BC11" ...) rencontres selon les titres.
function normCode(c) {
  return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ── Calcul deterministe (jamais par Claude) ────────────────────────────────

// % de couverture par bloc RNCP, a partir de TOUTES les declarations connues
// a date (cumulatif depuis le debut de l'annee, pas seulement la periode).
function calculerAvancementBlocs(blocs, declarationsCumul) {
  const codesDeclares = new Set();
  declarationsCumul.forEach(d => {
    (d.competences || []).forEach(c => codesDeclares.add(normCode(c)));
  });
  return (blocs || []).map(b => {
    const comps = b.competences || [];
    if (!comps.length) return { id: b.id, titre: b.titre, pct: null };
    const couvertes = comps.filter(c => codesDeclares.has(normCode(c.id))).length;
    return { id: b.id, titre: b.titre, pct: Math.round((couvertes / comps.length) * 100) };
  });
}

// Tableau "qui a enseigne quoi" sur la periode — donnees factuelles, pas de
// synthese Claude ici.
function calculerQuiAEnseigne(declarationsPeriode, previsionnelParId) {
  return declarationsPeriode.map(d => {
    const prev = previsionnelParId[d.previsionnel_id] || null;
    return {
      module: d.module_ref || (prev && prev.titre) || 'Module',
      intervenant: d.intervenant_nom || (prev && prev.intervenant_nom) || '—',
      modalite: prev ? prev.modalite : '',
      competences: d.competences || [],
    };
  });
}

// Detection simple de coordination : meme competence couverte par au moins
// 2 intervenants distincts sur la periode -> signal factuel, jamais nominatif
// negatif.
function detecterCoordination(declarationsPeriode) {
  const parCompetence = {};
  declarationsPeriode.forEach(d => {
    (d.competences || []).forEach(c => {
      const k = normCode(c);
      if (!parCompetence[k]) parCompetence[k] = { competence: c, intervenants: new Set() };
      parCompetence[k].intervenants.add(d.intervenant_nom || '—');
    });
  });
  return Object.values(parCompetence)
    .filter(v => v.intervenants.size > 1)
    .map(v => ({
      titre: `${v.competence} — coordination`,
      detail: `Couverte par ${Array.from(v.intervenants).join(', ')} sur la periode.`,
    }));
}

// Delta 3 etats entre previsionnel et declaration (cf slide "comparateur").
// Heuristique volontairement simple en V1, documentee comme telle :
//  - pas de declaration correspondante -> ALERTE
//  - concepts couverts > concepts annonces -> ECART+ (contenu supplementaire)
//  - sinon -> NOMINAL
function calculerDelta(prevRows, declParPrevId) {
  return prevRows.map(p => {
    const d = declParPrevId[p.id];
    if (!d) {
      return { previsionnel_id: p.id, module_ref: p.module_ref, intervenant_nom: p.intervenant_nom,
        numero: p.numero, titre: p.titre, date_prevue: p.date_prevue, etat: 'alerte',
        detail: 'Aucune declaration recue pour cette seance.' };
    }
    const attendu = (p.concepts || []).length;
    const couvert = (d.couvert || []).length;
    const etat = couvert > attendu ? 'ecart_plus' : 'nominal';
    return { previsionnel_id: p.id, module_ref: p.module_ref, intervenant_nom: p.intervenant_nom,
      numero: p.numero, titre: p.titre, date_prevue: p.date_prevue, etat,
      detail: etat === 'ecart_plus'
        ? `${couvert} concept(s) couvert(s) pour ${attendu} annonce(s) — contenu supplementaire detecte.`
        : 'Conforme au previsionnel.' };
  });
}

// Destinataires du digest : intervenants inscrits sur ce titre.
async function getDestinataires(db, formationId, anneeScolaire) {
  const r = await db.execute({
    sql: `SELECT DISTINCT u.email, u.nom, u.prenom
          FROM inscription i JOIN users u ON u.id = i.user_id
          WHERE i.formation_id = ? AND i.role = 'intervenant' AND i.annee_scolaire = ?
            AND u.email IS NOT NULL AND u.email != ''`,
    args: [formationId, anneeScolaire],
  });
  return r.rows.map(row => ({ email: row.email, nom: `${row.prenom || ''} ${row.nom || ''}`.trim() }));
}

// ── Appel Claude : uniquement le titre + une suggestion de note FR ─────────
async function suggererTitreEtNote(apiKey, faits) {
  const schema = {
    type: 'object',
    properties: {
      titre: { type: 'string' },
      note_fr_suggestion: { type: 'string' },
    },
    required: ['titre', 'note_fr_suggestion'],
    additionalProperties: false,
  };

  const prompt =
    'Tu rediges 2 elements courts pour un digest mensuel envoye a des intervenants d\'un titre RNCP. ' +
    'Utilise UNIQUEMENT les faits fournis ci-dessous — n\'invente aucun chiffre, aucun nom absent des faits.\n\n' +
    'FAITS :\n' + JSON.stringify(faits, null, 2) + '\n\n' +
    'titre : 4-8 mots, ton factuel, ex "Ce que la promo a traverse en <mois>".\n' +
    'note_fr_suggestion : 1-2 phrases, ton positif et factuel (jamais culpabilisant), ' +
    'signalant si besoin un point de coordination a venir entre 2 intervenants nommes dans les faits. ' +
    'Si aucun point de coordination notable, propose une phrase neutre de synthese. ' +
    'Cette note sera relue et modifiable par le Formateur Referent avant envoi.';

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: { type: 'json_schema', schema } },
    }),
  });
  const raw = await r.json();
  if (!r.ok) throw new Error((raw && raw.error && raw.error.message) || ('Claude HTTP ' + r.status));
  const text = (raw.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try { return JSON.parse(text); }
  catch (_) { return { titre: `Digest — ${labelMois(new Date().toISOString())}`, note_fr_suggestion: '' }; }
}

// ── Generation complete du contenu d'un digest pour un titre + periode ────
async function genererContenuDigest(db, apiKey, formationId, campus, anneeScolaire, periodeRef) {
  const { debut, fin } = bornesMois(periodeRef);
  const { debut: debutSuivant, fin: finSuivant } = bornesMoisSuivant(periodeRef);

  const formationRow = await db.execute({ sql: 'SELECT titre, data_json FROM formations WHERE id = ?', args: [formationId] });
  if (!formationRow.rows.length) throw new Error('Formation introuvable.');
  const formationData = parseJSON(formationRow.rows[0].data_json, {});
  const blocs = formationData.blocs || [];
  const titreFormation = formationRow.rows[0].titre || formationData.formation && formationData.formation.titre || 'Formation';

  const [prevPeriode, declPeriode, declCumul, prevSuivant] = await Promise.all([
    db.execute({ sql: `SELECT id, module_ref, titre, intervenant_nom, numero, date_prevue, modalite, concepts
                        FROM previsionnel_seance WHERE formation_id=? AND annee_scolaire=? AND date_prevue>=? AND date_prevue<=?`,
      args: [formationId, anneeScolaire, debut, fin] }),
    db.execute({ sql: `SELECT id, previsionnel_id, module_ref, intervenant_nom, couvert, competences
                        FROM declaration WHERE formation_id=? AND annee_scolaire=? AND date_seance>=? AND date_seance<=?`,
      args: [formationId, anneeScolaire, debut, fin] }),
    db.execute({ sql: `SELECT competences FROM declaration WHERE formation_id=? AND annee_scolaire=?`,
      args: [formationId, anneeScolaire] }),
    db.execute({ sql: `SELECT module_ref, titre, intervenant_nom, date_prevue, concepts
                        FROM previsionnel_seance WHERE formation_id=? AND annee_scolaire=? AND date_prevue>=? AND date_prevue<=?
                        ORDER BY date_prevue ASC LIMIT 8`,
      args: [formationId, anneeScolaire, debutSuivant, finSuivant] }),
  ]);

  const declarationsPeriode = declPeriode.rows.map(r => ({ ...r, couvert: parseJSON(r.couvert, []), competences: parseJSON(r.competences, []) }));
  const declarationsCumul = declCumul.rows.map(r => ({ competences: parseJSON(r.competences, []) }));
  const previsionnelParId = {};
  prevPeriode.rows.forEach(p => { previsionnelParId[p.id] = { ...p, concepts: parseJSON(p.concepts, []) }; });

  const avancementBlocs = calculerAvancementBlocs(blocs, declarationsCumul);
  const quiAEnseigne = calculerQuiAEnseigne(declarationsPeriode, previsionnelParId);
  const coordination = detecterCoordination(declarationsPeriode);
  const sequencesAVenir = prevSuivant.rows.map(p => ({
    date: p.date_prevue, module: p.titre || p.module_ref, intervenant: p.intervenant_nom,
    competences: parseJSON(p.concepts, []),
  }));

  const kpis = {
    intervenants: new Set(declarationsPeriode.map(d => d.intervenant_nom).filter(Boolean)).size,
    seances: declarationsPeriode.length,
    coordination: coordination.length,
  };

  let redaction = { titre: `Digest — ${labelMois(debut)}`, note_fr_suggestion: '' };
  if (apiKey) {
    try {
      redaction = await suggererTitreEtNote(apiKey, {
        titre_formation: titreFormation, mois: labelMois(debut), kpis, coordination, avancement_blocs: avancementBlocs,
      });
    } catch (_) { /* on garde le fallback deterministe si Claude echoue */ }
  }

  const destinataires = await getDestinataires(db, formationId, anneeScolaire);

  return {
    contenu: {
      titre: redaction.titre,
      periode: { debut, fin, label: labelMois(debut) },
      kpis,
      avancement_blocs: avancementBlocs,
      qui_a_enseigne: quiAEnseigne,
      coordination,
      note_fr_suggestion: redaction.note_fr_suggestion,
      note_fr: redaction.note_fr_suggestion,
      sequences_a_venir: sequencesAVenir,
    },
    destinataires,
    debut,
    fin,
  };
}

async function upsertDigest(db, { formationId, campus, anneeScolaire, debut, fin, contenu, destinataires }) {
  const existing = await db.execute({
    sql: `SELECT id, statut FROM digest_fr WHERE formation_id=? AND campus=? AND semaine_debut=?`,
    args: [formationId, campus, debut],
  });
  if (existing.rows.length) {
    const row = existing.rows[0];
    if (row.statut === 'envoye') {
      return { id: row.id, statut: 'envoye', regenere: false };
    }
    await db.execute({
      sql: `UPDATE digest_fr SET contenu_genere=?, destinataires=?, statut='genere' WHERE id=?`,
      args: [JSON.stringify(contenu), JSON.stringify(destinataires), row.id],
    });
    return { id: row.id, statut: 'genere', regenere: true };
  }
  const ins = await db.execute({
    sql: `INSERT INTO digest_fr (formation_id, campus, semaine_debut, semaine_fin, contenu_genere, statut, destinataires, annee_scolaire)
          VALUES (?,?,?,?,?,'genere',?,?)`,
    args: [formationId, campus, debut, fin, JSON.stringify(contenu), JSON.stringify(destinataires), anneeScolaire],
  });
  return { id: Number(ins.lastInsertRowid), statut: 'genere', regenere: false };
}

// ── Envoi Resend ───────────────────────────────────────────────────────────
function renderDigestHTML(c, titreFormation, campus, frNom) {
  const pill = (t) => `<span style="background:#E1F5EE;color:#085041;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;margin-right:4px;display:inline-block">${t}</span>`;
  const blocsRows = (c.avancement_blocs || []).map(b =>
    `<tr><td style="padding:4px 8px;font-size:12px;color:#fff">${b.id} — ${b.titre}</td><td style="padding:4px 8px;font-size:12px;color:#5DE298;text-align:right">${b.pct == null ? '—' : b.pct + '%'}</td></tr>`
  ).join('');
  const quiRows = (c.qui_a_enseigne || []).map(q =>
    `<tr><td style="padding:6px 8px;font-size:12px;color:#0B2B2D">${q.module}</td><td style="padding:6px 8px;font-size:12px;color:#0B2B2D">${q.intervenant}</td><td style="padding:6px 8px;font-size:12px">${(q.competences||[]).map(pill).join('')}</td></tr>`
  ).join('');
  const sequences = (c.sequences_a_venir || []).map(s =>
    `<li style="font-size:12px;color:#134547;margin-bottom:4px">${s.date || ''} — ${s.module} (${s.intervenant})</li>`
  ).join('');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto">
    <div style="background:#134547;padding:14px 24px;color:#5DE298;font-size:16px;font-weight:700">Atlas · Éminéo</div>
    <div style="background:#0B2B2D;padding:28px 24px">
      <div style="color:#5DE298;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Synthèse · Formateur Référent ${frNom || ''}</div>
      <div style="color:#fff;font-size:22px;font-weight:700;margin-bottom:8px">${c.titre || ''}</div>
      <div style="color:rgba(255,255,255,.55);font-size:12px">${titreFormation}${campus ? ' · ' + campus : ''} · ${c.periode ? c.periode.label : ''}</div>
    </div>
    <div style="padding:20px 24px;border-bottom:1px solid #E3FFF0">
      <div style="font-size:11px;color:#888;text-transform:uppercase;margin-bottom:8px">Avancement RNCP par bloc</div>
      <table style="width:100%;border-collapse:collapse"><tbody>${blocsRows}</tbody></table>
    </div>
    <div style="padding:20px 24px;border-bottom:1px solid #E3FFF0">
      <div style="font-size:11px;color:#888;text-transform:uppercase;margin-bottom:8px">Qui a enseigné quoi ce mois-ci</div>
      <table style="width:100%;border-collapse:collapse"><tbody>${quiRows}</tbody></table>
    </div>
    ${c.note_fr ? `<div style="padding:16px 24px;background:#FAEEDA;margin:16px 24px;border-radius:8px">
      <div style="font-size:10px;color:#633806;text-transform:uppercase;margin-bottom:4px">Note de coordination — ${frNom || 'FR'}</div>
      <div style="font-size:12px;color:#633806">${c.note_fr}</div>
    </div>` : ''}
    ${sequences ? `<div style="padding:20px 24px"><div style="font-size:11px;color:#888;text-transform:uppercase;margin-bottom:8px">Ce qui arrive le mois prochain</div><ul style="margin:0;padding-left:18px">${sequences}</ul></div>` : ''}
    <div style="padding:16px 24px;background:#134547;color:rgba(255,255,255,.5);font-size:11px">Répondre à cet email = contacter ${frNom || 'le Formateur Référent'} directement.</div>
  </div>`;
}

async function envoyerResend(apiKey, { to, subject, html }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: 'Atlas <atlas@emineo-education.fr>', to, subject, html }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data && data.message) || ('Resend HTTP ' + r.status));
  return data;
}

// ============================================================
// HANDLER
// ============================================================
module.exports = async function handler(req, res) {
  const action = (req.query && req.query.action) || '';

  try {
    const db = getDB();

    // ── Cron mensuel (Vercel Cron → header Authorization: Bearer CRON_SECRET) ──
    if (req.method === 'GET' && action === 'cron-digest') {
      const auth = req.headers.authorization || '';
      const secret = process.env.CRON_SECRET || '';
      if (!secret || auth !== `Bearer ${secret}`) {
        return res.status(401).json({ error: 'Non autorisé.' });
      }
      const now = new Date();
      if (!estPremierLundiDuMois(now)) {
        return res.status(200).json({ ok: true, skip: 'Pas le premier lundi du mois.' });
      }
      const apiKey = process.env.ANTHROPIC_API_KEY;
      const titres = await db.execute({
        sql: `SELECT DISTINCT i.formation_id, i.campus FROM inscription i WHERE i.role = 'fr'`,
      });
      const resultats = [];
      for (const t of titres.rows) {
        try {
          const { contenu, destinataires, debut, fin } = await genererContenuDigest(
            db, apiKey, t.formation_id, t.campus, '2026-27', now.toISOString()
          );
          const up = await upsertDigest(db, {
            formationId: t.formation_id, campus: t.campus, anneeScolaire: '2026-27',
            debut, fin, contenu, destinataires,
          });
          resultats.push({ formation_id: t.formation_id, ...up });
        } catch (e) {
          resultats.push({ formation_id: t.formation_id, error: e.message });
        }
      }
      return res.status(200).json({ ok: true, generes: resultats.length, resultats });
    }

    // ── POST ?action=generate — (re)génère le digest du mois en cours ──────
    if (req.method === 'POST' && action === 'generate') {
      const user = await requireRole(req, ['dir', 'fr']);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });
      const { formation_id, campus, annee_scolaire, periode } = req.body || {};
      if (!formation_id || !campus) return res.status(400).json({ error: 'formation_id et campus requis.' });

      if (user.role === 'fr') {
        const insc = await db.execute({
          sql: "SELECT 1 FROM inscription WHERE user_id=? AND formation_id=? AND role='fr'",
          args: [user.id, formation_id],
        });
        if (!insc.rows.length) return res.status(403).json({ error: "Ce titre n'est pas dans votre périmètre FR." });
      }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      const annee = annee_scolaire || '2026-27';
      const ref = periode || new Date().toISOString();
      const { contenu, destinataires, debut, fin } = await genererContenuDigest(db, apiKey, formation_id, campus, annee, ref);
      const up = await upsertDigest(db, { formationId: formation_id, campus, anneeScolaire: annee, debut, fin, contenu, destinataires });
      return res.status(200).json({ ok: true, digest_id: up.id, statut: up.statut, contenu_genere: contenu, destinataires });
    }

    // ── POST ?action=valider-envoyer — 1 clic : note FR + envoi Resend ─────
    if (req.method === 'POST' && action === 'valider-envoyer') {
      const user = await requireRole(req, ['dir', 'fr']);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });
      const { digest_id, note_fr } = req.body || {};
      if (!digest_id) return res.status(400).json({ error: 'digest_id requis.' });

      const row = await db.execute({
        sql: `SELECT id, formation_id, campus, contenu_genere, destinataires, statut, annee_scolaire
              FROM digest_fr WHERE id = ?`,
        args: [digest_id],
      });
      if (!row.rows.length) return res.status(404).json({ error: 'Digest introuvable.' });
      const digest = row.rows[0];
      if (digest.statut === 'envoye') return res.status(409).json({ error: 'Ce digest a déjà été envoyé.' });

      if (user.role === 'fr') {
        const insc = await db.execute({
          sql: "SELECT 1 FROM inscription WHERE user_id=? AND formation_id=? AND role='fr'",
          args: [user.id, digest.formation_id],
        });
        if (!insc.rows.length) return res.status(403).json({ error: "Ce titre n'est pas dans votre périmètre FR." });
      }

      const contenu = parseJSON(digest.contenu_genere, {});
      if (typeof note_fr === 'string') contenu.note_fr = note_fr;
      const destinataires = parseJSON(digest.destinataires, []);
      if (!destinataires.length) return res.status(422).json({ error: 'Aucun destinataire (aucun intervenant inscrit sur ce titre).' });

      const formationRow = await db.execute({ sql: 'SELECT titre FROM formations WHERE id = ?', args: [digest.formation_id] });
      const titreFormation = (formationRow.rows[0] && formationRow.rows[0].titre) || '';
      const frNom = `${user.prenom || ''} ${user.nom || ''}`.trim();

      const resendKey = process.env.RESEND_API_KEY;
      let resendId = null;
      if (resendKey) {
        const html = renderDigestHTML(contenu, titreFormation, digest.campus, frNom);
        const sent = await envoyerResend(resendKey, {
          to: destinataires.map(d => d.email),
          subject: contenu.titre || `Atlas — ${titreFormation}`,
          html,
        });
        resendId = sent && sent.id;
      }

      await db.execute({
        sql: `UPDATE digest_fr SET statut='envoye', valide_par=?, valide_at=datetime('now'), envoye_at=datetime('now'), resend_id=?, contenu_genere=? WHERE id=?`,
        args: [user.id, resendId, JSON.stringify(contenu), digest_id],
      });

      return res.status(200).json({ ok: true, statut: 'envoye', resend_id: resendId, destinataires: destinataires.length,
        resend_configure: !!resendKey });
    }

    // ── GET — lecture (prévu / réalisé / écarts 3 états / digest) ──────────
    if (req.method === 'GET') {
      const user = await requireAuth(req);
      if (!user) return res.status(401).json({ error: 'Non authentifié.' });

      const { formation_id, periode, annee_scolaire } = req.query;
      if (!formation_id) return res.status(400).json({ error: 'formation_id requis.' });

      const annee = annee_scolaire || '2026-27';
      const ref = periode || new Date().toISOString();
      const { debut, fin } = bornesMois(ref);
      const mine = user.role === 'intervenant';
      // Un intervenant ne voit que ses propres séances (prévu ET réalisé) ;
      // RP/FR/dir voient tout le titre.
      const scopeSql = mine ? ' AND (intervenant_id = ? OR intervenant_nom = ?)' : '';
      const scopeArgs = mine ? [user.id, `${user.prenom || ''} ${user.nom || ''}`.trim()] : [];

      const prevu = await db.execute({
        sql: `SELECT id, module_ref, campus, intervenant_id, intervenant_nom,
                     numero, titre, date_prevue, modalite, contenu, concepts, competences
              FROM previsionnel_seance
              WHERE formation_id = ? AND annee_scolaire = ?
                AND date_prevue >= ? AND date_prevue <= ?${scopeSql}
              ORDER BY date_prevue ASC`,
        args: [formation_id, annee, debut, fin, ...scopeArgs],
      });

      const realise = await db.execute({
        sql: `SELECT id, module_ref, previsionnel_id, campus, intervenant_id, intervenant_nom,
                     seance_numero, date_seance, source, couvert, competences,
                     compte_rendu, statut_cr, ecart, signal, declared_at
              FROM declaration
              WHERE formation_id = ? AND annee_scolaire = ?
                AND date_seance >= ? AND date_seance <= ?${scopeSql}
              ORDER BY date_seance ASC`,
        args: [formation_id, annee, debut, fin, ...scopeArgs],
      });

      const prevRows = prevu.rows.map(r => ({ ...r, concepts: parseJSON(r.concepts, []), competences: parseJSON(r.competences, []) }));
      const declRows = realise.rows.map(r => ({ ...r, couvert: parseJSON(r.couvert, []), competences: parseJSON(r.competences, []) }));
      const declParPrevId = {};
      declRows.forEach(d => { if (d.previsionnel_id != null) declParPrevId[d.previsionnel_id] = d; });
      const ecarts = calculerDelta(prevRows, declParPrevId);

      // Avancement cumulé par bloc (cartographie RP/FR) — depuis le début de
      // l'année scolaire, pas seulement la période affichée.
      const [formationRow, declCumul] = await Promise.all([
        db.execute({ sql: 'SELECT data_json FROM formations WHERE id = ?', args: [formation_id] }),
        db.execute({
          sql: `SELECT competences FROM declaration WHERE formation_id = ? AND annee_scolaire = ?${scopeSql}`,
          args: [formation_id, annee, ...scopeArgs],
        }),
      ]);
      const blocs = parseJSON(formationRow.rows[0]?.data_json, {}).blocs || [];
      const declarationsCumul = declCumul.rows.map(r => ({ competences: parseJSON(r.competences, []) }));
      const avancementBlocs = calculerAvancementBlocs(blocs, declarationsCumul);

      // Pour l'arborescence intervenant : quelles compétences (parmi les
      // siennes) ont déjà été déclarées couvertes, tous mois confondus.
      let mesCompetencesCouvertes = null;
      if (mine) {
        const set = new Set();
        declarationsCumul.forEach(d => (d.competences || []).forEach(c => set.add(normCode(c))));
        mesCompetencesCouvertes = Array.from(set);
      }

      const digest = await db.execute({
        sql: `SELECT id, semaine_debut, semaine_fin, contenu_genere, statut,
                     valide_at, envoye_at, destinataires, created_at
              FROM digest_fr
              WHERE formation_id = ? AND annee_scolaire = ? AND semaine_debut = ?
              ORDER BY created_at DESC
              LIMIT 1`,
        args: [formation_id, annee, debut],
      });
      const digestRow = digest.rows[0] || null;

      return res.status(200).json({
        periode: { debut, fin, label: labelMois(debut) },
        seances_prevues: prevRows,
        seances_realisees: declRows,
        ecarts,
        avancement_blocs: avancementBlocs,
        mes_competences_couvertes: mesCompetencesCouvertes,
        digest: digestRow
          ? { ...digestRow, contenu_genere: parseJSON(digestRow.contenu_genere, {}), destinataires: parseJSON(digestRow.destinataires, []) }
          : null,
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Méthode ou action non supportée.' });
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
};
