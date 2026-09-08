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
    // Enseignements conservés mais rattachés à aucun bloc : ils ne sont
    // sanctionnés par aucune épreuve de certification, donc n'en constituent
    // pas un. Ils portent néanmoins C13, qu'aucun bloc numéroté ne couvre.
    sections_conservees: {
      'Compétences transversales': {
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
    ],

    // Rapprochement entre l'épreuve déclarée sur un bloc et sa ligne au
    // calendrier, qui porte durée et date de programmation. Les deux libellés
    // ne se ressemblent pas toujours : le lien se déclare.
    calendrier_epreuves: {
      'EC MSPR VST': 'Oral VST',
      'EC MSPR Groka': 'GroKa',
      'EC MSPR Brief Créatif': 'Brief Créa',
      "EC MSPR Compet' nat'": 'Grand final',
    },
  },
};
