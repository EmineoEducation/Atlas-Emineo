const { requireRole } = require('./_lib/auth');

const MODEL = 'claude-haiku-4-5-20251001';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non supportée.' });
  }

  // Réservé aux rôles autorisés à créer une formation
  const user = await requireRole(req, ['dir', 'rp']);
  if (!user) return res.status(403).json({ error: 'Accès réservé.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé API non configurée sur le serveur (ANTHROPIC_API_KEY).' });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt requis.' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || ('Claude HTTP ' + r.status);
      return res.status(502).json({ error: msg });
    }

    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: 'Appel Claude échoué : ' + (e && e.message ? e.message : String(e)) });
  }
};
