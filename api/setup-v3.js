// ============================================================
// api/setup-v3.js — Migration : table d'inscription (rattachement
// personne ↔ titre). Une personne = un compte, rattachable à
// plusieurs titres. promo / groupe sont prévues dès maintenant mais
// laissées vides au pilote (évite une re-migration plus tard).
//
// À appeler une fois après déploiement : POST /api/setup-v3
// Réservé au rôle 'dir'. Idempotent.
// ============================================================

const { getDB } = require('./_lib/db');
const { requireRole } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const user = await requireRole(req, ['dir']);
  if (!user) return res.status(403).json({ error: 'Accès réservé à la Direction.' });

  try {
    const db = getDB();

    await db.execute(`CREATE TABLE IF NOT EXISTS inscription (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      formation_id INTEGER NOT NULL,
      campus TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',          -- 'etudiant' | 'intervenant' (dénormalisé pour filtrage rapide)
      promo TEXT DEFAULT '',                  -- prévu (B3 / M1 / M2) — vide au pilote
      groupe TEXT DEFAULT '',                 -- prévu (A / B / C)    — vide au pilote
      annee_scolaire TEXT NOT NULL DEFAULT '2026-27',
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_insc_user ON inscription(user_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_insc_formation ON inscription(formation_id, annee_scolaire)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_insc_campus ON inscription(campus, annee_scolaire)`);
    // Empêche le doublon : une personne n'est inscrite qu'une fois par (titre, promo, groupe, année)
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_insc_unique
      ON inscription(user_id, formation_id, promo, groupe, annee_scolaire)`);

    return res.status(200).json({
      ok: true,
      message: 'Table inscription créée (+ index).',
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
