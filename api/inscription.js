// ============================================================
// api/inscription.js — Rattachements personne ↔ titre (lecture)
// ------------------------------------------------------------
// GET ?formation_id=[&role=][&annee_scolaire=]
//     -> liste des personnes inscrites à un titre (jointe à users)
// GET ?user_id=
//     -> liste des titres auxquels une personne est rattachée
//
// La création d'inscription se fait via api/users.js (à l'import).
// Style aligné repo : CommonJS, getDB(), requireAuth().
// ============================================================

const { getDB } = require('./_lib/db');
const { requireAuth } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  const user = await requireAuth(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié.' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Méthode non supportée.' });
  }

  const { formation_id, user_id, role, annee_scolaire } = req.query;
  const annee = annee_scolaire || '2026-27';

  try {
    const db = getDB();

    // Cas 1 : les titres d'une personne
    if (user_id) {
      const r = await db.execute({
        sql: `SELECT id, formation_id, campus, role, promo, groupe, annee_scolaire, created_at
              FROM inscription WHERE user_id = ? ORDER BY created_at DESC`,
        args: [user_id],
      });
      return res.status(200).json({ inscriptions: r.rows || [] });
    }

    // Cas 2 : les personnes d'un titre (jointes à users)
    if (formation_id) {
      const conditions = ['i.formation_id = ?', 'i.annee_scolaire = ?'];
      const args = [formation_id, annee];

      // Un RP ne voit que son campus
      if (user.role === 'rp') { conditions.push('i.campus = ?'); args.push(user.campus || ''); }
      if (role) { conditions.push('i.role = ?'); args.push(role); }

      const r = await db.execute({
        sql: `SELECT i.id, i.user_id, i.formation_id, i.campus, i.role, i.promo, i.groupe,
                     u.nom, u.prenom, u.email
              FROM inscription i
              JOIN users u ON u.id = i.user_id
              WHERE ${conditions.join(' AND ')}
              ORDER BY i.role, u.nom`,
        args,
      });
      return res.status(200).json({ inscriptions: r.rows || [] });
    }

    return res.status(400).json({ error: 'formation_id ou user_id requis.' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
