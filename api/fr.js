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

// ── Roles habilites sur le digest ──────────────────────────────────────────
// Corrige le 25/08/2026 (audit Le Mans, bug B01). Le rôle 'rp' etait absent :
// Johnny Nicolas et Etienne Azerad, les deux Responsables Pedagogiques du
// pilote, obtenaient un 403 sur "Generer le digest" et "Valider et envoyer",
// alors que src/App.jsx leur ouvre bien L'Atelier depuis VueRP.
// Le bug etait invisible depuis un compte 'dir', qui lui etait autorise.
const ROLES_DIGEST = ['dir', 'fr', 'rp'];

// Un 'dir' voit tous les titres. Un 'fr' ou un 'rp' doit etre inscrit sur le
// titre — quel que soit le libelle de son inscription ('fr' pour un Formateur
// Referent, 'rp' pour un Responsable Pedagogique, cf api/setup.js).
async function verifierPerimetre(db, user, formationId) {
  if (user.role === 'dir') return { ok: true };
  const insc = await db.execute({
    sql: "SELECT 1 FROM inscription WHERE user_id=? AND formation_id=? AND role IN ('fr','rp')",
    args: [user.id, formationId],
  });
  if (!insc.rows.length) return { ok: false, error: "Ce titre n'est pas dans votre périmètre." };
  return { ok: true };
}

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
      // Le titre de seance est plus lisible que le code module (M12) dans le
      // mail recu par les intervenants — le code ne sert qu'au rattachement
      // au bloc cote cartographie.
      module: (prev && prev.titre) || d.module_ref || 'Module',
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

// Delta 4 etats entre previsionnel et declaration (cf slide "comparateur").
// Heuristique volontairement simple en V1, documentee comme telle :
//  - pas de declaration correspondante        -> ALERTE      (rien n'est remonte)
//  - concepts couverts > concepts annonces    -> ECART+      (contenu supplementaire)
//  - concepts couverts < concepts annonces    -> ECART-      (contenu non traite)
//  - egalite                                  -> NOMINAL
//
// L'etat ECART- a ete ajoute le 25/08/2026 (audit Le Mans, bug B04) : avant
// cette correction, une seance ou RIEN n'avait ete couvert (couvert = 0,
// attendu = 6) tombait dans le "sinon" et s'affichait "Conforme au
// previsionnel". C'etait le faux negatif le plus grave de l'outil : l'Atlas
// rassurait le Formateur Referent precisement la ou il devait l'alerter.
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

    let etat = 'nominal';
    let detail = 'Conforme au previsionnel.';

    if (couvert > attendu) {
      etat = 'ecart_plus';
      detail = `${couvert} concept(s) couvert(s) pour ${attendu} annonce(s) — contenu supplementaire.`;
    } else if (couvert < attendu) {
      etat = 'ecart_moins';
      detail = couvert === 0
        ? `Aucun concept declare couvert alors que ${attendu} etai(en)t annonce(s).`
        : `${couvert} concept(s) couvert(s) pour ${attendu} annonce(s) — contenu non traite.`;
    }

    return { previsionnel_id: p.id, module_ref: p.module_ref, intervenant_nom: p.intervenant_nom,
      numero: p.numero, titre: p.titre, date_prevue: p.date_prevue, etat, detail,
      concepts_attendus: attendu, concepts_couverts: couvert };
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
// ── Rendu HTML du digest ───────────────────────────────────────────────────
// Reecrit le 25/08/2026. Trois defauts corriges :
//  1. La section "Avancement RNCP par bloc" ecrivait en color:#fff sur un
//     conteneur sans fond — blanc sur blanc, illisible. Invisible depuis
//     l'apercu in-app, qui a son propre fond sombre.
//  2. Le bandeau de KPI (intervenants / seances / coordination) et les barres
//     de progression, presents dans l'apercu, etaient absents du mail : les
//     deux ne montraient pas la meme chose, alors que l'ecran promet
//     "tel que les intervenants le recevront".
//  3. Aucun echappement HTML sur les noms, libelles et note du FR.
//
// Structure en tables avec bgcolor explicite sur chaque cellule : c'est la
// seule mise en forme fiable dans Outlook, qui rend le HTML avec le moteur de
// Word et ignore les fonds poses sur des <div>. Aucune couleur en rgba() pour
// la meme raison — uniquement des hex opaques.
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Palette Eminéo, en hex opaques (pas de rgba : Outlook ne la supporte pas).
const C = {
  abysse: '#0B2B2D', petrole: '#134547', menthe: '#5DE298', givre: '#E3FFF0',
  saumon: '#E89B77', rail: '#17383A', ligne: '#1C4143',
  texte: '#FFFFFF', texteAtt: '#9FB8B5', label: '#7FA09C',
};

