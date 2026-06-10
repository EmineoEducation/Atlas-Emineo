const { getDB } = require('./_lib/db');
const { requireAuth, requireRole } = require('./_lib/auth');

// Normalise une ville : trim + lowercase
function normCampus(s) {
  return (s || '').trim().toLowerCase();
}

// Vérifie si le campus du user est dans la liste de campus de la formation
// campus_field peut être "Paris" ou '["Paris","Bordeaux"]'
function campusMatch(campusField, userCampus) {
  if (!campusField || !userCampus) return false;
  const norm = normCampus(userCampus);
  try {
    const arr = JSON.parse(campusField);
    if (Array.isArray(arr)) {
      return arr.some(c => normCampus(c) === norm);
    }
  } catch (_) {}
  return normCampus(campusField) === norm;
}

module.exports = async function handler(req, res) {
  const db = getDB();

  // GET — lister les formations
  if (req.method === 'GET') {
    const user = await requireAuth(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });

    const all = await db.execute(
      'SELECT id, campus, titre, data_json, created_at FROM formations ORDER BY created_at DESC'
    );

    let rows = all.rows;
    // RP : filtrer par campus avec matching robuste
    if (user.role === 'rp') {
      rows = rows.filter(r => campusMatch(r.campus, user.campus));
    }

    const formations = rows.map(r => {
      let data = {};
      try {
        data = JSON.parse(r.data_json || '{}');
      } catch (_) {
        data = { formation: { titre: r.titre || 'Erreur de parsing' }, blocs: [] };
      }
      // Garantir les clés minimales attendues par le front
      if (!data.formation) data.formation = { titre: r.titre || 'Sans titre' };
      if (!data.blocs) data.blocs = [];
      if (!data.alertes_detectees) data.alertes_detectees = [];
      if (!data.intervenants) data.intervenants = [];
      // Métadonnées
      data._id = r.id;
      data._campus = r.campus;
      data._created_at = r.created_at;
      return data;
    });

    return res.status(200).json({ formations });
  }

  // POST — ajouter une formation
  if (req.method === 'POST') {
    const user = await requireRole(req, ['dir', 'rp']);
    if (!user) return res.status(403).json({ error: 'Accès réservé.' });

    const { campus, data } = req.body || {};
    if (!data) return res.status(400).json({ error: 'Données de formation requises.' });

    // campus peut être string ou array (multi-campus)
    let campusVal = '';
    if (Array.isArray(campus)) {
      campusVal = JSON.stringify(campus.map(c => c.trim()));
    } else {
      campusVal = (campus || data._campus || '').trim();
    }

    const titre = (data.formation && data.formation.titre) || 'Sans titre';

    await db.execute({
      sql: 'INSERT INTO formations (campus, titre, data_json, created_by) VALUES (?, ?, ?, ?)',
      args: [campusVal, titre, JSON.stringify(data), user.id],
    });

    return res.status(201).json({ ok: true, titre });
  }

  // DELETE
  if (req.method === 'DELETE') {
    const user = await requireRole(req, ['dir']);
    if (!user) return res.status(403).json({ error: 'Accès réservé à la Direction.' });

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requis.' });

    await db.execute({ sql: 'DELETE FROM formations WHERE id = ?', args: [id] });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Méthode non supportée.' });
};
