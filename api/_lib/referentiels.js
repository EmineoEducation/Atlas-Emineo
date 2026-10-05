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
  const parActivite = new Map((race ? race.activites : []).map(a => [a.id, a]));

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
      competences_liees: m.competences_liees || [],
      competences_plage: !!m.competences_plage,
      ...contenuModule(cleTitre, b.id, m.titre),
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
  const horsBloc = (ref.modules_hors_bloc || []).map((m, i) => ({
    id: 'HB-M' + (i + 1),
    titre: m.titre,
    volume: m.volume,
    section: m.section || '',
    competences_liees: m.competences_liees || [],
    competences_plage: !!m.competences_plage,
    ...contenuModule(cleTitre, 'HB', m.titre),
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
    notions_transversales: [],
    alertes_detectees: [],
    _campus: ref.formation.campus,
    _cycle: ref.formation.annee_cycle,
    _source: 'referentiels/' + ref.formation.titre_court,
    _genere_le: ref.genere_le || '',
    _couverture: ref.couverture || {},
    _notions: blocs.reduce((n, b) => n + b.modules.reduce((k, m) => k + (m.notions_cles || []).length, 0), 0)
            + horsBloc.reduce((n, m) => n + (m.notions_cles || []).length, 0),
    _controles_ok: (ref.controles || []).every(c => c.ok),
  };
}

module.exports = { REFERENTIELS, RACES, SYLLABI, versFormatApplication, DIAGNOSTIC };
