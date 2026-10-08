// api/_lib/referentiels.js — Atlas Éminéo
//
// Registre des référentiels versionnés dans le dépôt.
//
// Depuis le 07/09/2026, la structure d'un titre ne provient plus d'une
// ingestion navigateur mais d'un fichier produit par outils/ et commité. Ce
// fichier fait le lien : les `require` sont statiques, donc tracés par Vercel
// au build et embarqués dans la fonction. Ajouter un titre se fait ici, en une
// ligne, après avoir commité son JSON.
//
// `_lib/` n'est pas décompté du plafond de 12 fonctions du plan Hobby.

const fs = require('node:fs');
const path = require('node:path');

// Découverte automatique du contenu de referentiels/.
//
// Auparavant chaque titre devait être déclaré ici par un `require` : ajouter le
// MRH ou le MDEC imposait de modifier ce fichier, donc un aller-retour de plus
// à chaque session. Le dossier est désormais lu au démarrage de la fonction, et
// le type de chaque fichier déduit de son contenu — un RACE porte des
// `activites`, un titre porte des `blocs`. Aucune convention de nommage à
// respecter, aucune ligne à ajouter : déposer le JSON suffit.
//
// Les fichiers sont embarqués dans la fonction par `includeFiles` dans
// vercel.json. Sans cette directive, le dossier serait absent à l'exécution.
const CHEMINS_CANDIDATS = [
  path.join(process.cwd(), 'referentiels'),
  path.join(__dirname, '..', '..', 'referentiels'),
  path.join(__dirname, '..', 'referentiels'),
];

const REFERENTIELS = {};
const RACES = {};
const DIAGNOSTIC = { dossier: null, essais: CHEMINS_CANDIDATS, lus: [], erreurs: [] };

for (const dossier of CHEMINS_CANDIDATS) {
  let fichiers;
  try { fichiers = fs.readdirSync(dossier).filter(f => f.endsWith('.json')); }
  catch (_) { continue; }

  DIAGNOSTIC.dossier = dossier;
  for (const f of fichiers) {
    try {
      const contenu = JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf-8'));
      const cle = f.replace(/\.json$/, '');
      if (Array.isArray(contenu.activites) && contenu.rncp) {
        RACES[String(contenu.rncp)] = contenu;
        DIAGNOSTIC.lus.push({ fichier: f, type: 'race', rncp: contenu.rncp });
      } else if (contenu.formation && Array.isArray(contenu.blocs)) {
        // La clé de fichier sert ensuite à retrouver l'alignement des syllabi.
        Object.defineProperty(contenu, '_cle', { value: cle, enumerable: false });
        REFERENTIELS[cle] = contenu;
        DIAGNOSTIC.lus.push({ fichier: f, type: 'titre', promotion: contenu.formation.titre_court });
      } else {
        DIAGNOSTIC.erreurs.push({ fichier: f, raison: 'ni RACE ni référentiel de titre' });
      }
    } catch (e) {
      // Un JSON mal formé ne doit pas empêcher les autres de se charger : il est
      // signalé dans le rapport de synchronisation, pas fatal.
      DIAGNOSTIC.erreurs.push({ fichier: f, raison: e.message });
    }
  }
  break;
}

// ── Contenu des syllabi ─────────────────────────────────────────────────────
//
// Le plan de formation donne la structure — blocs, modules, volumes. Il ne dit
// rien de ce qui est enseigné. Ce contenu vit dans les programmes Word, extrait
// par outils/extraire-syllabus.mjs vers referentiels/syllabi/<clé>.json, et
// rattaché aux modules du plan par referentiels/syllabi/alignement.json, table
// relue et validée à la main.
//
// Jusqu'au 05/10/2026 le champ notions_cles était posé vide en dur ici. La
// cartographie ne pouvait donc tracer aucun lien entre blocs, et les alertes de
// coordination n'avaient rien à comparer : elles se calculent sur les notions
// partagées. C'est ce raccord qui manquait.
//
// Le rattachement n'est pas de un à un. Un module du plan peut recevoir
// plusieurs syllabi — le plan tient en une ligne ce que le programme découpe en
// trois TD. Et un syllabus peut alimenter plusieurs modules — une option
// dédoublée entre deux parcours au choix suit le même enseignement.
const SYLLABI = {};      // clé de titre -> Map('bloc§intitulé module' -> contenu)
DIAGNOSTIC.syllabi = { dossier: null, titres: [], erreurs: [] };

