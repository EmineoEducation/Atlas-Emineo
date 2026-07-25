const { getDB } = require('./_lib/db');
const { requireAuth, requireRole } = require('./_lib/auth');

// Normaliser campus : string ou JSON array -> string normalisée pour filtre
function normCampus(c) { return (c || '').toLowerCase().trim(); }
function campusMatch(stored, userCampus) {
  if (!userCampus) return true;
  const norm = normCampus(userCampus);
  if (!stored) return false;
  try {
    const arr = JSON.parse(stored);
    if (Array.isArray(arr)) return arr.some(x => normCampus(x) === norm);
  } catch (_) {}
  return stored.split(',').map(normCampus).includes(norm);
}

function parseDataJson(raw) {
  let data = {};
  try { data = JSON.parse(raw || '{}'); } catch (_) {}
  if (!data.formation) data.formation = { titre: 'Formation importée', annee: '' };
  if (!data.blocs) data.blocs = [];
  if (!data.alertes_detectees) data.alertes_detectees = [];
  if (!data.intervenants) data.intervenants = [];
  return data;
}

module.exports = async function handler(req, res) {
  try {
    const db = getDB();

    // ─── GET : liste des formations ────────────────────────────────────────────
    if (req.method === 'GET') {
      const user = await requireAuth(req);
      if (!user) return res.status(401).json({ error: 'Non authentifié.' });

      const result = await db.execute(
        'SELECT id, campus, titre, rncp, niveau, titre_court, certificateur, data_json, created_at FROM formations ORDER BY niveau ASC, titre ASC'
      );
      const rows = result.rows || [];

      let formations = rows.map(r => {
        const data = parseDataJson(r.data_json);
        return {
          _id: r.id,
          _campus: r.campus || '',
          _rncp: r.rncp || '',
          _niveau: r.niveau || '',
          _titre_court: r.titre_court || '',
          _certificateur: r.certificateur || '',
          ...data,
        };
      });

      if (user.role === 'dir') {
        // Direction voit tout
      } else if (user.role === 'rp') {
        // Priorité : périmètre par inscription (multi-RP même campus)
        const insc = await db.execute({
          sql: "SELECT formation_id FROM inscription WHERE user_id = ? AND role = 'rp'",
          args: [user.id],
        });
        if (insc.rows && insc.rows.length > 0) {
          const ids = new Set(insc.rows.map(r => Number(r.formation_id)));
          formations = formations.filter(f => ids.has(f._id));
        } else {
          // Fallback ancien système : filtre par campus string
          formations = formations.filter(f => campusMatch(f._campus, user.campus));
        }
      } else if (user.role === 'fr') {
        // FR : uniquement le(s) titre(s) dont il est titulaire (table inscription)
        const insc = await db.execute({
          sql: "SELECT formation_id FROM inscription WHERE user_id = ? AND role = 'fr'",
          args: [user.id],
        });
        const ids = new Set((insc.rows || []).map(r => Number(r.formation_id)));
        formations = formations.filter(f => ids.has(f._id));
      } else {
        // Intervenant, étudiant : formations de son campus uniquement
        formations = formations.filter(f => campusMatch(f._campus, user.campus));
      }

      return res.status(200).json({ formations });
    }

    // ─── POST : créer une formation ────────────────────────────────────────────
    if (req.method === 'POST') {
      const user = await requireRole(req, ['dir', 'rp']);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });

      const { campus, data, rncp, niveau, titre_court, certificateur } = req.body || {};
      if (!data) return res.status(400).json({ error: 'data requis.' });

      const campusStr = Array.isArray(campus) ? JSON.stringify(campus) : (campus || '');
      data._campus = campusStr;

      // Extraire les métadonnées depuis data.formation si non fournies explicitement
      const rncpVal      = rncp         || (data.formation && data.formation.rncp)          || '';
      const niveauVal    = niveau        || '';
      const titreCourtVal= titre_court   || '';
      const certifVal    = certificateur || (data.formation && data.formation.etablissement)  || '';
      const titreVal     = (data.formation && data.formation.titre) || '';

      await db.execute({
        sql: 'INSERT INTO formations (campus, titre, rncp, niveau, titre_court, certificateur, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))',
        args: [campusStr, titreVal, rncpVal, niveauVal, titreCourtVal, certifVal, JSON.stringify(data)],
      });

      return res.status(201).json({ ok: true });
    }

    // ─── PATCH : modifier une formation ───────────────────────────────────────
    if (req.method === 'PATCH') {
      const user = await requireRole(req, ['dir', 'rp']);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });

      const { id, campus, data: dataOverride, rncp, niveau, titre_court, certificateur } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id requis.' });

      const existing = await db.execute({
        sql: 'SELECT campus, titre, rncp, niveau, titre_court, certificateur, data_json FROM formations WHERE id = ?',
        args: [id],
      });
      if (!existing.rows || !existing.rows.length) return res.status(404).json({ error: 'Formation introuvable.' });

      const row = existing.rows[0];
      let data = {};
      try { data = JSON.parse(row.data_json || '{}'); } catch (_) {}

      const campusStr = campus !== undefined
        ? (Array.isArray(campus) ? JSON.stringify(campus) : (campus || ''))
        : row.campus;

      if (dataOverride && typeof dataOverride === 'object') Object.assign(data, dataOverride);
      data._campus = campusStr;

      await db.execute({
        sql: `UPDATE formations SET
                campus = ?, rncp = ?, niveau = ?, titre_court = ?, certificateur = ?, data_json = ?
              WHERE id = ?`,
        args: [
          campusStr,
          rncp         !== undefined ? rncp         : (row.rncp || ''),
          niveau       !== undefined ? niveau       : (row.niveau || ''),
          titre_court  !== undefined ? titre_court  : (row.titre_court || ''),
          certificateur!== undefined ? certificateur: (row.certificateur || ''),
          JSON.stringify(data),
          id,
        ],
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
      // Nettoyer les inscriptions orphelines
      await db.execute({ sql: 'DELETE FROM inscription WHERE formation_id = ?', args: [id] });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Méthode non supportée.' });

  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
};
