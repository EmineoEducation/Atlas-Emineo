// api/analyse-pf.js
// Analyse plan de formation au regard des exigences RNCP
// Body : { documents: [{ type, nom, texte }], titre_formation, rncp_ref }
// Retourne : { analyse: { blocs[], meta, score_global } }

const { requireRole } = require('./_lib/auth');

var MODEL = 'claude-haiku-4-5-20251001';
// claude-haiku-4-5 supporte jusqu'a 64000 tokens de sortie (doc officielle,
// juin 2026). 16000 etait trop juste pour un referentiel a plusieurs blocs
// et provoquait des troncatures (stop_reason: max_tokens) qui cassaient le
// JSON en plein milieu — cause la plus probable de l'erreur de parsing.
var MAX_TOKENS = 32000;

// Schema JSON Schema strict, reflete exactement la structure consommee par
// le reste du pipeline (cf. parsed.meta / parsed.blocs plus bas, et le front
// analyse-pf.html : STATUT_LABELS, GRAVITE_LABELS, construireDocx, etc.)
// Avec output_config.format, l'API contraint la generation via grammar
// (constrained decoding) — la sortie est garantie conforme au schema, donc
// repairJSON ci-dessous ne devrait quasiment plus jamais etre solliciteee.
// Reference : https://platform.claude.com/docs/en/build-with-claude/structured-outputs
var ANALYSE_SCHEMA = {
  type: 'object',
  properties: {
    meta: {
      type: 'object',
      properties: {
        titre_formation: { type: 'string' },
        rncp_ref: { type: 'string' },
        date_analyse: { type: 'string' },
        score_global: { type: 'integer' },
        justification_score_global: { type: 'string' },
        nb_points_forts: { type: 'integer' },
        nb_a_peaufiner: { type: 'integer' },
        nb_redondances: { type: 'integer' },
        nb_lacunes: { type: 'integer' },
        nb_manquements: { type: 'integer' },
      },
      required: [
        'titre_formation', 'rncp_ref', 'date_analyse', 'score_global', 'justification_score_global',
        'nb_points_forts', 'nb_a_peaufiner', 'nb_redondances', 'nb_lacunes', 'nb_manquements',
      ],
      additionalProperties: false,
    },
    blocs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          titre: { type: 'string' },
          score_couverture: { type: 'integer' },
          justification_score: { type: 'string' },
          competences: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                libelle: { type: 'string' },
                statut: { type: 'string', enum: ['point_fort', 'a_peaufiner', 'redondance', 'lacune', 'manquement'] },
                score_couverture: { type: 'integer' },
                justification_score: { type: 'string' },
                modules_couvrants: { type: 'array', items: { type: 'string' } },
                signaux: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      type: { type: 'string', enum: ['point_fort', 'a_peaufiner', 'redondance', 'lacune', 'manquement'] },
                      gravite: { type: 'integer', enum: [1, 2, 3] },
                      message: { type: 'string' },
                      statut_arbitrage: { type: 'string', enum: ['actif', 'archive', 'resolu'] },
                      justification_archive: { type: 'string' },
                      amelioration_proposee: { type: 'string' },
                    },
                    required: ['id', 'type', 'gravite', 'message', 'statut_arbitrage', 'justification_archive', 'amelioration_proposee'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['id', 'libelle', 'statut', 'score_couverture', 'justification_score', 'modules_couvrants', 'signaux'],
              additionalProperties: false,
            },
          },
        },
        required: ['id', 'titre', 'score_couverture', 'justification_score', 'competences'],
        additionalProperties: false,
      },
    },
  },
  required: ['meta', 'blocs'],
  additionalProperties: false,
};

