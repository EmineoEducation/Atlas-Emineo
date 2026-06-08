const { getDB } = require('../_lib/db');
const { hashPassword, createSession } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

    const db = getDB();
    const result = await db.execute({
      sql: 'SELECT id, role, nom, prenom, email, campus, password_hash FROM users WHERE email = ?',
      args: [email.toLowerCase().trim()],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const user = result.rows[0];
    if (user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const token = await createSession(user.id);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        role: user.role,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        campus: user.campus,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
