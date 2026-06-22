// api/analyse-pf.js
// Analyse plan de formation au regard des exigences RNCP
// Body : { documents: [{ type, nom, texte }], titre_formation, rncp_ref }
// Retourne : { analyse: { blocs[], meta, score_global } }

const { requireRole } = require('./_lib/auth');

var MODEL = 'claude-haiku-4-5-20251001';
var MAX_TOKENS = 16000;

// ── Repair JSON tronque ───────────────────────────────────────────────────────
function repairJSON(raw) {
  var s = (raw || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  var first = s.indexOf('{');
  if (first === -1) throw new Error('Aucun JSON dans la reponse Claude');
  var last = s.lastIndexOf('}');
  s = s.slice(first, last > first ? last + 1 : undefined);
  var open = 0, arr = 0;
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (ch === '{') open++;
    if (ch === '}') open--;
    if (ch === '[') arr++;
    if (ch === ']') arr--;
  }
  if (open > 0 || arr > 0) {
    var lc = Math.max(s.lastIndexOf(',{'), s.lastIndexOf(',"'));
    if (lc > s.length * 0.5) s = s.slice(0, lc);
    open = 0; arr = 0;
    for (var j = 0; j < s.length; j++) {
      var c = s[j];
      if (c === '{') open++;
      if (c === '}') open--;
      if (c === '[') arr++;
      if (c === ']') arr--;
    }
    while (arr > 0) { s += ']'; arr--; }
    while (open > 0) { s += '}'; open--; }
  }
  return JSON.parse(s);
}