function renderDigestHTML(c, titreFormation, campus, frNom) {
  const kpis = c.kpis || { intervenants: 0, seances: 0, coordination: 0 };

  const pill = (t) =>
    `<span style="background:${C.ligne};color:${C.menthe};font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;margin:2px 4px 0 0;display:inline-block;font-family:Arial,Helvetica,sans-serif">${esc(t)}</span>`;

  const kpi = (val, lib, couleur) =>
    `<td width="33%" valign="top" style="padding:0 8px 0 0;font-family:Arial,Helvetica,sans-serif">
       <div style="font-size:26px;font-weight:700;color:${couleur};line-height:1">${esc(val)}</div>
       <div style="font-size:11px;color:${C.texteAtt};padding-top:4px">${esc(lib)}</div>
     </td>`;

  // Barre de progression en table : une cellule remplie a X %, une cellule
  // vide pour le reste. Fonctionne partout, y compris Outlook.
  const barre = (pct) => {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    const rempli = p > 0
      ? `<td width="${p}%" bgcolor="${C.menthe}" style="height:4px;line-height:4px;font-size:1px">&nbsp;</td>`
      : '';
    const vide = p < 100
      ? `<td width="${100 - p}%" bgcolor="${C.rail}" style="height:4px;line-height:4px;font-size:1px">&nbsp;</td>`
      : '';
    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>${rempli}${vide}</tr></table>`;
  };

  const blocs = (c.avancement_blocs || []).map(b => `
    <tr><td style="padding:0 0 12px 0;font-family:Arial,Helvetica,sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-size:12px;color:${C.texte};padding-bottom:5px">${esc(b.id)} — ${esc(b.titre)}</td>
        <td align="right" style="font-size:12px;font-weight:700;color:${C.menthe};padding-bottom:5px">${b.pct == null ? '—' : b.pct + '%'}</td>
      </tr></table>
      ${barre(b.pct)}
    </td></tr>`).join('');

  const qui = (c.qui_a_enseigne || []).map(q => `
    <tr><td style="padding:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;border-bottom:1px solid ${C.ligne}">
      <div style="font-size:13px;color:${C.texte};line-height:1.4;padding-bottom:3px">${esc(q.module)}</div>
      <div style="font-size:11px;color:${C.texteAtt};padding-bottom:4px">${esc(q.intervenant)}${q.modalite ? ' · ' + esc(q.modalite) : ''}</div>
      <div>${(q.competences || []).map(pill).join('')}</div>
    </td></tr>`).join('');

  const coord = (c.coordination || []).map(co => `
    <tr><td style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif">
      <div style="font-size:12px;color:${C.saumon};font-weight:600">${esc(co.titre)}</div>
      <div style="font-size:11px;color:${C.texteAtt};line-height:1.5">${esc(co.detail)}</div>
    </td></tr>`).join('');

  const suite = (c.sequences_a_venir || []).map(s => `
    <tr><td style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif">
      <div style="font-size:12.5px;color:${C.texte};line-height:1.4">${esc(s.module)}</div>
      <div style="font-size:11px;color:${C.texteAtt}">${s.date ? esc(String(s.date).slice(0, 10)) + ' · ' : ''}${esc(s.intervenant)}</div>
    </td></tr>`).join('');

  const section = (label, contenu) => `
    <tr><td bgcolor="${C.abysse}" style="padding:20px 26px;border-bottom:1px solid ${C.ligne}">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.label};padding-bottom:14px">${esc(label)}</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">${contenu}</table>
    </td></tr>`;

  const vide = (msg) => `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${C.texteAtt}">${esc(msg)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(c.titre || 'Atlas — Éminéo')}</title></head>
<body style="margin:0;padding:0;background:${C.abysse}">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.abysse}" style="background:${C.abysse}">
<tr><td align="center" style="padding:24px 12px">

