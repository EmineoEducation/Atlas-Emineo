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

const REFERENTIELS = {
  'bach-cdc': require('../../referentiels/bach-cdc.json'),
};

// Le RACE est chargé à part : plusieurs titres peuvent partager un référentiel
// de certification, et il n'a pas à être dupliqué dans chaque fichier de titre.
const RACES = {
  '39741': require('../../referentiels/race-39741.json'),
};

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
      modules,
    };
  });

  return {
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

module.exports = { REFERENTIELS, RACES, versFormatApplication };
