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
  const parActivite = new Map((race ? race.activites : []).map(a => [a.id, a]));

  const blocs = (ref.blocs || []).map(b => {
    const competences = [];
    for (const code of (b.competences || [])) {
      const act = parActivite.get(code);
      if (!act) { competences.push({ id: code, libelle: '' }); continue; }
      for (const c of act.competences) {
        competences.push({ id: c.id, libelle: c.libelle, activite: act.id, activite_libelle: act.libelle });
      }
    }

    const modules = (b.modules || []).map((m, i) => ({
      id: b.id + '-M' + (i + 1),
      titre: m.titre,
      volume: m.volume,
      intervenant: '',
      competences_liees: m.competences_liees || [],
      competences_plage: !!m.competences_plage,
      notions_cles: [],
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
    notions_cles: [],
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
    _controles_ok: (ref.controles || []).every(c => c.ok),
  };
}

module.exports = { REFERENTIELS, RACES, versFormatApplication, DIAGNOSTIC };