<table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;border-collapse:collapse;border-radius:14px;overflow:hidden">

  <tr><td bgcolor="${C.petrole}" style="padding:14px 26px;font-family:Arial,Helvetica,sans-serif">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-size:15px;font-weight:700;color:${C.menthe}">Atlas · Éminéo</td>
      <td align="right" style="font-size:11px;color:${C.texteAtt}">${esc(titreFormation)}${campus ? ' · ' + esc(campus) : ''}</td>
    </tr></table>
  </td></tr>

  <tr><td bgcolor="${C.abysse}" style="padding:28px 26px;font-family:Arial,Helvetica,sans-serif">
    <div style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.menthe};padding-bottom:8px">Synthèse · Formateur Référent ${esc(frNom)}</div>
    <div style="font-size:23px;font-weight:700;color:${C.texte};line-height:1.25;padding-bottom:8px">${esc(c.titre)}</div>
    <div style="font-size:12px;color:${C.texteAtt};line-height:1.5">Généré par Atlas · Validé avant envoi · Répondez à ce mail pour contacter ${esc(frNom || 'le Formateur Référent')}</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid ${C.ligne}">
      <tr><td style="padding-top:18px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          ${kpi(kpis.intervenants, 'Intervenants actifs', C.menthe)}
          ${kpi(kpis.seances, 'Séances réalisées', C.menthe)}
          ${kpi(kpis.coordination, 'Points de coordination', C.saumon)}
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  ${section('Avancement RNCP par bloc', blocs || vide('Aucun bloc de compétences sur ce titre.'))}
  ${section('Qui a enseigné quoi ce mois-ci', qui || vide('Aucune séance déclarée sur la période.'))}

  <tr><td bgcolor="${C.abysse}" style="padding:20px 26px;border-bottom:1px solid ${C.ligne}">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.label};padding-bottom:14px">Point de coordination — ${esc(frNom || 'FR')}</div>
    ${c.note_fr ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:${coord ? '14px' : '0'}">
      <tr><td bgcolor="#2A2320" style="padding:14px 16px;border-left:3px solid ${C.saumon};font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:${C.givre};line-height:1.65">${esc(c.note_fr)}</td></tr>
    </table>` : ''}
    ${coord ? `<table width="100%" cellpadding="0" cellspacing="0" border="0">${coord}</table>` : (c.note_fr ? '' : vide('Aucun point de coordination ce mois-ci.'))}
  </td></tr>

  ${suite ? section('Ce qui arrive le mois prochain', suite) : ''}

  <tr><td bgcolor="${C.petrole}" style="padding:18px 26px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${C.texteAtt};line-height:1.6">
    Répondre à ce mail = contacter ${esc(frNom || 'le Formateur Référent')} directement.<br>
    Atlas des compétences · Éminéo · ${esc(titreFormation)}
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// Expediteur. Par defaut l'adresse de marque — mais elle exige que le domaine
// emineo-education.fr soit verifie dans Resend (enregistrements SPF/DKIM a
// poser dans la zone DNS, demande DSI). Tant que ce n'est pas fait, Resend
// renvoie 403 "domain is not verified".
// Contournement : ATLAS_MAIL_FROM = "Atlas <onboarding@resend.dev>", le
// bac a sable Resend, qui n'exige aucune verification mais ne delivre QUE
// vers l'adresse du compte Resend — d'ou l'obligation d'avoir en meme temps
// ATLAS_MAIL_REDIRECT pointant sur cette meme adresse.
const MAIL_FROM_DEFAUT = 'Atlas <atlas@emineo-education.fr>';

async function envoyerResend(apiKey, { to, subject, html }) {
  const from = (process.env.ATLAS_MAIL_FROM || '').trim() || MAIL_FROM_DEFAUT;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = (data && (data.message || data.error)) || ('Resend HTTP ' + r.status);
    // Message explicite : l'erreur brute de Resend ne dit pas quoi faire.
    if (String(msg).includes('not verified')) {
      throw new Error(
        `${msg} — Renseigner ATLAS_MAIL_FROM = "Atlas <onboarding@resend.dev>" dans Vercel ` +
        `(mode bac a sable, envoi possible uniquement vers l'adresse du compte Resend), ` +
        `ou faire verifier le domaine emineo-education.fr sur resend.com/domains.`
      );
    }
    throw new Error(msg);
  }
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
      const user = await requireRole(req, ROLES_DIGEST);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });
      const { formation_id, campus, annee_scolaire, periode } = req.body || {};
      if (!formation_id || !campus) return res.status(400).json({ error: 'formation_id et campus requis.' });

      const perim = await verifierPerimetre(db, user, formation_id);
      if (!perim.ok) return res.status(403).json({ error: perim.error });

      const apiKey = process.env.ANTHROPIC_API_KEY;
      const annee = annee_scolaire || '2026-27';
      const ref = periode || new Date().toISOString();
      const { contenu, destinataires, debut, fin } = await genererContenuDigest(db, apiKey, formation_id, campus, annee, ref);
      const up = await upsertDigest(db, { formationId: formation_id, campus, anneeScolaire: annee, debut, fin, contenu, destinataires });
      return res.status(200).json({ ok: true, digest_id: up.id, statut: up.statut, contenu_genere: contenu, destinataires });
    }

    // ── POST ?action=valider-envoyer — 1 clic : note FR + envoi Resend ─────
    if (req.method === 'POST' && action === 'valider-envoyer') {
      const user = await requireRole(req, ROLES_DIGEST);
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

      const perim = await verifierPerimetre(db, user, digest.formation_id);
      if (!perim.ok) return res.status(403).json({ error: perim.error });

      const contenu = parseJSON(digest.contenu_genere, {});
      if (typeof note_fr === 'string') contenu.note_fr = note_fr;
      const destinataires = parseJSON(digest.destinataires, []);
      if (!destinataires.length) return res.status(422).json({ error: 'Aucun destinataire (aucun intervenant inscrit sur ce titre).' });

      const formationRow = await db.execute({ sql: 'SELECT titre FROM formations WHERE id = ?', args: [digest.formation_id] });
      const titreFormation = (formationRow.rows[0] && formationRow.rows[0].titre) || '';
      const frNom = `${user.prenom || ''} ${user.nom || ''}`.trim();

      // ── Garde-fou d'envoi (audit Le Mans, bug B03) ────────────────────────
      // Tant que ATLAS_MAIL_REDIRECT est renseignee dans Vercel, AUCUN mail ne
      // part vers les intervenants : tout est redirige vers cette adresse et le
      // sujet est prefixe [TEST]. Retirer la variable = passage en envoi reel.
      // A conserver renseignee pendant toute la phase de demonstration.
      const redirect = (process.env.ATLAS_MAIL_REDIRECT || '').trim();
      const modeTest = !!redirect;
      const emails = destinataires.map(d => d.email);
      const sujet = contenu.titre || `Atlas — ${titreFormation}`;

      const resendKey = process.env.RESEND_API_KEY;
      let resendId = null;
      if (resendKey) {
        let html = renderDigestHTML(contenu, titreFormation, digest.campus, frNom);
        if (modeTest) {
          // Le rendu est desormais un document HTML complet : le bandeau doit
          // etre insere AVANT </body>, pas concatene apres.
          const bandeau =
            `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.abysse}"><tr><td align="center" style="padding:0 12px 24px">
               <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%">
                 <tr><td bgcolor="#3A2A22" style="padding:14px 18px;border:1px solid ${C.saumon};border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${C.saumon};line-height:1.6">
                   <strong>Mode test.</strong> Ce message aurait été envoyé à ${emails.length} destinataire(s) :<br>${esc(emails.join(', '))}
                 </td></tr>
               </table>
             </td></tr></table>`;
          html = html.replace('</body>', bandeau + '</body>');
        }
        const sent = await envoyerResend(resendKey, {
          to: modeTest ? [redirect] : emails,
          subject: modeTest ? `[TEST] ${sujet}` : sujet,
          html,
        });
        resendId = sent && sent.id;
      }

      await db.execute({
        sql: `UPDATE digest_fr SET statut='envoye', valide_par=?, valide_at=datetime('now'), envoye_at=datetime('now'), resend_id=?, contenu_genere=? WHERE id=?`,
        args: [user.id, resendId, JSON.stringify(contenu), digest_id],
      });

      return res.status(200).json({ ok: true, statut: 'envoye', resend_id: resendId, destinataires: destinataires.length,
        resend_configure: !!resendKey, mode_test: modeTest, redirige_vers: modeTest ? redirect : null });
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
