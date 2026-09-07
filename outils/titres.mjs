// outils/titres.mjs — Atlas Éminéo
//
// Déclaration des titres du campus du Mans et de la façon de lire leur plan de
// formation. Ajouter un titre se fait ici, jamais dans le code de l'extracteur.
//
// Champs :
//   source              chemin du plan de formation, versionné dans documents/
//   race                référentiel officiel transcrit, dans referentiels/
//   feuille             onglet portant l'année certifiante
//   annee_cycle         B3, M1 ou M2 — détermine la promotion alimentée
//   sections_conservees sections à traiter comme blocs bien qu'elles ne portent
//                       pas le motif « Bloc NN », avec la liste nominative des
//                       modules retenus. Décision pédagogique, pas technique.
//   sections_exclues    sections écartées du périmètre certifiant

export const TITRES = {
  'bach-cdc': {
    source: 'documents/bach-cdc/PF-Bachelor_CDC_25-27_Vdef.xlsx',
    race: 'referentiels/race-39741.json',
    feuille: 'Pro3',
    rncp: '39741',
    titre: 'Bachelor Chargé de communication',
    titreCourt: 'Bach CDC',
    campus: 'Le Mans',
    annee_cycle: 'B3',

    // Les onglets Pro 1 et Pro2 décrivent les deux années de prépa, non
    // certifiantes : elles ne sont pas lues.
    sections_conservees: {
      // Porte C13, qu'aucun bloc numéroté ne couvre. L'exclure reviendrait à
      // laisser une compétence certifiante sans aucun enseignement.
      'Compétences transversales': {
        id: 'B06',
        titre: 'Compétences transversales',
        modules: [
          'Anglais',
          'Expression Ecrite et Orale',
          'Personal Branding',
          'Méthodologie compétition',
        ],
      },
    },
    sections_exclues: [
      'Remise à niveau',
      'Organisation pédagogique',
      'Epreuves de certification',
    ],
  },
};
