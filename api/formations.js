const { getDB } = require('./_lib/db');
const { requireAuth, requireRole } = require('./_lib/auth');

// Normaliser campus : string ou JSON array -> string normalisee pour filtre
function normCampus(c) { return (c||'').toLowerCase().trim(); }
function campusMatch(stored, userCampus) {
  if (!userCampus) return true;
  const norm = normCampus(userCampus);
  if (!stored) return false;
  // Tenter de parser comme JSON array
  try {
    const arr = JSON.parse(stored);
    if (Array.isArray(arr)) return arr.some(x => normCampus(x) === norm);
  } catch (_) {}
  // Sinon comparer directement (ou liste CSV)
  return stored.split(',').map(normCampus).includes(norm);
}

module.exports = async function handler(req, res) {
  try {
    const db = getDB();

    // ─── GET : liste des formations (filtrée par campus si role rp) ───────────
    if (req.method === 'GET') {
      const user = await requireAuth(req);
      if (!user) return res.status(401).json({ error: 'Non authentifié.' });

      const result = await db.execute('SELECT id, campus, data_json, created_at FROM formations ORDER BY created_at DESC');
      const rows = result.rows || [];

      const formations = rows
        .map(r => {
          let data = {};
          try { data = JSON.parse(r.data_json || '{}'); } catch (_) {}
          // Garantir clés minimales
          if (!data.formation) data.formation = { titre: 'Formation importée', annee: '' };
          if (!data.blocs) data.blocs = [];
          if (!data.alertes_detectees) data.alertes_detectees = [];
          if (!data.intervenants) data.intervenants = [];
          return { _id: r.id, _campus: r.campus || '', ...data };
        })
        .filter(f => {
          if (user.role === 'dir') return true;
          return campusMatch(f._campus, user.campus);
        });

      return res.status(200).json({ formations });
    }

    // ─── POST : créer une formation ────────────────────────────────────────────
    if (req.method === 'POST') {
      const user = await requireRole(req, ['dir', 'rp']);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });

      const { campus, data } = req.body || {};
      if (!data) return res.status(400).json({ error: 'data requis.' });

      // Campus : string ou array -> stocker tel quel sérialisé
      const campusStr = Array.isArray(campus) ? JSON.stringify(campus) : (campus || '');

      // Injecter le campus dans data._campus pour cohérence
      data._campus = campusStr;

      await db.execute({
        sql: 'INSERT INTO formations (campus, data_json, created_at) VALUES (?, ?, ?)',
        args: [campusStr, JSON.stringify(data), new Date().toISOString()],
      });

      return res.status(201).json({ ok: true });
    }

    // ─── PATCH : modifier campus et/ou data d'une formation ───────────────────
    if (req.method === 'PATCH') {
      const user = await requireRole(req, ['dir', 'rp']);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });

      const { id, campus, data: dataOverride } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id requis.' });

      const existing = await db.execute({ sql: 'SELECT campus, data_json FROM formations WHERE id = ?', args: [id] });
      if (!existing.rows || !existing.rows.length) return res.status(404).json({ error: 'Formation introuvable.' });

      let data = {};
      try { data = JSON.parse(existing.rows[0].data_json || '{}'); } catch (_) {}

      // Mise à jour campus si fourni
      const campusStr = campus !== undefined
        ? (Array.isArray(campus) ? JSON.stringify(campus) : (campus || ''))
        : existing.rows[0].campus;

      // Mise à jour data si fourni (ex: intervenants dans modules)
      if (dataOverride && typeof dataOverride === 'object') {
        Object.assign(data, dataOverride);
      }
      data._campus = campusStr;

      await db.execute({
        sql: 'UPDATE formations SET campus = ?, data_json = ? WHERE id = ?',
        args: [campusStr, JSON.stringify(data), id],
      });

      return res.status(200).json({ ok: true });
    }

    // ─── DELETE : supprimer une formation ─────────────────────────────────────
    if (req.method === 'DELETE') {
      const user = await requireRole(req, ['dir']);
      if (!user) return res.status(403).json({ error: 'Réservé à la Direction.' });

      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id requis.' });

      await db.execute({ sql: 'DELETE FROM formations WHERE id = ?', args: [id] });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Méthode non supportée.' });

  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
};
