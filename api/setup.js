const { getDB } = require('./_lib/db');
const { hashPassword } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const db = getDB();

  try {
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
      message: `Tables créées. ${created} compte(s) Direction pédagogique initialisé(s).`,
      comptes_dir: dirAccounts.map(a => ({ email: a.email, mdp: a.password })),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
