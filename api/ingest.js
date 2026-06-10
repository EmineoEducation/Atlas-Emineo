const { requireRole } = require('./_lib/auth');

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 16000;

// Repair JSON tronqué (brackets non fermés)
function repairJSON(raw) {
  let s = (raw || '').trim();
  // Supprimer les fences markdown
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const first = s.indexOf('{');
  if (first === -1) throw new Error('Aucun JSON trouvé dans la réponse Claude');
  const last = s.lastIndexOf('}');
  s = s.slice(first, last > first ? last + 1 : undefined);
  // Compter les brackets ouverts
  let open = 0, arr = 0;
  for (const ch of s) {
    if (ch === '{') open++;
    if (ch === '}') open--;
    if (ch === '[') arr++;
    if (ch === ']') arr--;
  }
  // Si déséquilibré : couper au dernier objet complet et refermer
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non supportée.' });
  }

  const user = await requireRole(req, ['dir', 'rp']);
  if (!user) return res.status(403).json({ error: 'Accès réservé.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurée sur le serveur.' });
  }

  const { textes, campus } = req.body || {};
  if (!textes || !Array.isArray(textes) || textes.length === 0) {
    return res.status(400).json({ error: 'textes[] requis.' });
  }

  // Construire le corpus (limité à 12 000 chars par doc pour rester sous max_tokens)
  const corpus = textes
    .map((t, i) => `--- DOCUMENT ${i + 1} ---\n${(t || '').slice(0, 12000)}`)
    .join('\n\n');

  const campusLabel = Array.isArray(campus)
    ? campus.join(', ')
    : (campus || 'non précisé');

  const prompt = `Tu es expert en ingénierie pédagogique. Analyse ces documents de formation et extrais leur structure pédagogique.

Campus concerné(s) : ${campusLabel}

${corpus}

RÈGLES IMPÉRATIVES :
- Retourne UNIQUEMENT du JSON brut, aucun texte avant ou après, aucun backtick
- Maximum 5 notions_cles par module (les plus importantes)
- Libellés de compétences : max 12 mots
- Message d'alerte : 1 phrase max, formulé positivement (opportunité de coordination)
- Si un champ est inconnu, utilise une chaîne vide "" ou un tableau vide []

Structure JSON exacte à retourner :
{
  "formation": {
    "titre": "Titre de la formation",
    "etablissement": "Nom de l'établissement",
    "rncp": "Numéro RNCP si trouvé, sinon vide",
    "annee": "2025-26"
  },
  "blocs": [
    {
      "id": "B1",
      "titre": "Titre du bloc",
      "competences": [
        { "id": "C1", "libelle": "Libellé court de la compétence" }
      ],
      "modules": [
        {
          "id": "M1",
          "titre": "Titre du module",
          "intervenant": "Nom de l'intervenant ou vide",
          "competences_liees": ["C1"],
          "notions_cles": ["notion 1", "notion 2"],
          "volume": "12h"
        }
      ]
    }
  ],
  "intervenants": ["liste des noms trouvés dans les docs"],
  "notions_transversales": ["notions présentes dans plusieurs blocs"],
  "alertes_detectees": [
    {
      "niveau": 2,
      "notion": "Notion concernée",
      "modules": ["M1", "M3"],
      "message": "Une phrase positive sur la coordination à établir."
    }
  ]
}`;

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
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const raw = await r.json();

    if (!r.ok) {
      const msg = (raw && raw.error && raw.error.message) || `Claude HTTP ${r.status}`;
      return res.status(502).json({ error: msg });
    }

    const text = (raw.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let parsed;
    try {
      parsed = repairJSON(text);
    } catch (e) {
      // Retourner le texte brut pour debug
      return res.status(422).json({
        error: 'JSON invalide retourné par Claude',
        raw_preview: text.slice(0, 500),
      });
    }

    // Garantir les clés minimales
    if (!parsed.formation) parsed.formation = { titre: 'Formation importée', annee: '' };
    if (!parsed.blocs) parsed.blocs = [];
    if (!parsed.alertes_detectees) parsed.alertes_detectees = [];
    if (!parsed.intervenants) parsed.intervenants = [];
    if (!parsed.notions_transversales) parsed.notions_transversales = [];

    // Attacher le campus
    parsed._campus = Array.isArray(campus) ? JSON.stringify(campus) : (campus || '');

    return res.status(200).json({ data: parsed });

  } catch (e) {
    return res.status(502).json({
      error: 'Appel Claude échoué : ' + (e && e.message ? e.message : String(e)),
    });
  }
};
