const { getDB } = require('./_lib/db');
const { hashPassword } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const db = getDB();
    // Créer les tables
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      nom TEXT NOT NULL,
      prenom TEXT DEFAULT '',
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      campus TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS formations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campus TEXT DEFAULT '',
      titre TEXT DEFAULT '',
      data_json TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    // Index pour performance
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

    // ─── Tables v2 — poste Formateur Référent ──────────────────────────────────
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

    // ─── Table v3 — inscription (rattachement personne ↔ titre) ────────────────
    await db.execute(`CREATE TABLE IF NOT EXISTS inscription (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      formation_id INTEGER NOT NULL,
      campus TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      promo TEXT DEFAULT '',
      groupe TEXT DEFAULT '',
      annee_scolaire TEXT NOT NULL DEFAULT '2026-27',
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_insc_user ON inscription(user_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_insc_formation ON inscription(formation_id, annee_scolaire)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_insc_campus ON inscription(campus, annee_scolaire)`);
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_insc_unique ON inscription(user_id, formation_id, promo, groupe, annee_scolaire)`);

    // Seed les 3 comptes Direction pédagogique (si pas déjà créés)
    const dirAccounts = [
      { nom: 'Robert', prenom: 'Arnaud', email: 'arnaud.robert@emineo-education.fr', password: 'atlas2026' },
      { nom: 'Hervé', prenom: 'Ludovic', email: 'ludovic.herve@emineo-education.fr', password: 'atlas2026' },
      { nom: 'Kornowski', prenom: 'Sylvain', email: 'sylvain.kornowski@emineo-education.fr', password: 'atlas2026' },
    ];

    let created = 0;
    for (const a of dirAccounts) {
      const exists = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [a.email] });
      if (exists.rows.length === 0) {
        await db.execute({
          sql: 'INSERT INTO users (role, nom, prenom, email, password_hash, campus) VALUES (?, ?, ?, ?, ?, ?)',
          args: ['dir', a.nom, a.prenom, a.email, hashPassword(a.password), 'tous'],
        });
        created++;
      }
    }

    return res.status(200).json({
      ok: true,
      message: `Tables créées (base + FR + inscription). ${created} compte(s) Direction pédagogique initialisé(s).`,
      comptes_dir: dirAccounts.map(a => ({ email: a.email, mdp: a.password })),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