(function chargerSyllabi() {
  if (!DIAGNOSTIC.dossier) return;
  const dossier = path.join(DIAGNOSTIC.dossier, 'syllabi');
  let alignement;
  try {
    alignement = JSON.parse(fs.readFileSync(path.join(dossier, 'alignement.json'), 'utf-8'));
  } catch (e) {
    // Absence d'alignement : les syllabi restent inertes, le reste fonctionne.
    DIAGNOSTIC.syllabi.erreurs.push({ fichier: 'alignement.json', raison: e.message });
    return;
  }
  DIAGNOSTIC.syllabi.dossier = dossier;

  for (const titre of alignement.titres || []) {
    let modules;
    try {
      // Deux promotions d'un même titre partagent un seul fichier de syllabi :
      // le programme ISME décrit les deux années d'un coup. L'alignement dit
      // lequel lire ; à défaut, c'est le fichier du nom de la promotion.
      const brut = JSON.parse(fs.readFileSync(path.join(dossier, (titre.source || titre.cle) + '.json'), 'utf-8'));
      // Plusieurs fiches peuvent porter le même intitulé — trois « Semaines
      // intensives », deux « Éloquence & art oratoire » — avec des contenus
      // différents. Les regrouper par intitulé plutôt que retenir la première
      // évite d'en perdre deux sur trois.
      modules = new Map();
      for (const src of brut.sources || [])
        for (const m of src.modules || []) {
          if (!m.titre) continue;
          const lot = modules.get(m.titre) || [];
          lot.push(m);
          modules.set(m.titre, lot);
        }
    } catch (e) {
      DIAGNOSTIC.syllabi.erreurs.push({ fichier: (titre.source || titre.cle) + '.json', raison: e.message });
      continue;
    }

    const parModule = new Map();
    let rattaches = 0, introuvables = [];
    for (const lien of titre.liens || []) {
      const lot = modules.get(lien.syllabus);
      if (!lot || !lot.length) { introuvables.push(lien.syllabus); continue; }
      const k = lien.bloc + '§' + lien.module_pf;
      const cumul = parModule.get(k) || { notions_cles: [], seances: [], objectif: '', programme: [], syllabi: [] };
      for (const syl of lot) {
        // Trois liens vers le même module, chacun tirant le même lot de fiches :
        // sans garde, séances et programme seraient comptés trois fois.
        if (cumul.syllabi.includes(syl.titre)) continue;
        for (const n of syl.notions_cles || [])
          if (n && !cumul.notions_cles.includes(n)) cumul.notions_cles.push(n);
        for (const sc of syl.seances || []) cumul.seances.push(sc);
        for (const pr of syl.programme || []) cumul.programme.push(pr);
        if (!cumul.objectif && syl.objectif) cumul.objectif = syl.objectif;
        cumul.syllabi.push(syl.titre);
      }
      parModule.set(k, cumul);
      rattaches++;
    }
    SYLLABI[titre.cle] = parModule;
    DIAGNOSTIC.syllabi.titres.push({
      cle: titre.cle, modules_syllabus: Array.from(modules.values()).reduce((n, l) => n + l.length, 0), liens: rattaches,
      modules_alimentes: parModule.size,
      notions: Array.from(parModule.values()).reduce((n, c) => n + c.notions_cles.length, 0),
      introuvables,
    });
  }
})();

// Applique le contenu d'un syllabus à un module du plan. Sans rattachement, le
// module repart avec des champs vides : absence de contenu, non absence de
// module.
function contenuModule(cleTitre, blocId, titreModule) {
  const table = SYLLABI[cleTitre];
  const c = table && table.get(blocId + '§' + titreModule);
  return {
    notions_cles: c ? c.notions_cles : [],
    seances: c ? c.seances : [],
    objectif: c ? c.objectif : '',
    programme: c ? c.programme : [],
    _syllabi: c ? c.syllabi : [],
  };
}

