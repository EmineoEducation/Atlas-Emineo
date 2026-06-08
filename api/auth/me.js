const { requireAuth } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const user = await requireAuth(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié.' });

  return res.status(200).json({ user });
};
