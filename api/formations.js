const { getDB } = require('./_lib/db');
const { requireAuth, requireRole } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  const db = getDB();

  // GET — lister les formations (filtrées selon rôle)
  if (req.method === 'GET') {
    const user = await requireAuth(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });

    let rows;
    if (user.role === 'dir') {
      // Dir voit tout
      const result = await db.execute('SELECT id, campus, titre, data_json, created_at FROM formations ORDER BY created_at DESC');
      rows = result.rows;
    } else if (user.role === 'rp') {
      // RP voit les formations de son campus
      const result = await db.execute({
        sql: 'SELECT id, campus, titre, data_json, created_at FROM formations WHERE campus LIKE ? ORDER BY created_at DESC',
        args: [`%${user.campus}%`],
      });
      rows = result.rows;
    } else {
      // Intervenant et étudiant voient toutes les formations (filtre côté front)
      const result = await db.execute('SELECT id, campus, titre, data_json, created_at FROM formations ORDER BY created_at DESC');
      rows = result.rows;
    }

    const formations = rows.map(r => {
      try {
        const data = JSON.parse(r.data_json);
        data._id = r.id;
        data._campus = r.campus;
        data._created_at = r.created_at;
        return data;
      } catch (_) {
        return { _id: r.id, _campus: r.campus, formation: { titre: r.titre || 'Erreur' }, blocs: [] };
      }
    });

    return res.status(200).json({ formations });
  }

  // POST — ajouter une formation (dir ou rp)
  if (req.method === 'POST') {
    const user = await requireRole(req, ['dir', 'rp']);
    if (!user) return res.status(403).json({ error: 'Accès réservé.' });

    const { campus, data } = req.body || {};
    if (!data) return res.status(400).json({ error: 'Données de formation requises.' });

    const titre = data.formation?.titre || 'Sans titre';
    const campusVal = campus || data._campus || '';

    await db.execute({
      sql: 'INSERT INTO formations (campus, titre, data_json, created_by) VALUES (?, ?, ?, ?)',
      args: [campusVal, titre, JSON.stringify(data), user.id],
    });

    return res.status(201).json({ ok: true, titre });
  }

  // DELETE — supprimer une formation (dir uniquement)
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
