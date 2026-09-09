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

    // Les trois parcours intensifs sont décrits dans un second tableau, sous
    // le principal. Un seul est suivi par étudiant.
    section_options: "^programme des .*intensives",
    motif_option: '^option\\b',
    module_options: "intensives?\\s+d'option",
    groupe_options: 'Semaines intensives',

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

  // ── Mastère MSMC — profil MediaSchool ──────────────────────────────────────
  // Mise en page distincte de CESACOM : neuf colonnes, et un niveau « A.n »
  // intercalé entre le bloc et ses modules, qui porte l'épreuve certifiante.
  // Les deux spécialisations sont exclusives — un étudiant en suit une seule,
  // et le total annoncé du plan ne les compte qu'une fois.
  'm1-msmc': {
    source: 'documents/msmc/PF_MSMC__2026-28_Mediaschool.xlsx',
    race: 'referentiels/race-38504.json',
    feuille: 'Mst MSMC1 ',            // l'espace finale est dans le fichier
    rncp: '38504',
    titre: 'Manager des stratégies marketing et communication — M1',
    titreCourt: 'M1 MSMC',
    campus: 'Le Mans',
    annee_cycle: 'M1',
    premiere_ligne: 4,
    colonnes: {
      titre: 0, volume: 1, seances: 2, sequencage: 3, competences: 4,
      evaluation: 5, competence_bloc: 6, epreuve_ecrit: 7, epreuve_oral: 8,
      epreuve: null, commentaire: null,
    },
    motifs_blocs: [
      '^TC\\s+BC\\s*0*(\\d+)\\s*:',
      '^TC\\s+Bloc\\s*0*(\\d+)\\s*:',
      '^SPE\\s+BLOC\\s*0*(\\d+)\\s*:',
    ],
    motif_activite: '^A\\.\\s*\\d+',
    lignes_ignorees: ['^Sp[eé]cialisation$'],
    sections_conservees: {
      'Bloc transversal': { titre: 'Bloc transversal' },
      // Le classeur écrit « Compétitions » en M1 et « Compétition » en M2 :
      // les deux orthographes sont déclarées plutôt que devinées.
      'Bloc transversal : Compétitions': { titre: 'Bloc transversal : Compétitions' },
      'Bloc transversal : Compétition': { titre: 'Bloc transversal : Compétitions' },
    },
    // Le plan cite les compétences du RACE (C1…C22), pas ses activités. Dans
    // une spécialisation, « C20 » désigne C.20-II ou C.20-III selon le bloc :
    // le suffixe se lit sur la correspondance de bloc ci-dessous.
    codes_pf: 'competences',
    correspondance_blocs: { B01: 'B01', B02: 'B02', B03: 'B03', B05: 'B04-II', B06: 'B04-III' },
    blocs_exclusifs: { 'Spécialisation': ['B05', 'B06'] },
  },

  'm2-msmc': {
    source: 'documents/msmc/PF_MSMC__2026-28_Mediaschool.xlsx',
    race: 'referentiels/race-38504.json',
    feuille: 'Mst MSMC2',
    rncp: '38504',
    titre: 'Manager des stratégies marketing et communication — M2',
    titreCourt: 'M2 MSMC',
    campus: 'Le Mans',
    annee_cycle: 'M2',
    premiere_ligne: 4,
    colonnes: {
      titre: 0, volume: 1, seances: 2, sequencage: 3, competences: 4,
      evaluation: 5, competence_bloc: 6, epreuve_ecrit: 7, epreuve_oral: 8,
      epreuve: null, commentaire: null,
    },
    motifs_blocs: [
      '^TC\\s+BC\\s*0*(\\d+)\\s*:',
      '^TC\\s+Bloc\\s*0*(\\d+)\\s*:',
      '^SPE\\s+BLOC\\s*0*(\\d+)\\s*:',
    ],
    motif_activite: '^A\\.\\s*\\d+',
    lignes_ignorees: ['^Sp[eé]cialisation$'],
    sections_conservees: {
      'Bloc transversal': { titre: 'Bloc transversal' },
      // Le classeur écrit « Compétitions » en M1 et « Compétition » en M2 :
      // les deux orthographes sont déclarées plutôt que devinées.
      'Bloc transversal : Compétitions': { titre: 'Bloc transversal : Compétitions' },
      'Bloc transversal : Compétition': { titre: 'Bloc transversal : Compétitions' },
    },
    // Le plan cite les compétences du RACE (C1…C22), pas ses activités. Dans
    // une spécialisation, « C20 » désigne C.20-II ou C.20-III selon le bloc :
    // le suffixe se lit sur la correspondance de bloc ci-dessous.
    codes_pf: 'competences',
    correspondance_blocs: { B01: 'B01', B02: 'B02', B03: 'B03', B05: 'B04-II', B06: 'B04-III' },
    blocs_exclusifs: { 'Spécialisation': ['B05', 'B06'] },
  },
};
