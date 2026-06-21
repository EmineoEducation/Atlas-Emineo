// ============================================================
// api/previsionnel.js — Prévisionnel annuel intervenant
// ------------------------------------------------------------
// V1 : SAISIE DIRECTE dans Atlas (parse Word Teams plus tard).
// L'intervenant remplit ses N séances en one-shot (septembre) :
// dates, modalité P/D, contenu, concepts.
//
// GET  ?formation_id=&intervenant_id=[&module_ref=][&annee_scolaire=]
//      -> lit le prévisionnel existant
// POST { formation_id, intervenant_id, intervenant_nom, campus,
//        module_ref?, annee_scolaire?, seances:[ {numero,titre,
//        date_prevue,modalite,contenu,concepts[],competences[]} ] }
//      -> remplace le prévisionnel de cet intervenant pour ce module
//
// N'appelle PAS Claude (le mapping C.x se fait à l'ingestion Direction).
// Style aligné sur api/formations.js : CommonJS, getDB(), requireAuth().
// ============================================================

const { getDB } = require('./_lib/db');
const { requireAuth } = require('./_lib/auth');

function parseJSON(val, fallback) {
  if (val == null) return fallback;
  try { return JSON.parse(val); } catch (_) { return fallback; }
}

module.exports = async function handler(req, res) {
  const user = await requireAuth(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié.' });

  const db = getDB();

  // ==========================================================
  // GET — lecture
  // ==========================================================
  if (req.method === 'GET') {
    const { formation_id, intervenant_id, module_ref, annee_scolaire } = req.query;
    if (!formation_id || !intervenant_id) {
      return res.status(400).json({ error: 'formation_id et intervenant_id requis.' });
    }
    const annee = annee_scolaire || '2026-27';

    try {
      const conditions = ['formation_id = ?', 'intervenant_id = ?', 'annee_scolaire = ?'];
      const args = [formation_id, intervenant_id, annee];
      if (module_ref) { conditions.push('module_ref = ?'); args.push(module_ref); }

      const result = await db.execute({
        sql: `SELECT id, module_ref, campus, intervenant_id, intervenant_nom,
                     numero, titre, date_prevue, modalite, contenu, concepts,
                     competences, annee_scolaire, created_at, updated_at
              FROM previsionnel_seance
              WHERE ${conditions.join(' AND ')}
              ORDER BY numero ASC`,
        args,
      });

      return res.status(200).json({
        seances: result.rows.map(r => ({
          ...r,
          concepts: parseJSON(r.concepts, []),
          competences: parseJSON(r.competences, []),
        })),
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ==========================================================
  // POST — remplace le prévisionnel (one-shot)
  // ==========================================================
  if (req.method === 'POST') {
    const body = req.body || {};
    const {
      formation_id,
      intervenant_id,
      intervenant_nom,
      campus,
      module_ref = '',
      annee_scolaire = '2026-27',
      seances,
    } = body;

    if (!formation_id || !intervenant_id || !intervenant_nom || !campus) {
      return res.status(400).json({
        error: 'formation_id, intervenant_id, intervenant_nom et campus requis.',
      });
    }
    if (!Array.isArray(seances)) {
      return res.status(400).json({ error: 'seances doit être un tableau.' });
    }

    try {
      // Remplacement du périmètre (formation + intervenant + module + année).
      await db.execute({
        sql: `DELETE FROM previsionnel_seance
              WHERE formation_id = ? AND intervenant_id = ?
                AND module_ref = ? AND annee_scolaire = ?`,
        args: [formation_id, intervenant_id, module_ref, annee_scolaire],
      });

      let count = 0;
      for (let i = 0; i < seances.length; i++) {
        const s = seances[i] || {};
        const numero = Number.isInteger(s.numero) ? s.numero : i + 1;
        const modalite = s.modalite === 'D' ? 'D' : 'P';
        const concepts = JSON.stringify(Array.isArray(s.concepts) ? s.concepts : []);
        const competences = JSON.stringify(Array.isArray(s.competences) ? s.competences : []);

        await db.execute({
          sql: `INSERT INTO previsionnel_seance
                  (formation_id, module_ref, campus, intervenant_id, intervenant_nom,
                   numero, titre, date_prevue, modalite, contenu, concepts, competences,
                   annee_scolaire, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'), datetime('now'))`,
          args: [
            formation_id, module_ref, campus, intervenant_id, intervenant_nom,
            numero, s.titre || `Séance ${numero}`, s.date_prevue || null, modalite,
            s.contenu || '', concepts, competences,
            annee_scolaire,
          ],
        });
        count++;
      }

      return res.status(200).json({ ok: true, count });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Méthode non supportée.' });
};
