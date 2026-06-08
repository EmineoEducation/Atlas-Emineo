const { getDB } = require('./_lib/db');
const { requireRole, hashPassword } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  // Toutes les opérations nécessitent le rôle dir
  const user = await requireRole(req, ['dir']);
  if (!user) return res.status(403).json({ error: 'Accès réservé à la Direction des programmes.' });

  const db = getDB();

  // GET — lister tous les comptes
  if (req.method === 'GET') {
    const result = await db.execute('SELECT id, role, nom, prenom, email, campus, created_at FROM users ORDER BY role, nom');
    return res.status(200).json({ users: result.rows });
  }

  // POST — créer un compte
  if (req.method === 'POST') {
    const { role, nom, prenom, email, password, campus } = req.body || {};
    if (!role || !nom || !password) {
      return res.status(400).json({ error: 'Rôle, nom et mot de passe requis.' });
    }
    if (!['dir', 'rp', 'intervenant', 'etudiant'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide.' });
    }

    const emailNorm = (email || `${nom.toLowerCase().replace(/\s+/g, '.')}@emineo-education.fr`).toLowerCase().trim();

    // Vérifier doublon
    const exists = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [emailNorm] });
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });
    }

    await db.execute({
      sql: 'INSERT INTO users (role, nom, prenom, email, password_hash, campus) VALUES (?, ?, ?, ?, ?, ?)',
      args: [role, nom, prenom || '', emailNorm, hashPassword(password), campus || ''],
    });

    return res.status(201).json({ ok: true, email: emailNorm });
  }

  // DELETE — supprimer un compte
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requis.' });
    // Ne pas se supprimer soi-même
    if (id === user.id) return res.status(400).json({ error: 'Impossible de supprimer votre propre compte.' });

    await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Méthode non supportée.' });
};