// ── Appel Claude ──────────────────────────────────────────────────────────────
async function callClaude(apiKey, prompt) {
  var r = await fetch('https://api.anthropic.com/v1/messages', {
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
  var raw = await r.json();
  if (!r.ok) {
    var msg = (raw && raw.error && raw.error.message) || ('Claude HTTP ' + r.status);
    var err = new Error(msg);
    err.status = 502;
    throw err;
  }
  return (raw.content || [])
    .filter(function(b) { return b.type === 'text'; })
    .map(function(b) { return b.text; })
    .join('');
}

// ── Prompt principal ──────────────────────────────────────────────────────────
function buildPrompt(docs, titreFormation, rncpRef) {
  var corpus = docs.map(function(d, i) {
    var label = '[' + (d.type || 'DOCUMENT').toUpperCase() + ' ' + (d.nom || (i + 1)) + ']';
    return label + '\n' + (d.texte || '').slice(0, 10000);
  }).join('\n\n---\n\n');

  return (
    'Tu es expert en ingenierie pedagogique et en certification RNCP. ' +
    'Analyse les documents fournis et produis une evaluation rigoureuse du plan de formation ' +
    'au regard des exigences du certificateur.\n\n' +
    'Formation : ' + (titreFormation || 'non precise') + '\n' +
    'Reference RNCP : ' + (rncpRef || 'non precise') + '\n\n' +
    '--- DOCUMENTS ---\n\n' +
    corpus +
    '\n\n--- FIN DOCUMENTS ---\n\n' +
    'REGLES IMPERATIVES :\n' +
    '- Retourne UNIQUEMENT du JSON brut, aucun texte avant ou apres, aucun backtick markdown\n' +
    '- Pour chaque competence RNCP identifiee dans les documents, evalue sa couverture\n' +
    '- Grades de statut possibles : "point_fort" | "a_peaufiner" | "redondance" | "lacune" | "manquement"\n' +
    '  point_fort = couverte, progressive, bien ancree\n' +
    '  a_peaufiner = presente mais superficielle ou peu ancree\n' +
    '  redondance = couverte plusieurs fois sans progression identifiable\n' +
    '  lacune = couverte insuffisamment au regard des exigences\n' +
    '  manquement = absente alors qu exigee par le certificateur\n' +
    '- gravite : 1 = informatif | 2 = a traiter avant rentre | 3 = bloquant pour certification\n' +
    '- score_couverture : 0-100, estimation du taux de couverture de la competence\n' +
    '- score_global : 0-100, estimation globale de la qualite du plan de formation\n' +
    '- modules_couvrants : liste des titres de modules qui couvrent cette competence (extraits des documents)\n' +
    '- message signal : 1 phrase factuelle et constructive, jamais culpabilisante\n' +
    '- Si un champ est inconnu, utilise chaine vide ou tableau vide\n\n' +
    'Structure JSON exacte a retourner :\n' +
    '{\n' +
    '  "meta": {\n' +
    '    "titre_formation": "string",\n' +
    '    "rncp_ref": "string",\n' +
    '    "documents_analyses": ["type:nom", ...],\n' +
    '    "score_global": 0,\n' +
    '    "date_analyse": "YYYY-MM-DD",\n' +
    '    "nb_points_forts": 0,\n' +
    '    "nb_a_peaufiner": 0,\n' +
    '    "nb_redondances": 0,\n' +
    '    "nb_lacunes": 0,\n' +
    '    "nb_manquements": 0\n' +
    '  },\n' +
    '  "blocs": [\n' +
    '    {\n' +
    '      "id": "B1",\n' +
    '      "titre": "Titre du bloc",\n' +
    '      "score_couverture": 0,\n' +
    '      "competences": [\n' +
    '        {\n' +
    '          "id": "C.1",\n' +
    '          "libelle": "Libelle de la competence",\n' +
    '          "statut": "point_fort",\n' +
    '          "score_couverture": 0,\n' +
    '          "modules_couvrants": ["Titre module 1"],\n' +
    '          "signaux": [\n' +
    '            {\n' +
    '              "id": "S-C1-01",\n' +
    '              "type": "point_fort",\n' +
    '              "gravite": 1,\n' +
    '              "message": "Phrase factuelle et constructive.",\n' +
    '              "statut_arbitrage": "actif",\n' +
    '              "justification_archive": "",\n' +
    '              "amelioration_proposee": ""\n' +
    '            }\n' +
    '          ]\n' +
    '        }\n' +
    '      ]\n' +
    '    }\n' +
    '  ]\n' +
    '}'
  );
}

// ── Handler principal ─────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode non supportee.' });
  }

  var user = await requireRole(req, ['dir']);
  if (!user) return res.status(403).json({ error: 'Acces reserve a la Direction des programmes.' });

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configuree sur le serveur.' });
  }

  var body = req.body || {};
  var documents = body.documents;
  var titreFormation = body.titre_formation || '';
  var rncpRef = body.rncp_ref || '';

  if (!documents || !Array.isArray(documents) || documents.length === 0) {
    return res.status(400).json({ error: 'Body invalide : fournir { documents[], titre_formation, rncp_ref }.' });
  }

  // Validation minimale de chaque document
  var docs = documents.filter(function(d) {
    return d && typeof d.texte === 'string' && d.texte.trim().length > 0;
  });

  if (docs.length === 0) {
    return res.status(400).json({ error: 'Aucun document avec du texte exploitable fourni.' });
  }

  var prompt = buildPrompt(docs, titreFormation, rncpRef);

  var text;
  try {
    text = await callClaude(apiKey, prompt);
  } catch (e) {
    return res.status(e.status || 502).json({
      error: 'Appel Claude echoue : ' + (e && e.message ? e.message : String(e)),
    });
  }

  var parsed;
  try {
    parsed = repairJSON(text);
  } catch (e) {
    return res.status(422).json({
      error: 'JSON invalide retourne par Claude.',
      raw_preview: text.slice(0, 500),
    });
  }

  // Securisation de la structure retournee
  if (!parsed.meta) parsed.meta = {};
  if (!parsed.blocs) parsed.blocs = [];
  if (!parsed.meta.date_analyse) parsed.meta.date_analyse = new Date().toISOString().slice(0, 10);
  if (!parsed.meta.titre_formation) parsed.meta.titre_formation = titreFormation;
  if (!parsed.meta.rncp_ref) parsed.meta.rncp_ref = rncpRef;

  // Recalcul compteurs meta depuis les signaux reels
  var nb = { point_fort: 0, a_peaufiner: 0, redondance: 0, lacune: 0, manquement: 0 };
  (parsed.blocs || []).forEach(function(b) {
    (b.competences || []).forEach(function(c) {
      if (nb[c.statut] !== undefined) nb[c.statut]++;
    });
  });
  parsed.meta.nb_points_forts = nb.point_fort;
  parsed.meta.nb_a_peaufiner = nb.a_peaufiner;
  parsed.meta.nb_redondances = nb.redondance;
  parsed.meta.nb_lacunes = nb.lacune;
  parsed.meta.nb_manquements = nb.manquement;
  parsed.meta.documents_analyses = docs.map(function(d) {
    return (d.type || 'doc') + ':' + (d.nom || 'sans-nom');
  });

  return res.status(200).json({ analyse: parsed });
};
