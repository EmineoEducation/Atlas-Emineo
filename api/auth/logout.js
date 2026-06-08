const { getDB } = require('../_lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const db = getDB();
    await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
  }

  return res.status(200).json({ ok: true });
};