// ── Familles de notions ─────────────────────────────────────────────────────
//
// Les notions des syllabi ne se répètent jamais mot pour mot : « Structuration
// d'une veille dynamique » et « Rappels fondamentaux et enjeux de la veille »
// parlent de la même chose sans partager un seul terme signifiant. Aucun
// rapprochement automatique ne peut donc relier deux modules — et le relier
// par mots communs produirait un graphe faux, où le bloc créatif rejoindrait
// le bloc diagnostic parce que tous deux comportent une « restitution ».
//
// Le regroupement est donc fait hors ligne, relu à la main, et versionné dans
// referentiels/notions/familles-<promotion>.json. Ici on ne fait que le lire et
// en tirer trois choses : les familles portées par chaque module, les liens
// entre blocs, et les signaux de résonance. Aucun appel à un modèle en
// production, aucune clé, rien qui tombe.
const FAMILLES = {};     // clé de promotion -> { parModule, liste }
DIAGNOSTIC.familles = { titres: [], erreurs: [] };

(function chargerFamilles() {
  if (!DIAGNOSTIC.dossier) return;
  const dossier = path.join(DIAGNOSTIC.dossier, 'notions');
  let fichiers = [];
  try { fichiers = fs.readdirSync(dossier).filter(f => /^familles-.+\.json$/.test(f)); }
  catch (e) { return; }                       // dossier absent : rien à relier

  for (const f of fichiers) {
    const cle = f.replace(/^familles-/, '').replace(/\.json$/, '');
    try {
      const brut = JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf-8'));
      const parModule = new Map();            // intitulé de module -> [familles]
      const liste = [];
      for (const fam of brut.familles || []) {
        if (!fam.modules || !fam.modules.length) continue;
        liste.push({ libelle: fam.libelle, type: fam.type, blocs: fam.blocs || [],
                     modules: fam.modules, competences: fam.competences || [],
                     notions: (fam.notions || []).length });
        for (const m of fam.modules) {
          if (!parModule.has(m)) parModule.set(m, []);
          parModule.get(m).push(fam.libelle);
        }
      }
      FAMILLES[cle] = { parModule, liste };
      DIAGNOSTIC.familles.titres.push({ cle, familles: liste.length,
        transversales: liste.filter(x => x.blocs.length > 1).length });
    } catch (e) {
      DIAGNOSTIC.familles.erreurs.push({ fichier: f, raison: e.message });
    }
  }
})();

// Liens entre blocs : deux blocs sont reliés quand une même famille est
// enseignée dans l'un et dans l'autre. Le poids est le nombre de familles
// partagées — c'est lui qui donnera l'épaisseur du trait.
function liensEntreBlocs(liste) {
  const paires = new Map();
  for (const fam of liste) {
    const blocs = [...new Set(fam.blocs)].sort();
    for (let i = 0; i < blocs.length; i++)
      for (let j = i + 1; j < blocs.length; j++) {
        const k = blocs[i] + '§' + blocs[j];
        if (!paires.has(k)) paires.set(k, { a: blocs[i], b: blocs[j], familles: [] });
        paires.get(k).familles.push(fam.libelle);
      }
  }
  return [...paires.values()].map(p => ({ ...p, poids: p.familles.length }))
    .sort((x, y) => y.poids - x.poids);
}

