const { requireRole } = require('./_lib/auth');

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 16000;

// Repair JSON tronque (brackets non fermes)
function repairJSON(raw) {
  let s = (raw || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const first = s.indexOf('{');
  if (first === -1) throw new Error('Aucun JSON trouve dans la reponse Claude');
  const last = s.lastIndexOf('}');
  s = s.slice(first, last > first ? last + 1 : undefined);
  let open = 0, arr = 0;
  for (const ch of s) {
    if (ch === '{') open++;
    if (ch === '}') open--;
    if (ch === '[') arr++;
    if (ch === ']') arr--;
  }
  if (open > 0 || arr > 0) {
    const lc = Math.max(s.lastIndexOf(',{'), s.lastIndexOf(',"'));
    if (lc > s.length * 0.5) s = s.slice(0, lc);
    open = 0; arr = 0;
    for (const ch of s) {
      if (ch === '{') open++;
      if (ch === '}') open--;
      if (ch === '[') arr++;
      if (ch === ']') arr--;
    }
    while (arr > 0) { s += ']'; arr--; }
    while (open > 0) { s += '}'; open--; }
  }
  return JSON.parse(s);
}

// Appel Claude (non-streame) — renvoie le texte concatene
async function callClaude(apiKey, prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const raw = await r.json();
  if (!r.ok) {
    const msg = (raw && raw.error && raw.error.message) || ('Claude HTTP ' + r.status);
    const err = new Error(msg);
    err.status = 502;
    throw err;
  }
  return (raw.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode non supportee.' });
  }

  const user = await requireRole(req, ['dir', 'rp', 'intervenant']);
  if (!user) return res.status(403).json({ error: 'Acces reserve.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configuree sur le serveur.' });
  }

  const { textes, campus, prompt } = req.body || {};

  // ─── MODE 1 : prompt direct (fiche J-1 intervenant) ───────────────────────
  // Renvoie { text } — le front parse lui-meme.
  if (prompt && typeof prompt === 'string') {
    try {
      const text = await callClaude(apiKey, prompt);
      return res.status(200).json({ text });
    } catch (e) {
      return res.status(e.status || 502).json({
        error: 'Appel Claude echoue : ' + (e && e.message ? e.message : String(e)),
      });
    }
  }

  // ─── MODE 2 : ingestion de documents (textes + campus) ────────────────────
  // Renvoie { data } — structure pedagogique parsee.
  if (!textes || !Array.isArray(textes) || textes.length === 0) {
    return res.status(400).json({ error: 'Body invalide : fournir { prompt } ou { textes[], campus }.' });
  }

  const corpus = textes
    .map((t, i) => '--- DOCUMENT ' + (i + 1) + ' ---\n' + (t || '').slice(0, 12000))
    .join('\n\n');

  const campusLabel = Array.isArray(campus)
    ? campus.join(', ')
    : (campus || 'non precise');

  const ingestPrompt =
    'Tu es expert en ingenierie pedagogique. Analyse ces documents de formation et extrais leur structure pedagogique.\n\n' +
    'Campus concerne(s) : ' + campusLabel + '\n\n' +
    corpus + '\n\n' +
    'REGLES IMPERATIVES :\n' +
    '- Retourne UNIQUEMENT du JSON brut, aucun texte avant ou apres, aucun backtick\n' +
    '- Maximum 5 notions_cles par module (les plus importantes)\n' +
    '- Libelles de competences : max 12 mots\n' +
    '- Message d\'alerte : 1 phrase max, formule positivement (opportunite de coordination)\n' +
    '- Si un champ est inconnu, utilise une chaine vide "" ou un tableau vide []\n\n' +
    'Structure JSON exacte a retourner :\n' +
    '{\n' +
    '  "formation": { "titre": "Titre de la formation", "etablissement": "Nom", "rncp": "Numero RNCP si trouve sinon vide", "annee": "2025-26" },\n' +
    '  "blocs": [\n' +
    '    {\n' +
    '      "id": "B1",\n' +
    '      "titre": "Titre du bloc",\n' +
    '      "competences": [ { "id": "C1", "libelle": "Libelle court" } ],\n' +
    '      "modules": [ { "id": "M1", "titre": "Titre du module", "intervenant": "Nom ou vide", "competences_liees": ["C1"], "notions_cles": ["notion 1"], "volume": "12h" } ]\n' +
    '    }\n' +
    '  ],\n' +
    '  "intervenants": ["noms trouves"],\n' +
    '  "notions_transversales": ["notions presentes dans plusieurs blocs"],\n' +
    '  "alertes_detectees": [ { "niveau": 2, "notion": "Notion", "modules": ["M1","M3"], "message": "Phrase positive sur la coordination." } ]\n' +
    '}';

  let text;
  try {
    text = await callClaude(apiKey, ingestPrompt);
  } catch (e) {
    return res.status(e.status || 502).json({
      error: 'Appel Claude echoue : ' + (e && e.message ? e.message : String(e)),
    });
  }

  let parsed;
  try {
    parsed = repairJSON(text);
  } catch (e) {
    return res.status(422).json({
      error: 'JSON invalide retourne par Claude',
      raw_preview: text.slice(0, 500),
    });
  }

  if (!parsed.formation) parsed.formation = { titre: 'Formation importee', annee: '' };
  if (!parsed.blocs) parsed.blocs = [];
  if (!parsed.alertes_detectees) parsed.alertes_detectees = [];
  if (!parsed.intervenants) parsed.intervenants = [];
  if (!parsed.notions_transversales) parsed.notions_transversales = [];

  parsed._campus = Array.isArray(campus) ? JSON.stringify(campus) : (campus || '');

  return res.status(200).json({ data: parsed });
};
