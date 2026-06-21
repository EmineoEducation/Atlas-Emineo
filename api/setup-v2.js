// ============================================================
// api/setup-v2.js — Migrations v2 (tables FR / prévisionnel / digest)
// ------------------------------------------------------------
// Même pattern que api/setup.js : POST déclenche les CREATE TABLE
// via getDB().execute(...). Tables en snake_case minuscule, PK
// INTEGER AUTOINCREMENT, dates ISO en TEXT, JSON stocké en TEXT.
// Idempotent (IF NOT EXISTS) : peut être rejoué sans risque.
//
// À appeler une fois après déploiement :  POST /api/setup-v2
// Réservé au rôle 'dir'.
// ============================================================

const { getDB } = require('./_lib/db');
const { requireRole } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Réservé à la Direction (cohérent avec la sensibilité d'une migration)
  const user = await requireRole(req, ['dir']);
  if (!user) return res.status(403).json({ error: 'Accès réservé à la Direction.' });

  try {
    const db = getDB();

    // --- 1. previsionnel_seance : séance planifiée (one-shot septembre) ---
    await db.execute(`CREATE TABLE IF NOT EXISTS previsionnel_seance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      formation_id INTEGER NOT NULL,
      module_ref TEXT DEFAULT '',
      campus TEXT NOT NULL,
      intervenant_id INTEGER,
      intervenant_nom TEXT NOT NULL,
      numero INTEGER NOT NULL,
      titre TEXT NOT NULL,
      date_prevue TEXT,
      modalite TEXT NOT NULL DEFAULT 'P',
      contenu TEXT DEFAULT '',
      concepts TEXT NOT NULL DEFAULT '[]',
      competences TEXT NOT NULL DEFAULT '[]',
      annee_scolaire TEXT NOT NULL DEFAULT '2026-27',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_prev_formation ON previsionnel_seance(formation_id, annee_scolaire)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_prev_intervenant ON previsionnel_seance(intervenant_id, annee_scolaire)`);

    // --- 2. declaration : fait daté (réalisé CESAR ou révision FR) ---
    await db.execute(`CREATE TABLE IF NOT EXISTS declaration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      formation_id INTEGER NOT NULL,
      module_ref TEXT DEFAULT '',
      previsionnel_id INTEGER,
      campus TEXT NOT NULL,
      intervenant_id INTEGER,
      intervenant_nom TEXT DEFAULT '',
      seance_numero INTEGER,
      date_seance TEXT,
      source TEXT NOT NULL DEFAULT 'fr',
      couvert TEXT NOT NULL DEFAULT '[]',
      competences TEXT NOT NULL DEFAULT '[]',
      compte_rendu TEXT DEFAULT '',
      statut_cr TEXT DEFAULT '',
      ecart TEXT DEFAULT '',
      signal TEXT DEFAULT '',
      annee_scolaire TEXT NOT NULL DEFAULT '2026-27',
      declared_at TEXT DEFAULT (datetime('now'))
    )`);

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_decl_formation ON declaration(formation_id, annee_scolaire)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_decl_prev ON declaration(previsionnel_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_decl_module_date ON declaration(module_ref, date_seance)`);

    // --- 3. digest_fr : digest hebdo généré -> validé -> envoyé ---
    await db.execute(`CREATE TABLE IF NOT EXISTS digest_fr (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      formation_id INTEGER NOT NULL,
      campus TEXT NOT NULL,
      fr_id INTEGER,
      semaine_debut TEXT NOT NULL,
      semaine_fin TEXT NOT NULL,
      contenu_genere TEXT NOT NULL DEFAULT '{}',
      statut TEXT NOT NULL DEFAULT 'genere',
      valide_par INTEGER,
      valide_at TEXT,
      envoye_at TEXT,
      resend_id TEXT,
      destinataires TEXT NOT NULL DEFAULT '[]',
      annee_scolaire TEXT NOT NULL DEFAULT '2026-27',
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_digest_formation ON digest_fr(formation_id, annee_scolaire)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_digest_fr ON digest_fr(fr_id, statut)`);
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_digest_semaine ON digest_fr(formation_id, campus, semaine_debut)`);

    return res.status(200).json({
      ok: true,
      message: 'Tables v2 créées : previsionnel_seance, declaration, digest_fr (+ index).',
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