// Signaux de résonance. Seul le niveau 3 est calculable aujourd'hui : il ne
// demande que le contenu annoncé. Les niveaux 1 et 2 — approfondissement voulu
// d'une année sur l'autre, recoupement entre deux intervenants qui ne se sont
// pas parlé — exigent de savoir QUI enseigne quoi. Aucun référentiel ne le
// porte : cette information viendra de l'émargement CESAR.
function signauxResonance(liste) {
  return liste
    .filter(f => f.modules.length > 1 && f.type !== 'posture')
    .map(f => {
      const plusieursBlocs = [...new Set(f.blocs)].length > 1
      const message = plusieursBlocs
        ? f.libelle + ' est enseigné dans ' + f.modules.length + ' modules répartis sur les blocs '
          + [...new Set(f.blocs)].sort().join(', ') + '. Articulation à expliciter : '
          + f.modules.slice(0, 4).join(' · ') + (f.modules.length > 4 ? ' · …' : '')
        : f.libelle + ' revient dans ' + f.modules.length + ' modules du même bloc ('
          + f.blocs[0] + ') : ' + f.modules.slice(0, 4).join(' · ') + (f.modules.length > 4 ? ' · …' : '')
      return { niveau: 3, notion: f.libelle, modules: f.modules, blocs: [...new Set(f.blocs)].sort(),
               competences: f.competences, transversale: plusieursBlocs, message }
    })
    .sort((a, b) => (b.transversale - a.transversale) || (b.modules.length - a.modules.length))
}

