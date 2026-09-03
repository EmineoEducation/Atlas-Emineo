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

  const { textes, campus, prompt, type_doc } = req.body || {};

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

  // ─── MODE 2 : ingestion de documents ──────────────────────────────────────
  // Trois natures de document, trois lectures differentes (03/09/2026) :
  //   'pf'       Plan de formation — donne la STRUCTURE : quels modules, dans
  //              quelle annee de cycle, quel volume, quel intervenant. C'est le
  //              point de depart : il cree les modules et les repartit M1 / M2.
  //   'syllabus' Syllabus — donne le DETAIL d'un module deja structure :
  //              seances, notions travaillees, rattachement aux competences.
  //   'race'     Referentiel d'activites et de competences — donne la GRILLE :
  //              blocs, competences, criteres. C'est la cible du mapping.
  // Melanger ces trois lectures dans un prompt unique produisait une extraction
  // moyenne pour les trois : un PF etait lu comme un syllabus pauvre, un RACE
  // comme un PF sans volumes.
  if (!textes || !Array.isArray(textes) || textes.length === 0) {
    return res.status(400).json({ error: 'Body invalide : fournir { prompt } ou { textes[], campus }.' });
  }

  const TYPES = ['pf', 'syllabus', 'race'];
  const typeDoc = TYPES.includes(String(type_doc || '').toLowerCase())
    ? String(type_doc).toLowerCase()
    : 'pf';

  // Un plan de formation complet depasse largement 12 000 caracteres — l'ancien
  // plafond coupait la fin du document, donc les derniers modules, sans que
  // rien ne le signale. Plafond par document releve, et plafond global pour ne
  // pas exploser la fenetre de contexte sur un depot de plusieurs syllabi.
  const MAX_PAR_DOC = 60000;
  const MAX_TOTAL = 180000;
  let cumul = 0;
  const tronques = [];
  const corpus = textes
    .map((t, i) => {
      const brut = String(t || '');
      let morceau = brut.slice(0, MAX_PAR_DOC);
      if (cumul + morceau.length > MAX_TOTAL) morceau = morceau.slice(0, Math.max(0, MAX_TOTAL - cumul));
      cumul += morceau.length;
      if (morceau.length < brut.length) tronques.push(i + 1);
      return '--- DOCUMENT ' + (i + 1) + ' ---\n' + morceau;
    })
    .join('\n\n');

  const campusLabel = Array.isArray(campus) ? campus.join(', ') : (campus || 'non precise');

  // Regle d'annee de cycle — partagee par les trois lectures.
  const REGLE_ANNEE =
    'ANNEE DE CYCLE — REGLE CRITIQUE :\n' +
    'Les Masteres se deroulent sur deux ans. Un document peut couvrir le M1, le\n' +
    'M2, ou les deux. Chaque module porte un champ "annee_cycle" valant\n' +
    'exactement "M1", "M2", "B3" ou "".\n\n' +
    'Indices RECEVABLES, par ordre de fiabilite :\n' +
    '1. Mention explicite rattachee au module : "M1", "M2", "Master 1",\n' +
    '   "Master 2", "1re annee", "2e annee", "annee 1", "annee 2", "B3".\n' +
    '2. Titre de section, d\'onglet, d\'en-tete de tableau ou de colonne sous\n' +
    '   lequel le module est liste : herite de cette section, et de rien d\'autre.\n' +
    '3. Titre du document lui-meme s\'il ne couvre qu\'une annee.\n\n' +
    'PIEGE DES SEMESTRES : "S1" et "S2" designent le plus souvent les deux\n' +
    'semestres D\'UNE MEME annee, pas M1 et M2. Ne deduis JAMAIS l\'annee d\'un\n' +
    'S1/S2 seul. Une numerotation allant de S1 a S4 sur tout le document autorise\n' +
    'en revanche S1-S2 = M1 et S3-S4 = M2.\n\n' +
    'Autres interdits : ne deduis pas l\'annee du niveau de difficulte apparent,\n' +
    'de la position dans la liste, du volume horaire, ni du caractere\n' +
    '"fondamental" ou "avance" de l\'intitule. Sans indice recevable, renvoie "".\n' +
    'Une valeur vide se corrige ; une valeur inventee fausse silencieusement la\n' +
    'couverture d\'une promotion entiere. Ne devine pas.\n\n';

  // Perimetre certifiant et options — regle partagee PF / syllabi.
  // Deux constats du premier depot reel (Bachelor CDC, 03/09/2026) :
  //   1. le document Prog B3 2026-27 contenait les trois annees du cursus.
  //      Claude a tout ingere — comportement correct pour un plan de formation,
  //      mais 58 modules de prepa sont venus diluer la couverture du titre, avec
  //      deux gros blocs a zero competence en permanence sur la cartographie.
  //   2. les trois options intensives etaient extraites comme des blocs
  //      ordinaires. Or un etudiant en suit UNE : les compter toutes revient a
  //      exiger une couverture que personne n atteindra jamais.
  const REGLE_PERIMETRE =
    'PERIMETRE CERTIFIANT — REGLE CRITIQUE :\n' +
    'Ne retiens que ce qui concourt a la certification du titre lui-meme.\n\n' +
    'A EXCLURE TOTALEMENT, sans en creer ni bloc ni module :\n' +
    '- les annees preparatoires en amont du titre : sections intitulees\n' +
    '  Prepa, Preparatoire, Annee 1, Annee 2, 1re annee, 2e annee, lorsque le\n' +
    '  titre porte sur la troisieme annee (Bachelor 3, B3) ;\n' +
    '- les annees de cycle anterieures au titre de facon generale ;\n' +
    '- les mises a niveau, remises a niveau et modules d\'integration.\n\n' +
    'Un plan de formation de Bachelor decrit souvent les trois annees du cursus\n' +
    'alors que seule la derniere est certifiante. Ne conserve que celle-ci.\n\n' +
    'ATTENTION — ne confonds pas avec un Mastere : M1 et M2 sont TOUS DEUX\n' +
    'certifiants et doivent etre conserves. La regle ci-dessus vise les annees\n' +
    'preparatoires qui precedent le titre, pas les annees qui le composent.\n\n' +
    'OPTIONS ET PARCOURS AU CHOIX :\n' +
    'Chaque bloc porte un champ nature valant obligatoire ou option.\n' +
    'Une option est un parcours entre lesquels l\'etudiant choisit : options de\n' +
    'specialisation, semaines intensives au choix, parcours alternatifs.\n' +
    'Chaque option reste un bloc DISTINCT — ne les fusionne jamais entre elles.\n' +
    'Les options mutuellement exclusives partagent un meme option_groupe\n' +
    '(par exemple Semaines intensives), ce qui permet de savoir qu\'un etudiant\n' +
    'n\'en suit qu\'une seule. Un bloc obligatoire laisse option_groupe vide.\n\n';

  const REGLES_COMMUNES =
    'REGLES IMPERATIVES :\n' +
    '- Retourne UNIQUEMENT du JSON brut, aucun texte avant ou apres, aucun backtick\n' +
    '- Maximum 5 notions_cles par module (les plus importantes)\n' +
    '- Libelles de competences : max 12 mots\n' +
    '- Si un champ est inconnu, utilise une chaine vide "" ou un tableau vide []\n' +
    '- N\'invente aucun module, aucune competence, aucun intervenant absent des documents\n\n';

  let ingestPrompt;

  if (typeDoc === 'pf') {
    ingestPrompt =
      'Tu es expert en ingenierie pedagogique. Ces documents sont des PLANS DE\n' +
      'FORMATION. Ta tache est d\'en extraire la STRUCTURE : la liste des modules\n' +
      'et leur repartition par annee de cycle. Le rattachement aux competences\n' +
      'viendra plus tard, par les syllabi et le RACE — ne le force pas ici.\n\n' +
      'Campus concerne(s) : ' + campusLabel + '\n\n' +
      corpus + '\n\n' +
      REGLES_COMMUNES + REGLE_PERIMETRE + REGLE_ANNEE +
      'ORGANISATION EN BLOCS :\n' +
      'Si le plan de formation enonce explicitement des blocs de competences,\n' +
      'reprends-les. Sinon, place TOUS les modules dans un bloc unique d\'identifiant\n' +
      '"B0" et de titre "Modules non rattaches" — c\'est un etat d\'attente\n' +
      'parfaitement normal a ce stade, pas un echec. N\'invente jamais de blocs\n' +
      'plausibles pour faire joli : un B0 honnete vaut mieux qu\'un decoupage faux.\n\n' +
      'Structure JSON exacte a retourner :\n' +
      '{\n' +
      '  "formation": { "titre": "Titre", "etablissement": "Nom", "rncp": "Numero si trouve sinon vide", "annee": "2026-27", "annees_couvertes": ["M1","M2"], "modules_sans_annee": 0 },\n' +
      '  "blocs": [\n' +
      '    {\n' +
      '      "id": "B0",\n' +
      '      "titre": "Modules non rattaches",\n' +
      '      \"nature\": \"obligatoire\",\n' +
      '      \"option_groupe\": \"\",\n' +
      '      "competences": [],\n' +
      '      "modules": [ { "id": "M1", "titre": "Titre du module", "annee_cycle": "M1", "intervenant": "Nom ou vide", "volume": "12h", "semestre": "S1 ou vide", "competences_liees": [], "notions_cles": [] } ]\n' +
      '    }\n' +
      '  ],\n' +
      '  "intervenants": ["noms trouves"],\n' +
      '  "notions_transversales": [],\n' +
      '  "alertes_detectees": []\n' +
      '}';
  } else if (typeDoc === 'race') {
    ingestPrompt =
      'Tu es expert en ingenierie pedagogique. Ces documents sont un REFERENTIEL\n' +
      'D\'ACTIVITES ET DE COMPETENCES (RACE). Ta tache est d\'en extraire la GRILLE\n' +
      'DE CERTIFICATION : blocs, competences, criteres d\'evaluation. Un RACE ne\n' +
      'contient pas de modules d\'enseignement — laisse les tableaux de modules\n' +
      'vides plutot que d\'y recopier des competences.\n\n' +
      'Campus concerne(s) : ' + campusLabel + '\n\n' +
      corpus + '\n\n' +
      REGLES_COMMUNES +
      'Conserve les codes officiels tels qu\'ils apparaissent (C.1, C.20-II...).\n' +
      'Si deux specialisations portent le meme code, suffixe-les pour les\n' +
      'distinguer plutot que de les fusionner.\n\n' +
      'Structure JSON exacte a retourner :\n' +
      '{\n' +
      '  "formation": { "titre": "Titre", "etablissement": "Nom", "rncp": "Numero", "annee": "", "annees_couvertes": [], "modules_sans_annee": 0 },\n' +
      '  "blocs": [\n' +
      '    {\n' +
      '      "id": "B1",\n' +
      '      "titre": "Titre du bloc",\n' +
      '      \"nature\": \"obligatoire\",\n' +
      '      \"option_groupe\": \"\",\n' +
      '      "competences": [ { "id": "C.1", "libelle": "Libelle court", "criteres": ["critere 1"] } ],\n' +
      '      "modules": []\n' +
      '    }\n' +
      '  ],\n' +
      '  "intervenants": [],\n' +
      '  "notions_transversales": ["notions presentes dans plusieurs blocs"],\n' +
      '  "alertes_detectees": []\n' +
      '}';
  } else {
    ingestPrompt =
      'Tu es expert en ingenierie pedagogique. Ces documents sont des SYLLABI. Ta\n' +
      'tache est d\'extraire, pour chaque module, son DETAIL : seances, notions\n' +
      'travaillees, et rattachement aux competences du referentiel.\n\n' +
      'Le titre du module doit etre repris MOT POUR MOT tel qu\'il figure dans le\n' +
      'syllabus : il sert a rapprocher ce detail du module deja cree par le plan\n' +
      'de formation. Un titre reformule casse ce rapprochement.\n\n' +
      'Campus concerne(s) : ' + campusLabel + '\n\n' +
      corpus + '\n\n' +
      REGLES_COMMUNES + REGLE_PERIMETRE + REGLE_ANNEE +
      'Les competences sont souvent enoncees en prose libre. Rattache-les aux\n' +
      'codes du referentiel (C.1, C.14...) quand le document les cite ou les\n' +
      'paraphrase sans ambiguite. Dans le doute, laisse competences_liees vide :\n' +
      'un rattachement errone est plus couteux qu\'une case vide, car il fait\n' +
      'apparaitre comme couverte une competence qui ne l\'est pas.\n\n' +
      'Message d\'alerte : 1 phrase max, formulee positivement (opportunite de\n' +
      'coordination), jamais comme un reproche.\n\n' +
      'Structure JSON exacte a retourner :\n' +
      '{\n' +
      '  "formation": { "titre": "Titre", "etablissement": "Nom", "rncp": "Numero si trouve", "annee": "2026-27", "annees_couvertes": ["M1"], "modules_sans_annee": 0 },\n' +
      '  "blocs": [\n' +
      '    {\n' +
      '      "id": "B1",\n' +
      '      "titre": "Titre du bloc",\n' +
      '      \"nature\": \"obligatoire\",\n' +
      '      \"option_groupe\": \"\",\n' +
      '      "competences": [ { "id": "C.1", "libelle": "Libelle court" } ],\n' +
      '      "modules": [ { "id": "M1", "titre": "Titre exact du module", "annee_cycle": "M1", "intervenant": "Nom ou vide", "volume": "12h", "competences_liees": ["C.1"], "notions_cles": ["notion 1"], "seances": [ { "numero": 1, "titre": "Titre de seance", "notions": ["notion"] } ] } ]\n' +
      '    }\n' +
      '  ],\n' +
      '  "intervenants": ["noms trouves"],\n' +
      '  "notions_transversales": ["notions presentes dans plusieurs blocs"],\n' +
      '  "alertes_detectees": [ { "niveau": 2, "notion": "Notion", "modules": ["M1","M3"], "message": "Phrase positive sur la coordination." } ]\n' +
      '}';
  }

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

  // ─── Normalisation nature de bloc + filet anti-prepa ──────────────────────
  // Le prompt demande d'exclure les annees preparatoires, mais un prompt n'est
  // pas une garantie. Second filet cote serveur : tout bloc dont l'intitule
  // designe une annee amont est retire, et sa mise a l'ecart est remontee a
  // l'appelant plutot que silencieuse.
  const PREPA = /\b(pr[eé]pa|pr[eé]paratoire|remise\s+[aà]\s+niveau|mise\s+[aà]\s+niveau)\b/i;
  const ANNEE_AMONT = /\b(ann[eé]e\s*[12]\b|1(re|ère)\s*ann[eé]e|2(e|ème)\s*ann[eé]e|b1\b|b2\b)/i;
  const blocsEcartes = [];
  parsed.blocs = (Array.isArray(parsed.blocs) ? parsed.blocs : []).filter(b => {
    const lib = String(b.titre || '') + ' ' + String(b.id || '');
    // Un bloc n'est ecarte que s'il designe une annee amont ET ne porte aucune
    // competence : un bloc certifiant mal intitule ne doit pas disparaitre.
    const amont = PREPA.test(lib) || ANNEE_AMONT.test(lib);
    if (amont && !(b.competences || []).length) {
      blocsEcartes.push({
        id: String(b.id || ''),
        titre: String(b.titre || ''),
        modules: (b.modules || []).length,
      });
      return false;
    }
    return true;
  });
  if (blocsEcartes.length) parsed._blocs_ecartes = blocsEcartes;

  // nature : vocabulaire ferme, obligatoire par defaut.
  for (const b of parsed.blocs) {
    const nat = String(b.nature || '').trim().toLowerCase();
    b.nature = nat === 'option' ? 'option' : 'obligatoire';
    b.option_groupe = b.nature === 'option'
      ? String(b.option_groupe || '').trim() || 'Options'
      : '';
  }
  parsed._options = parsed.blocs.filter(b => b.nature === 'option').length;

  // ─── Normalisation de l'annee de cycle ────────────────────────────────────
  // Le champ conditionne le rattachement d'un module a une promotion (M1/M2).
  // On n'accepte que le vocabulaire ferme et on recompte cote serveur : le
  // total annonce par le modele n'est pas une source de verite.
  const CYCLES_VALIDES = ['M1', 'M2', 'B3'];
  let sansAnnee = 0;
  const cyclesVus = new Set();
  for (const bloc of parsed.blocs) {
    if (!Array.isArray(bloc.modules)) { bloc.modules = []; continue; }
    for (const mod of bloc.modules) {
      const brut = String(mod.annee_cycle || '').trim().toUpperCase();
      mod.annee_cycle = CYCLES_VALIDES.includes(brut) ? brut : '';
      if (mod.annee_cycle) cyclesVus.add(mod.annee_cycle); else sansAnnee++;
    }
  }
  parsed.formation.annees_couvertes = CYCLES_VALIDES.filter(c => cyclesVus.has(c));
  parsed.formation.modules_sans_annee = sansAnnee;


  parsed._campus = Array.isArray(campus) ? JSON.stringify(campus) : (campus || '');
  parsed._type_doc = typeDoc;
  // Signale a l'appelant qu'une partie du corpus n'a pas ete transmise : sans
  // cela, un document coupe produit une extraction partielle indiscernable
  // d'une extraction complete.
  if (tronques.length) parsed._documents_tronques = tronques;

  return res.status(200).json({ data: parsed });
};
