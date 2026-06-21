// ============================================================
// api/fr.js — Poste de travail Formateur Référent (LECTURE SEULE)
// ------------------------------------------------------------
// V1 : ne mute rien. Agrège pour un FR et une semaine donnée :
//   - séances prévues (previsionnel_seance)
//   - séances réalisées / déclarées (declaration)
//   - écarts détectés (prévu sans déclaration)
//   - digest généré en attente de validation (digest_fr)
//
// Les actions (valider digest, déclencher Resend, signaler RP)
// arriveront dans une version ultérieure. Ici : GET uniquement.
//
// Style aligné sur api/formations.js : CommonJS, getDB(), requireAuth().
// ============================================================

const { getDB } = require('./_lib/db');
const { requireAuth } = require('./_lib/auth');

// Lundi 00:00 et dimanche 23:59:59 (UTC) de la semaine contenant `ref`.
function bornesSemaine(ref) {
  const d = new Date(ref);
  const jour = (d.getUTCDay() + 6) % 7; // 0 = lundi
  const lundi = new Date(d);
  lundi.setUTCDate(d.getUTCDate() - jour);
  lundi.setUTCHours(0, 0, 0, 0);
  const dimanche = new Date(lundi);
  dimanche.setUTCDate(lundi.getUTCDate() + 6);
  dimanche.setUTCHours(23, 59, 59, 999);
  return { debut: lundi.toISOString(), fin: dimanche.toISOString() };
}

function parseJSON(val, fallback) {
  if (val == null) return fallback;
  try { return JSON.parse(val); } catch (_) { return fallback; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Méthode non supportée.' });
  }

  const user = await requireAuth(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié.' });

  const { formation_id, semaine, annee_scolaire } = req.query;
  if (!formation_id) return res.status(400).json({ error: 'formation_id requis.' });

  const annee = annee_scolaire || '2026-27';
  const ref = semaine || new Date().toISOString();
  const { debut, fin } = bornesSemaine(ref);

  try {
    const db = getDB();

    // 1) Séances PRÉVUES sur la semaine
    const prevu = await db.execute({
      sql: `SELECT id, module_ref, campus, intervenant_id, intervenant_nom,
                   numero, titre, date_prevue, modalite, contenu, concepts, competences
            FROM previsionnel_seance
            WHERE formation_id = ? AND annee_scolaire = ?
              AND date_prevue >= ? AND date_prevue <= ?
            ORDER BY date_prevue ASC`,
      args: [formation_id, annee, debut, fin],
    });

    // 2) Séances RÉALISÉES / déclarées sur la semaine
    const realise = await db.execute({
      sql: `SELECT id, module_ref, previsionnel_id, campus, intervenant_id, intervenant_nom,
                   seance_numero, date_seance, source, couvert, competences,
                   compte_rendu, statut_cr, ecart, signal, declared_at
            FROM declaration
            WHERE formation_id = ? AND annee_scolaire = ?
              AND date_seance >= ? AND date_seance <= ?
            ORDER BY date_seance ASC`,
      args: [formation_id, annee, debut, fin],
    });

    // 3) Détection d'écart : prévu sans déclaration correspondante
    const declaresParPrev = new Set(
      realise.rows.map(r => r.previsionnel_id).filter(v => v != null)
    );
    const ecarts = prevu.rows
      .filter(p => !declaresParPrev.has(p.id))
      .map(p => ({
        previsionnel_id: p.id,
        module_ref: p.module_ref,
        intervenant_nom: p.intervenant_nom,
        numero: p.numero,
        titre: p.titre,
        date_prevue: p.date_prevue,
        type: 'non_realise',
      }));

    // 4) Digest de la semaine (le plus récent)
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
      semaine: { debut, fin },
      seances_prevues: prevu.rows.map(r => ({
        ...r,
        concepts: parseJSON(r.concepts, []),
        competences: parseJSON(r.competences, []),
      })),
      seances_realisees: realise.rows.map(r => ({
        ...r,
        couvert: parseJSON(r.couvert, []),
        competences: parseJSON(r.competences, []),
      })),
      ecarts,
      digest: digestRow
        ? {
            ...digestRow,
            contenu_genere: parseJSON(digestRow.contenu_genere, {}),
            destinataires: parseJSON(digestRow.destinataires, []),
          }
        : null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