// ── Résolution des codes portés par un module ───────────────────────────────
//
// Corrigé le 08/10/2026. Un bloc portait ses compétences dans la numérotation
// officielle (C.20-II, C1.1) pendant que ses modules gardaient le code brut du
// plan de formation (C20, C1). Les deux ne se rencontraient jamais : toutes les
// compétences des deux options du MSMC — six sur vingt-huit — s'affichaient
// « sans créneau » quoi qu'on enseigne, et les modules du Bachelor CDC
// n'affichaient aucune compétence. Le défaut était invisible sur B01 à B03,
// dont les codes ne portent pas de suffixe.
//
// Trois formes de correspondance, dans cet ordre :
//   1. code identique                  C13   -> C.13
//   2. code suffixé par sa spécialité  C20   -> C.20-II dans le bloc 4-II
//   3. code d'activité                 C1    -> C1.1, C1.2 (Bachelor CDC)
function codeNu(v) { return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

// Les codes d'un module et de ses sous-modules réunis. Le plan de formation
// décrit certains enseignements en deux étages : une ligne conteneur qui porte
// le volume — « Hackathon Websérie », 35 h — et des sous-lignes qui portent le
// détail et, seules, les codes de compétence. Ne lire que l'étage supérieur
// rendait muets les sept Hackathons du M2 MSMC, soit 245 heures, le plus gros
// volume du titre, et la « Méthodologie Bloc 3 » qui, elle, n'a réellement
// aucun code au plan.
function codesAvecSousModules(m) {
  const codes = [...(m.competences_liees || [])];
  for (const sm of (m.sous_modules || [])) {
    for (const c of (sm.competences_liees || [])) if (!codes.includes(c)) codes.push(c);
  }
  return codes;
}

// Code déduit de l'intitulé du module, en dernier recours.
//
// Le plan de formation du MDEC numérote ses modules par la compétence qu'ils
// servent, suivie d'un numéro d'ordre : C101, C102 et C103 « Maîtriser Excel »,
// « Gestion budget » et « Analyse financière » servent tous les trois C.10. Le
// code n'est écrit en colonne E que sur le premier de la série ; les suivants
// la laissent vide. Quatorze modules et 245 heures restaient ainsi sans
// compétence sur les deux années.
//
// La déduction est volontairement tenue en laisse : on ne l'applique qu'à un
// module dépourvu de tout code, et le résultat doit exister au référentiel
// officiel ET appartenir au bloc où le module se trouve. Faute de quoi on ne
// déduit rien — un module sans compétence est un fait à constater, pas un vide
// à remplir au jugé.
function deduireCodesDuTitre(titre, candidats) {
  const m = String(titre || '').match(/^\s*C\.?\s?(\d+)(?:\s*[-–]\s*(\d+))?/i);
  if (!m) return [];
  const connus = new Set(candidats.map(c => codeNu(c.id)));
  // « C35-36 » cite deux compétences d'un coup.
  const second = m[2] ? ['C' + m[2]] : [];
  let n = m[1];
  while (n.length) {
    if (connus.has(codeNu('C' + n))) {
      return ['C' + n, ...second.filter(x => connus.has(codeNu(x)))];
    }
    n = n.slice(0, -1);   // C102 -> C10 -> C1
  }
  return [];
}

function resoudreCodesModule(competences, codesBruts) {
  const out = new Set();
  for (const brut of codesBruts || []) {
    const n = codeNu(brut);
    if (!n) continue;
    for (const c of competences) {
      const id = codeNu(c.id);
      const act = codeNu(c.activite || '');
      // Le suffixe de spécialisation est un chiffre romain en fin de code. Le
      // test sur le reste évite qu'un C1 happe un C11 par simple préfixe.
      const suffixe = id.startsWith(n) && /^I{1,3}$/.test(id.slice(n.length));
      if (id === n || suffixe || (act && act === n)) out.add(c.id);
    }
  }
  return [...out];
}

// Traduit un référentiel du dépôt vers la forme attendue par l'application.
//
// Deux conversions importantes :
//   1. les blocs portent des codes d'activité (C1…C13) ; l'application compte
//      des compétences. On développe donc chaque activité en ses compétences
//      RNCP (C1.1, C2.1, C2.2…), seule granularité qui fasse un dénominateur
//      honnête — 22 compétences pour le Bachelor CDC, pas 13.
//   2. les compétences seulement évoquées par un module transverse restent à
//      l'écart : les compter reviendrait à déclarer enseigné ce qui ne l'est pas.
function versFormatApplication(ref) {
  const race = RACES[ref.formation.rncp];
  const cleTitre = ref._cle || '';
  const fam = FAMILLES[cleTitre] || { parModule: new Map(), liste: [] };
  const parActivite = new Map((race ? race.activites : []).map(a => [a.id, a]));

  // Compétences officielles rangées par bloc du RACE : le filet de sécurité de
  // la déduction par intitulé, qui ne doit jamais sortir du bloc concerné.
  const parBlocRace = new Map();
  for (const a of (race ? race.activites : [])) {
    for (const c of (a.competences || [])) {
      const k = a.bloc || '';
      if (!parBlocRace.has(k)) parBlocRace.set(k, []);
      parBlocRace.get(k).push({ id: c.id, libelle: c.libelle, activite: a.code || a.id });
    }
  }
  // Tous les référentiels ne déclarent pas leur correspondance de blocs : celle
  // du MDEC est vide parce qu'il a été extrait par un autre outil. Quand les
  // identifiants coïncident avec ceux du RACE — B01…B05 — ils font office de
  // correspondance. Sinon on ne déduit rien.
  const competencesBloc = b => parBlocRace.get(b.bloc_race || '') || parBlocRace.get(b.id) || [];

  const blocs = (ref.blocs || []).map(b => {
    // Les compétences officielles sont déjà résolues par l'outil d'extraction,
    // qui seul connaît le mode de numérotation du titre — activités pour le
    // Bachelor, compétences pour le Mastère. Les recalculer ici les gonflait :
    // « C1 » lu comme une activité rendait deux compétences au lieu d'une.
    let competences = (b.competences_race || []).map(c => ({
      id: c.id, libelle: c.libelle, activite: c.activite || '',
    }));
    if (!competences.length) {
      for (const code of (b.competences || [])) {
        const act = parActivite.get(code);
        if (!act) { competences.push({ id: code, libelle: '' }); continue; }
        for (const c of act.competences) {
          competences.push({ id: c.id, libelle: c.libelle, activite: act.id, activite_libelle: act.libelle });
        }
      }
    }

    const modules = (b.modules || []).map((m, i) => ({
      id: b.id + '-M' + (i + 1),
      titre: m.titre,
      volume: m.volume,
      intervenant: '',
      // Codes officiels, seuls comparables aux compétences du bloc. Le code
      // brut du plan de formation est conservé à côté : c'est lui qu'on relit
      // quand un rattachement surprend.
      competences_liees: (() => {
        const bruts = codesAvecSousModules(m);
        const resolus = resoudreCodesModule(competences, bruts);
        if (resolus.length || bruts.length) return resolus;
        // Déduction depuis l'intitulé, cadrée par le bloc officiel. Une
        // compétence ainsi portée pour la première fois rejoint la liste du
        // bloc : celle-ci se construit à partir de ce que les modules portent,
        // et un module qui la porte seul ne doit pas s'en trouver exclu.
        const deduits = resoudreCodesModule(competencesBloc(b), deduireCodesDuTitre(m.titre, competencesBloc(b)));
        for (const id of deduits) {
          if (competences.some(c => codeNu(c.id) === codeNu(id))) continue;
          const officielle = competencesBloc(b).find(c => codeNu(c.id) === codeNu(id));
          if (officielle) competences.push({ ...officielle, deduite: true });
        }
        return deduits;
      })(),
      competences_liees_pf: m.competences_liees || [],
      competences_plage: !!m.competences_plage,
      ...contenuModule(cleTitre, b.id, m.titre),
      familles: fam.parModule.get(m.titre) || [],
      epreuve: m.epreuve || '',
      commentaire: m.commentaire || '',
      sous_modules: m.sous_modules || [],
      ...(m.nature === 'option' ? { nature: 'option', option_groupe: m.option_groupe, parcours: m.parcours } : {}),
    }));

    return {
      id: b.id,
      titre: b.titre,
      nature: b.nature || 'obligatoire',
      option_groupe: b.option_groupe || '',
      competences,
      competences_mentionnees: b.competences_mentionnees || [],
      // Un bloc se définit par la ou les épreuves qui le sanctionnent.
      epreuves: b.epreuves || [],
      modules,
    };
  });

  // Modules sans épreuve rattachée : conservés à part, jamais promus en bloc.
  // Les afficher comme un sixième bloc laissait croire à une certification qui
  // n'existe pas, et gonflait la cartographie.
  // Un module hors bloc n'appartient à aucun bloc : ses codes se résolvent
  // contre l'ensemble des compétences du titre.
  const toutesCompetences = blocs.flatMap(b => b.competences || []);
  const horsBloc = (ref.modules_hors_bloc || []).map((m, i) => ({
    id: 'HB-M' + (i + 1),
    titre: m.titre,
    volume: m.volume,
    section: m.section || '',
    competences_liees: resoudreCodesModule(toutesCompetences, codesAvecSousModules(m)),
    competences_liees_pf: m.competences_liees || [],
    competences_plage: !!m.competences_plage,
    ...contenuModule(cleTitre, 'HB', m.titre),
    familles: fam.parModule.get(m.titre) || [],
    intervenant: '',
  }));

  return {
    modules_hors_bloc: horsBloc,
    epreuves_planifiees: ref.epreuves_planifiees || [],
    formation: {
      titre: ref.formation.titre,
      rncp: ref.formation.rncp,
      etablissement: race ? race.certificateur : '',
      annee: '2026-27',
      annees_couvertes: [ref.formation.annee_cycle],
    },
    blocs,
    intervenants: [],
    // Les familles portées par plus d'un module : ce sont elles qui font la
    // trame transversale du diplôme, et le graphe de la cartographie.
    notions_transversales: fam.liste.filter(f => f.modules.length > 1)
      .sort((a, b) => b.modules.length - a.modules.length),
    liens_blocs: liensEntreBlocs(fam.liste),
    alertes_detectees: signauxResonance(fam.liste),
    _campus: ref.formation.campus,
    _cycle: ref.formation.annee_cycle,
    _source: 'referentiels/' + ref.formation.titre_court,
    _genere_le: ref.genere_le || '',
    _couverture: ref.couverture || {},
    _notions: blocs.reduce((n, b) => n + b.modules.reduce((k, m) => k + (m.notions_cles || []).length, 0), 0)
            + horsBloc.reduce((n, m) => n + (m.notions_cles || []).length, 0),
    _controles_ok: (ref.controles || []).every(c => c.ok),
    _familles: fam.liste.length,
  };
}

module.exports = { REFERENTIELS, RACES, SYLLABI, FAMILLES, versFormatApplication, DIAGNOSTIC };
