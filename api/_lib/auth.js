const crypto = require('crypto');
const { getDB } = require('./db');

const SALT = 'atlas_emineo_2026';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function createSession(userId) {
  const db = getDB();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 jours
  await db.execute({
    sql: 'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
    args: [userId, token, expiresAt],
  });
  return token;
}

async function getUserFromToken(token) {
  if (!token) return null;
  const db = getDB();
  const result = await db.execute({
    sql: `SELECT u.id, u.role, u.nom, u.prenom, u.email, u.campus
          FROM sessions s JOIN users u ON s.user_id = u.id
          WHERE s.token = ? AND s.expires_at > datetime('now')`,
    args: [token],
  });
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function requireAuth(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return getUserFromToken(token);
}

async function requireRole(req, roles) {
  const user = await requireAuth(req);
  if (!user) return null;
  if (!roles.includes(user.role)) return null;
  return user;
}

module.exports = { hashPassword, generateToken, createSession, getUserFromToken, requireAuth, requireRole };