// ── Repair JSON tronque ───────────────────────────────────────────────────────
// Filet de securite residuel. Avec output_config.format, ce chemin ne devrait
// plus etre atteint en temps normal — il ne reste utile que pour les deux cas
// que la doc officielle documente comme pouvant produire une sortie non
// conforme malgre le schema force : stop_reason "refusal" et "max_tokens".
// Ces deux cas sont maintenant detectes explicitement avant d'arriver ici
// (voir callClaude), donc si on atteint repairJSON c'est un troisieme cas
// imprevu — le raw_preview renvoye au front permet de le diagnostiquer.
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
      // Structured outputs (GA) : contraint la generation par grammaire au
      // lieu de compter uniquement sur l'instruction textuelle du prompt.
      // Plus de header beta requis depuis la migration vers output_config.
      output_config: {
        format: {
          type: 'json_schema',
          schema: ANALYSE_SCHEMA,
        },
      },
    }),
  });
  var raw = await r.json();
  if (!r.ok) {
    var msg = (raw && raw.error && raw.error.message) || ('Claude HTTP ' + r.status);
    var err = new Error(msg);
    err.status = 502;
    throw err;
  }

  // Cas documentes ou la sortie peut ne pas respecter le schema malgre la
  // contrainte (cf. doc officielle, section "Invalid outputs") : on les
  // detecte explicitement ici plutot que de laisser echouer le parsing JSON
  // plus loin avec un message generique qui ne dit pas pourquoi.
  if (raw.stop_reason === 'refusal') {
    var refusErr = new Error(
      'Claude a refuse de traiter cette demande (raison de securite). ' +
      'Verifiez le contenu des documents fournis.'
    );
    refusErr.status = 422;
    throw refusErr;
  }
  if (raw.stop_reason === 'max_tokens') {
    var truncErr = new Error(
      'La reponse a ete tronquee avant la fin (limite de ' + MAX_TOKENS + ' tokens atteinte). ' +
      'Reduisez le volume de documents fournis ou contactez le support pour augmenter la limite.'
    );
    truncErr.status = 422;
    throw truncErr;
  }

  return (raw.content || [])
    .filter(function(b) { return b.type === 'text'; })
    .map(function(b) { return b.text; })
    .join('');
}

// ── Prompt principal ──────────────────────────────────────────────────────────
// Note : la structure JSON exacte n'a plus besoin d'etre decrite ici — elle
// est imposee mecaniquement par ANALYSE_SCHEMA via output_config.format
// (voir callClaude). Ce prompt ne porte plus que les regles semantiques que
// le schema seul ne peut pas exprimer (definitions, ton, criteres de jugement).
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
    'CRITERES D EVALUATION :\n' +
    '- Pour chaque competence RNCP identifiee dans les documents, evalue sa couverture\n' +
    '- Statuts possibles et leur definition :\n' +
    '  point_fort = couverte, progressive, bien ancree\n' +
    '  a_peaufiner = presente mais superficielle ou peu ancree\n' +
    '  redondance = couverte plusieurs fois sans progression identifiable\n' +
    '  lacune = couverte insuffisamment au regard des exigences\n' +
    '  manquement = absente alors qu exigee par le certificateur\n' +
    '- gravite : 1 = informatif | 2 = a traiter avant rentree | 3 = bloquant pour certification\n' +
    '- score_couverture : 0-100, estimation du taux de couverture de la competence\n' +
    '- score_global : 0-100, estimation globale de la qualite du plan de formation\n' +
    '- justification_score (competence) : 1-2 phrases expliquant precisement pourquoi ce chiffre et pas un autre — ' +
    'cite les elements concrets des documents qui motivent le score (volume horaire, nombre de seances, ' +
    'progression ou son absence, modules manquants)\n' +
    '- justification_score (bloc) : 1-2 phrases sur ce qui tire le score du bloc vers le haut ou le bas, ' +
    'en synthese des competences qui le composent\n' +
    '- justification_score_global : 2-3 phrases de synthese globale, citant les 1-2 facteurs les plus determinants ' +
    'du score (ex: un manquement bloquant en B3 ou une couverture solide sur l ensemble)\n' +
    '- modules_couvrants : titres de modules qui couvrent cette competence, extraits des documents fournis\n' +
    '- message de chaque signal : 1 phrase factuelle et constructive, jamais culpabilisante\n' +
    '- Si un champ textuel est inconnu ou non applicable, utilise une chaine vide ("")\n' +
    '- justification_archive et amelioration_proposee : chaine vide ("") si non applicables a ce signal\n' +
    '- date_analyse : date du jour au format YYYY-MM-DD'
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
