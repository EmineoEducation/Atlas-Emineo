const { getDB } = require('./_lib/db');
const { hashPassword } = require('./_lib/auth');

// ─── Données pédagogiques Le Mans (générées le 24/07/2026) ───────────────────
const DATA_LE_MANS = {
  '39741': {"formation":{"titre":"Bachelor Chargé de communication","etablissement":"Cesacom / Sup de Vinci","rncp":"39741","annee":"2026-27"},"blocs":[{"id":"B1","titre":"Mener une veille stratégique créative et tendancielle","competences":[{"id":"C1","libelle":"Définir un process de veille stratégique"},{"id":"C2","libelle":"Analyser les tendances et le comportement consommateur"}],"modules":[{"id":"M1","titre":"Méthodologies de la veille","competences_liees":[],"volume":"21h","sequençage":"S1 – 6 séances de 3h30","objectif":"Permettre à l’étudiant de concevoir et gérer un dispositif de veille professionnel, d’intégrer l’IA et l’automatisation, d’analyser et restituer les tendances de manière claire et créative, et d’alime","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M2","titre":"Communication durable et soutenable","competences_liees":[],"volume":"14h","sequençage":"S1 – 4 séances de 3h30","objectif":"Permettre à l’étudiant de maîtriser les enjeux, outils et pratiques de la communication responsable, de questionner les stratégies traditionnelles, de proposer des alternatives crédibles et de piloter","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M3","titre":"Connaissance et comportement du consommateur","competences_liees":[],"volume":"21h","sequençage":"S1 – 6 séances de 3h30","objectif":"Permettre à l’étudiant d’analyser et segmenter les consommateurs à partir de données et d’observations, de décrypter les leviers psychologiques, sociaux, culturels et situationnels de l’acte d’achat,","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M24","titre":"RAN Fondamentaux du marketing et de la communication","competences_liees":[],"volume":"7h","sequençage":"S1 – 2 séances de 3h30 (semaine de rentrée)","objectif":"Permettre à chaque étudiant d’atteindre un socle commun de connaissances et de méthodes, de s’intégrer dans la dynamique de la promo, de collaborer sur des études de cas et de préparer la suite du cur","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M28","titre":"Anglais","competences_liees":[],"volume":"21h","sequençage":"S1/S2 – 6 séances de 3h30","objectif":"Permettre à l’étudiant d’interagir de manière fluide, précise et stratégique en anglais, de convaincre et de défendre une recommandation, de s’adapter à des contextes internationaux et d’enrichir sa p","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M30","titre":"Personal Branding","competences_liees":[],"volume":"7h","sequençage":"S1/S2 – 2 séances de 3h30","objectif":"Permettre à l’étudiant d’optimiser sa visibilité et sa crédibilité sur le marché du travail, d’affirmer sa singularité, de structurer son discours et de rendre ses compétences lisibles et attractives","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M31","titre":"Compétition","competences_liees":[],"volume":"35h (compétition régionale) + 42h (compétition nationale) - (dont 1 semaine de compétition régionale + 1 séance de cadrage + 1 séance de débrief)","sequençage":"S1+S2","objectif":"Objectif pédagogique","notions_cles":["Programme préconisé"],"intervenant":""}]},{"id":"B2","titre":"Définir une stratégie et un plan de communication","competences":[{"id":"C3","libelle":"Élaborer la stratégie et le positionnement de marque"},{"id":"C4","libelle":"Construire le plan marketing et de communication"}],"modules":[{"id":"M4","titre":"Stratégie et positionnement de la marque","competences_liees":[],"volume":"17,5h","sequençage":"S1 – 5 séances de 3h30","objectif":"Permettre à l’étudiant de maîtriser les outils et méthodes d’analyse stratégique de marque, de formaliser une plateforme de marque, d’identifier les leviers de différenciation et de concevoir une stra","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M5","titre":"Marketing (plan marketing stratégique & plan de communication)","competences_liees":[],"volume":"21h","sequençage":"S1 – 6 séances de 3h30","objectif":"Permettre à l’étudiant de relier analyse de marché, stratégie de marque et plan d’action opérationnel, d’élaborer des plans marketing et de communication cohérents, argumentés et activables, et de pil","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M6","titre":"Stratégies des marques : identité visuelle, storytelling et réputation","competences_liees":[],"volume":"17,5h","sequençage":"S1 – 5 séances de 3h30","objectif":"Permettre à l’étudiant de maîtriser la construction d’une identité visuelle forte, la mise en récit de la marque (storytelling) et la gestion proactive de la réputation (e-réputation, crise, influence","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M7","titre":"SEO/SEA","competences_liees":[],"volume":"10,5h","sequençage":"S2 – 3 séances de 3h30","objectif":"Permettre à l’étudiant de concevoir et piloter une stratégie de visibilité digitale complète, d’optimiser la présence d’une marque sur les moteurs de recherche, de croiser les données SEO/SEA pour max","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M8","titre":"SMA/SMO (Social Media Advertising / Social Media Optimization)","competences_liees":[],"volume":"10,5h","sequençage":"S2 – 3 séances de 3h30","objectif":"Permettre à l’étudiant de piloter des actions digitales performantes : choix des plateformes, création d’audiences, paramétrage de campagnes, optimisation des contenus organiques, suivi et analyse des","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M12","titre":"Relations presse","competences_liees":[],"volume":"14h","sequençage":"S1 – 7 séances de 2h ou 4 séances de 3h30","objectif":"Permettre à l’étudiant de comprendre le rôle stratégique des relations presse dans la communication d’une marque, de construire des messages et outils adaptés aux exigences des journalistes et des méd","notions_cles":[],"intervenant":""},{"id":"M16","titre":"IA Génératives : Méthodologie de prompting","competences_liees":[],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à l’étudiant de structurer et rédiger des prompts performants pour différents usages (création, synthèse, analyse, automatisation), d’optimiser la collaboration homme-IA, d’anticiper les lim","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M18","titre":"Écriture créative et storytelling","competences_liees":[],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à l’étudiant de concevoir et rédiger des contenus narratifs créatifs, stratégiques et adaptés aux enjeux de la marque ou du client ; de structurer des histoires engageantes, d’incarner une v","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M19","titre":"Semaines intensives","competences_liees":[],"volume":"35h de semaine intensive X 2","sequençage":"S1/S2","objectif":"Cartographier les leviers digitaux au service d’un objectif de marque.\nDéfinir des cibles, objectifs et indicateurs clés pour une stratégie digitale.\nProposer une stratégie éditoriale simple et ciblée","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M20","titre":"Semaines intensives","competences_liees":[],"volume":"35h de semaine intensive X 2","sequençage":"S1/S2","objectif":"Analyser un univers de marque et proposer une direction artistique.\nCréer un logo, une palette graphique et des supports cohérents.\nMettre en scène une expérience visuelle ou un storytelling visuel.\nA","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M21","titre":"Semaines intensives","competences_liees":[],"volume":"35h de semaine intensive X 2","sequençage":"S1/S2","objectif":"Identifier les objectifs, cibles et formats d’un événement pertinent.\nConstruire un déroulé d’événement réaliste et engageant.\nProposer des dispositifs d’activation ou d’interaction innovants.\nIntégre","notions_cles":["Programme préconisé"],"intervenant":""}]},{"id":"B3","titre":"Piloter l'équipe projet","competences":[{"id":"C6","libelle":"Maîtriser l'éloquence et la relation presse"},{"id":"C7","libelle":"Manager l'équipe et gérer les projets"}],"modules":[{"id":"M9","titre":"Management d’équipe & Gestion de projets (méthodologies)","competences_liees":[],"volume":"24,5h","sequençage":"S2 – 7 séances de 3h30","objectif":"Permettre à l’étudiant de structurer, piloter et évaluer un projet de communication en équipe, d’adopter une posture de leader collaboratif et d’appliquer les méthodes et outils adaptés à la gestion d","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M10","titre":"Éloquence & art oratoire","competences_liees":[],"volume":"14h","sequençage":"S2 – 4 séances de 3h30","objectif":"Permettre à l’étudiant d’affiner sa prise de parole, de renforcer la force de conviction et l’adaptabilité de son expression orale, de maîtriser les techniques rhétoriques et de gérer la dimension émo","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M11","titre":"Éloquence & art oratoire","competences_liees":[],"volume":"14h","sequençage":"S1-S2 (4 séances de 3h30 réparties en octobre-novembre)","objectif":"Définir une posture d’agence originale qui traduit leur vision de la communication.\nConcevoir tous les éléments constitutifs d’une identité professionnelle (nom, baseline, univers graphique, ton rédac","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M22","titre":"Budget et négociation","competences_liees":[],"volume":"17,5h","sequençage":"S1/S2 – 5 séances de 3h30","objectif":"Permettre à l’étudiant de piloter la dimension financière d’un projet de communication (devis, marges, suivi, reporting), de négocier efficacement dans des contextes variés (clients, fournisseurs, par","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M29","titre":"Expression écrite et orale","competences_liees":[],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à l’étudiant de renforcer la qualité de ses productions écrites et orales, de gagner en justesse, en clarté et en singularité, d’adapter son expression à des contextes variés (soutenance, sy","notions_cles":["Programme préconisé"],"intervenant":""}]},{"id":"B4","titre":"Réaliser des contenus de communication","competences":[{"id":"C9","libelle":"Concevoir et produire des contenus créatifs"},{"id":"C10","libelle":"Maîtriser les outils de production (PAO, vidéo, web)"}],"modules":[{"id":"M13","titre":"PAO / Adobe","competences_liees":[],"volume":"17,5h","sequençage":"S1/S2 – 5 séances de 3h30","objectif":"Permettre à l’étudiant de produire des livrables créatifs et techniquement irréprochables, adaptés à différents supports (print, digital, social media), de piloter une production graphique de A à Z, d","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M14","titre":"Vidéo / Photo","competences_liees":[],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à l’étudiant de produire un contenu audiovisuel ou photographique de niveau professionnel, de l’idéation à la diffusion, en intégrant narration, direction artistique, contraintes techniques,","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M15","titre":"Wordpress","competences_liees":[],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à l’étudiant de concevoir, réaliser et administrer un site WordPress sur-mesure, en intégrant les enjeux d’ergonomie, de référencement, d’accessibilité, de performance et de conformité régle","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M17","titre":"Sémiologie de la communication et des couleurs","competences_liees":[],"volume":"10,5h","sequençage":"S2 – 3 séances de 3h30","objectif":"Permettre à l’étudiant de décrypter et d’utiliser les signes, symboles et couleurs dans la communication visuelle, d’optimiser l’impact des messages, de prendre en compte les dimensions culturelles, é","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M25","titre":"RAN Wordpress","competences_liees":[],"volume":"7h","sequençage":"S1 – 2 séances de 3h30 (semaine de rentrée)","objectif":"Permettre à chaque étudiant d’atteindre un socle commun de compétences techniques sur Wordpress, de s’intégrer dans la dynamique de la promo, de collaborer sur des mini-projets et de préparer la suite","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M26","titre":"RAN Photo/Video","competences_liees":[],"volume":"7h","sequençage":"S1 – 2 séances de 3h30 (semaine de rentrée)","objectif":"Permettre à chaque étudiant d’atteindre un socle commun de compétences techniques en prise de vue photo et vidéo, de collaborer sur des mini-projets, de s’intégrer dans la dynamique de la promo et de","notions_cles":["Programme préconisé"],"intervenant":""},{"id":"M27","titre":"RAN PAO","competences_liees":[],"volume":"7h","sequençage":"S1 – 2 séances de 3h30 (semaine de rentrée)","objectif":"Permettre à chaque étudiant d’atteindre un socle commun de compétences techniques en PAO, de collaborer sur des mini-projets, de s’intégrer dans la dynamique de la promo et de préparer la suite du cur","notions_cles":["Programme préconisé"],"intervenant":""}]},{"id":"B5","titre":"Évaluer la performance du projet de communication","competences":[{"id":"C11","libelle":"Maîtriser le budget et la négociation"},{"id":"C12","libelle":"Analyser les indicateurs de performance"},{"id":"C13","libelle":"Maîtriser l'anglais et l'expression professionnelle"}],"modules":[{"id":"M23","titre":"Indicateurs de Performance (KPI’s)","competences_liees":[],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à l’étudiant de relier objectifs, actions et résultats à travers des KPI adaptés, de collecter et d’analyser des données quantitatives et qualitatives, d’argumenter des recommandations d’opt","notions_cles":["Programme préconisé"],"intervenant":""}]}],"intervenants":[],"notions_transversales":["Veille stratégique et tendances","Communication responsable et RSE","IA générative et prompting","Identité visuelle et PAO","Storytelling et brand content"],"alertes_detectees":[{"niveau":2,"notion":"Veille stratégique","modules":["M1","M2"],"message":"Méthodologies de la veille (M1) et communication durable (M2) partagent le BC1 — séquençage S1 à coordonner."},{"niveau":3,"notion":"IA générative","modules":["M14","M17"],"message":"IA générative mentionnée en BC4 (prompting) et potentiellement en BC2 (stratégie) — expliciter la progression d'usage."}]},
  '38504': {"formation":{"titre":"Manager des stratégies marketing et communication","etablissement":"Cesacom / MediaSchool","rncp":"38504","annee":"2026-28"},"blocs":[{"id":"B1","titre":"Diagnostiquer le positionnement et la proposition de valeur distinctive de la marque","competences":[{"id":"C.1","libelle":"Organiser un système de veille stratégique sur l'environnement de la marque"},{"id":"C.2","libelle":"Évaluer l'impact des tendances repérées et leurs modalités de prise en compte"},{"id":"C.3","libelle":"Piloter la réalisation d'études qualitatives et quantitatives"},{"id":"C.4","libelle":"Interpréter les résultats des études pour préconiser les orientations"},{"id":"C.5","libelle":"Analyser le positionnement et l'identité de la marque"},{"id":"C.6","libelle":"Clarifier le positionnement et la proposition de valeur — plateforme de marque"}],"modules":[{"titre":"Veille dynamique (panel, méthodes d’interview) et imaginaires de la consommation","bloc_id":"B1","competences_liees":["C.1","C.2"],"volume":"21h","sequençage":"S1-S2 – 6 séances de 3,5h","objectif":"Permettre à l'étudiant·e de concevoir et déployer un dispositif de veille avancé, en mobilisant panels et méthodes d'interview pour collecter des insights consommateurs. Note : ce module porte sur les","notions_cles":["Programme préconisé"],"intervenant":"","id":"M1"},{"titre":"TD : Méthodologie Dossier de veille","bloc_id":"B1","competences_liees":["C.1","C.2"],"volume":"14h","sequençage":"","objectif":"Permettre à l'étudiant·e de construire un dossier de veille stratégique rigoureux et actionnable, conforme aux exigences de l'épreuve de certification BC1 A.1 (Note de synthèse). Développer la capacit","notions_cles":[],"intervenant":"","id":"M2"},{"titre":"TD : Accompagnement veille (dossier de veille)","bloc_id":"B1","competences_liees":["C.1","C.2"],"volume":"7h","sequençage":"S1 – 2 séances de 3h30 (en cours d'année, synchronisées avec les jalons du dossier de veille)","objectif":"Accompagner chaque étudiant·e dans la construction progressive de son dossier de veille (BC1 A.1) : validation de la marque choisie, structuration des périmètres de veille, montée en puissance sur la","notions_cles":["Programme préconisé"],"intervenant":"","id":"M3"},{"titre":"Méthodologie Pack Marque","bloc_id":"B1","competences_liees":["C.3","C.4","C.5","C.6"],"volume":"21h","sequençage":"S1 – 6 séances de 3h30","objectif":"Permettre à chaque étudiant de maîtriser la méthodologie complète du pack marque : cadrage des études, collecte et analyse de données, diagnostic interne/externe, formulation de la proposition de vale","notions_cles":["Programme préconisé"],"intervenant":"","id":"M4"},{"titre":"Études marketing stratégique et communication omnicanale","bloc_id":"B1","competences_liees":["C.3","C.4"],"volume":"21h","sequençage":"S1/S2 – 6 séances de 3h30","objectif":"Permettre à l’étudiant de maîtriser la démarche complète d’étude marketing stratégique : cadrage, choix méthodologique, collecte et analyse de données, synthèse, formulation d’insights et recommandati","notions_cles":["Programme préconisé"],"intervenant":"","id":"M5"},{"titre":"Insights et Analyse consommateurs","bloc_id":"B1","competences_liees":["C.4"],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à l’étudiant d’analyser et d’interpréter les données issues d’études consommateurs (entretiens, focus groups, panels, data), de formuler des insights actionnables, de segmenter les publics,","notions_cles":["Programme préconisé"],"intervenant":"","id":"M6"},{"titre":"Analyse de la stratégie de positionnement de la marque","bloc_id":"B1","competences_liees":["C.5","C.6"],"volume":"17,5h","sequençage":"S1/S2 – 5 séances de 3h30","objectif":"Permettre à l’étudiant de réaliser un diagnostic stratégique approfondi du positionnement d’une marque, de formuler une analyse critique et argumentée, et de préparer la formalisation de la plateforme","notions_cles":["Programme préconisé"],"intervenant":"","id":"M7"},{"titre":"Éloquence et préparation à l’épreuve de certification orale (Pack Marque)","bloc_id":"B1","competences_liees":["C.3","C.6"],"volume":"10,5h","sequençage":"S2 – 3 séances de 3h30, à programmer en juin, en amont des soutenances","objectif":"Permettre à chaque étudiant de transformer son pack marque en une présentation orale convaincante, de maîtriser les codes de l’épreuve, de s’entraîner à la prise de parole longue et à la gestion des q","notions_cles":["Programme préconisé"],"intervenant":"","id":"M8"},{"titre":"Anglais professionnel de la communication","bloc_id":"B1","competences_liees":[],"volume":"21h","sequençage":"S1/S2 – 6 séances de 3h30","objectif":"Permettre à chaque étudiant d’interagir de façon fluide, précise et stratégique en anglais, de produire des documents professionnels bilingues, de s’adapter à la diversité des contextes et d’enrichir","notions_cles":["Programme préconisé"],"intervenant":"","id":"M35"},{"titre":"Séminaire d’intégration et de remise à niveau PAO","bloc_id":"B1","competences_liees":[],"volume":"7h","sequençage":"S1 – Semaine de rentrée (2 séances de 3h30)","objectif":"Permettre à chaque étudiant, qu’il soit issu ou non du cursus B1-B3, d’atteindre un socle commun de compétences PAO, de s’approprier les outils et méthodes nécessaires à la réussite des projets du M1,","notions_cles":["Programme préconisé"],"intervenant":"","id":"M36"},{"titre":"Séminaire d’intégration et de remise à niveau Vidéo","bloc_id":"B1","competences_liees":[],"volume":"7h","sequençage":"S1 – Semaine de rentrée (2 séances de 3h30)","objectif":"Permettre à chaque étudiant, issu ou non du cursus B1-B3, d’atteindre un socle commun de compétences vidéo, de s’approprier les outils et méthodes nécessaires à la réussite des projets du M1, et de pr","notions_cles":["Programme préconisé"],"intervenant":"","id":"M37"},{"titre":"Séminaire d’intégration et de remise à niveau Photo","bloc_id":"B1","competences_liees":[],"volume":"7h","sequençage":"S1 – Semaine de rentrée (2 séances de 3h30)","objectif":"Permettre à chaque étudiant d’atteindre un socle commun de compétences photo, de s’approprier les outils et méthodes nécessaires à la réussite des projets du M1, et de préparer l’accès aux modules ava","notions_cles":["Programme préconisé"],"intervenant":"","id":"M38"},{"titre":"Compétition","bloc_id":"B1","competences_liees":[],"volume":"6 jours","sequençage":"Une compétition régionale en décembre, la compétition nationale en juin","objectif":"Permettre à chaque étudiant de partager ses compétences dans le cadre d’une compétition en temps réel afin de répondre à un brief annonceur.","notions_cles":["Programme préconisé"],"intervenant":"","id":"M39"},{"titre":"Personal Branding publication de contenu : expertise métier","bloc_id":"B1","competences_liees":[],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à chaque étudiant de structurer et valoriser son expertise métier, de produire un contenu à forte valeur ajoutée, d’optimiser sa présence en ligne et d’attirer l’attention des recruteurs à l","notions_cles":["Programme préconisé"],"intervenant":"","id":"M40"},{"titre":"TD : Finalisation et soutenance du dossier de veille (BC1 A.1)","bloc_id":"B1","competences_liees":["C.1","C.2"],"volume":"3,5h","sequençage":"","objectif":"Module de finalisation : accompagner la dernière ligne droite avant le rendu du dossier BC1 A.1. Ce module CT complète le TD Accompagnement veille (Bloc 1) en ciblant la relecture finale, la conformit","notions_cles":[],"intervenant":"","id":"M41"},{"titre":"Compétition","bloc_id":"B1","competences_liees":[],"volume":"35h (compétition régionale) + 42h (compétition nationale) - (dont 1 semaine de compétition régionale + 1 séance de cadrage + 1 séance de débrief)","sequençage":"S1+S2","objectif":"Traduire un brief client en recommandation stratégique de communication.\nAnalyser une situation annonceur en mobilisant les outils d’analyse appris en B3 (études, veille, benchmarks, personae…).\nConst","notions_cles":["Programme préconisé"],"intervenant":"","id":"M42"}],"activites":["A.1 Pilotage d'une veille stratégique","A.2 Conduite d'études marketing centrées Data","A.3 Réalisation du diagnostic marketing"]},{"id":"B2","titre":"Élaborer une stratégie marketing communication alignée avec les valeurs de la marque","competences":[{"id":"C.7","libelle":"Fixer les objectifs qualitatifs et quantitatifs de la stratégie"},{"id":"C.8","libelle":"Déterminer le cœur de cible et les cibles secondaires — segmentation"},{"id":"C.9","libelle":"Définir les axes de communication déclinant les engagements RSE"},{"id":"C.10","libelle":"Choisir les canaux et modalités de communication selon une approche omnicanal"},{"id":"C.11","libelle":"Évaluer l'opportunité des actions en produisant l'estimation de leur ROI"},{"id":"C.12","libelle":"Établir la projection financière de la stratégie à conduire"}],"modules":[{"titre":"Élaboration de la stratégie de marque (plateforme de marque)","bloc_id":"B2","competences_liees":["C.7","C.8","C.9"],"volume":"14h","sequençage":"S1-S2 – 4 séances de 3,5h","objectif":"Permettre à l’étudiant de traduire le diagnostic stratégique (marché, consommateurs, positionnement) en une plateforme de marque claire, différenciante et activable, servant de socle à la stratégie ma","notions_cles":["Programme préconisé"],"intervenant":"","id":"M9"},{"titre":"Brand content : Éditorialisation et narration de marque","bloc_id":"B2","competences_liees":["C.8","C.9"],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à l’étudiant de structurer et déployer une stratégie éditoriale de marque, de scénariser des contenus engageants et différenciants, d’adapter la narration aux cibles et aux canaux, et de pré","notions_cles":["Programme préconisé"],"intervenant":"","id":"M10"},{"titre":"Fondamentaux de la RSE/ESS","bloc_id":"B2","competences_liees":["C.9"],"volume":"10,5h","sequençage":"S2 – 3 séances de 3h30","objectif":"Permettre à chaque étudiant de maîtriser les concepts, référentiels et enjeux de la RSE et de l’ESS, d’identifier les leviers d’action pour les marques, de distinguer engagement sincère et opportunist","notions_cles":["Programme préconisé"],"intervenant":"","id":"M11"},{"titre":"TD : Accompagnement Mégaka – Élaborer une stratégie marketing communication","bloc_id":"B2","competences_liees":["C.7","C.8","C.9"],"volume":"7h","sequençage":"","objectif":"Accompagner les étudiant·es dans la construction et la finalisation de leur recommandation stratégique marketing communication (Mégaka), en s'assurant de la présence et de la cohérence des 6 exigences","notions_cles":[],"intervenant":"","id":"M12"},{"titre":"Référencements (SEO, SEA, SMO, SMA)","bloc_id":"B2","competences_liees":[],"volume":"14h","sequençage":"S2 – 4 séances de 3h30","objectif":"Permettre à chaque étudiant d’élaborer une stratégie de référencement complète, multi-leviers et adaptée à la stratégie de marque : choix des canaux, optimisation technique et éditoriale, gestion de c","notions_cles":["Programme préconisé"],"intervenant":"","id":"M13"},{"titre":"Adobe – outils créatifs numériques au service de la stratégie","bloc_id":"B2","competences_liees":[],"volume":"17,5h","sequençage":"S1/S2 – 5 séances de 3h30","objectif":"Permettre à l’étudiant de piloter la création de livrables créatifs et techniquement irréprochables, adaptés à différents supports (print, digital, social media), de justifier ses choix graphiques et","notions_cles":["Programme préconisé"],"intervenant":"","id":"M14"},{"titre":"Photographie : techniques de prise de vue","bloc_id":"B2","competences_liees":[],"volume":"10,5h","sequençage":"S1/S2 – 3 séances de 3h30","objectif":"Permettre à l’étudiant de réaliser des images professionnelles répondant à un brief stratégique, d’argumenter ses choix techniques et esthétiques, d’intégrer la photographie dans une stratégie de comm","notions_cles":["Programme préconisé"],"intervenant":"","id":"M15"},{"titre":"Fabrication : de l’idée à la réalisation","bloc_id":"B2","competences_liees":[],"volume":"10,5h","sequençage":"S2 – 3 séances de 3h30","objectif":"Permettre à l’étudiant de transformer une idée créative ou stratégique en produit fini : maîtriser les étapes de fabrication, anticiper les contraintes, optimiser les choix techniques et budgétaires,","notions_cles":["Programme préconisé"],"intervenant":"","id":"M16"},{"titre":"Wordpress","bloc_id":"B2","competences_liees":[],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à l’étudiant de maîtriser Wordpress comme levier central de la présence digitale de la marque : création de sites avancés, optimisation de l’expérience utilisateur, intégration des outils de","notions_cles":["Programme préconisé"],"intervenant":"","id":"M17"},{"titre":"Budget Pilotage financier & négociation","bloc_id":"B2","competences_liees":["C.11","C.12"],"volume":"14h","sequençage":"S2 – 4 séances de 3h30","objectif":"Permettre à chaque étudiant d’élaborer, piloter et défendre un budget de communication, de négocier efficacement avec les parties prenantes (internes et externes), d’anticiper les risques financiers e","notions_cles":["Programme préconisé"],"intervenant":"","id":"M18"}],"activites":["A.4 Définition des orientations stratégiques","A.5 Évaluation des conditions de déploiement"]},{"id":"B3","titre":"Piloter le déploiement d'une stratégie marketing communication responsable","activites":["A.6 Cadrage de la réalisation des actions","A.7 Management des parties prenantes","A.8 Évaluation continue des résultats"],"competences":[{"id":"C.13","libelle":"Élaborer les documents de référence — cahier des charges, brief"},{"id":"C.14","libelle":"Organiser la mise en œuvre des actions et la conduite de projet"},{"id":"C.15","libelle":"Constituer les équipes internes impliquées dans la réalisation"},{"id":"C.16","libelle":"Animer l'écosystème des parties prenantes par un management collaboratif"},{"id":"C.17","libelle":"Gérer le portefeuille de prestataires au regard des engagements RSE"},{"id":"C.18","libelle":"Organiser la mesure d'impact de la stratégie et ses indicateurs clés"},{"id":"C.19","libelle":"Interpréter les métriques et décider des mesures correctives"}],"modules":[],"_note":"Bloc obligatoire du référentiel (juillet 2023). Aucun module du plan de formation Le Mans ne lui est rattaché à ce jour : à instruire avec la Direction des programmes."},{"id":"B4II","titre":"Engager l'innovation et la transformation digitale de la communication de la marque","competences":[{"id":"C.20-II","libelle":"Identifier les facteurs de rupture et d'innovation liés aux technologies digitales"},{"id":"C.21-II","libelle":"Déterminer les innovations à implémenter et anticiper les facteurs de risque"},{"id":"C.22-II","libelle":"Définir les stratégies d'accompagnement des acteurs internes"}],"modules":[{"titre":"Spé Marque & transfo : Benchmarking (analyse des stratégies concurrentielles)","bloc_id":"B4II","competences_liees":["C.20-II"],"volume":"10,5h","sequençage":"S2 – 3 séances de 3h30","objectif":"Permettre à l’étudiant de piloter une démarche de benchmarking stratégique, d’identifier les axes d’innovation et de rupture dans les stratégies concurrentielles, de restituer une analyse opérationnel","notions_cles":["Programme préconisé"],"intervenant":"","id":"M19"},{"titre":"Spé Marque & transfo : Supports de communication innovants","bloc_id":"B4II","competences_liees":[],"volume":"14h","sequençage":"S2 – 4 séances de 3h30","objectif":"Permettre à chaque étudiant d’explorer, de benchmarker et de prototyper des supports de communication nouveaux ou émergents, d’argumenter leur intégration dans une stratégie de marque innovante, et de","notions_cles":["Programme préconisé"],"intervenant":"","id":"M20"},{"titre":"Spé Marque & transfo : Référencement – Google Analytics (approfondissement)","bloc_id":"B4II","competences_liees":[],"volume":"14h","sequençage":"S2 – 4 séances de 3h30","objectif":"Permettre à chaque étudiant d’exploiter pleinement Google Analytics dans une logique d’optimisation de la stratégie digitale, de piloter l’accompagnement des équipes sur la data, d’intégrer la mesure","notions_cles":["Programme préconisé"],"intervenant":"","id":"M21"},{"titre":"Spé Marque & transfo : Design Thinking","bloc_id":"B4II","competences_liees":[],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à chaque étudiant de piloter une démarche d’innovation centrée utilisateur, d’intégrer la co-création et l’expérimentation dans la stratégie de marque, d’argumenter l’intérêt du Design Think","notions_cles":["Programme préconisé"],"intervenant":"","id":"M22"},{"titre":"Spé Marque & transfo : Webdesign et Design responsive","bloc_id":"B4II","competences_liees":[],"volume":"10,5h","sequençage":"S2 – 3 séances de 3h30","objectif":"Permettre à chaque étudiant de concevoir, prototyper et argumenter des interfaces et supports digitaux innovants, inclusifs et performants, en cohérence avec la stratégie de marque et les attentes des","notions_cles":["Programme préconisé"],"intervenant":"","id":"M23"},{"titre":"Spé Marque & transfo : UX/UI","bloc_id":"B4II","competences_liees":[],"volume":"14h","sequençage":"S2 – 4 séances de 3h30","objectif":"Permettre à chaque étudiant de piloter la conception d’interfaces et d’expériences utilisateurs en mode projet, d’argumenter et de prototyper des solutions UX/UI adaptées à des enjeux stratégiques, et","notions_cles":["Programme préconisé"],"intervenant":"","id":"M24"},{"titre":"Spé Marque & transfo : Wordpress perfectionnement & NoCode","bloc_id":"B4II","competences_liees":[],"volume":"17,5h","sequençage":"S2 – 5 séances de 3h30","objectif":"Permettre à chaque étudiant de concevoir et déployer des solutions web avancées (site, landing page, portail, espace collaboratif…) en s’appuyant sur Wordpress et les outils NoCode (Webflow, Notion, A","notions_cles":["Programme préconisé"],"intervenant":"","id":"M25"}],"optionnel":true},{"id":"B4III","titre":"Développer la stratégie créative de la marque dans des supports et contenus originaux","competences":[{"id":"C.20-III","libelle":"Définir les axes générateurs des contenus de la marque"},{"id":"C.21-III","libelle":"Générer des idées originales de contenus et de nouveaux formats"},{"id":"C.22-III","libelle":"Concrétiser les idées dans les canaux et supports de communication"}],"modules":[{"titre":"Spé Strat Créa : Histoire de l’art et tendances contemporaines","bloc_id":"B4III","competences_liees":[],"volume":"10,5h","sequençage":"S1/S2 – 3 séances de 3h30","objectif":"Permettre à chaque étudiant d’enrichir son univers créatif, de contextualiser ses choix esthétiques et conceptuels, d’identifier les tendances émergentes et de les intégrer de façon pertinente et diff","notions_cles":["Programme préconisé"],"intervenant":"","id":"M26"},{"titre":"Spé Strat Créa : Direction artistique","bloc_id":"B4III","competences_liees":[],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à chaque étudiant de maîtriser la démarche de direction artistique : du concept à la déclinaison opérationnelle, en passant par la gestion d’équipe créative, la veille, la justification des","notions_cles":["Programme préconisé"],"intervenant":"","id":"M27"},{"titre":"Spé Strat Créa : Créativité et pensée innovante","bloc_id":"B4III","competences_liees":[],"volume":"14h","sequençage":"S1/S2 – 4 séances de 3h30","objectif":"Permettre à chaque étudiant de générer, structurer et défendre des idées créatives et innovantes dans des contextes stratégiques, de piloter des ateliers d’idéation, d’intégrer l’expérimentation et la","notions_cles":["Programme préconisé"],"intervenant":"","id":"M28"},{"titre":"Spé Strat Créa : Éthique professionnelle (propriété artistique, intellectuelle, …)","bloc_id":"B4III","competences_liees":[],"volume":"7h","sequençage":"S2 – 2 séances de 3h30","objectif":"Permettre à chaque étudiant d’évoluer dans un cadre respectueux des droits d’auteur et des pratiques responsables ; de sécuriser ses créations et celles de ses équipes ; d’anticiper les risques juridi","notions_cles":["Programme préconisé"],"intervenant":"","id":"M29"},{"titre":"Spé Strat Créa : Fabrication – RSE et communication visuelle responsable","bloc_id":"B4III","competences_liees":[],"volume":"7h","sequençage":"S2 – 2 séances de 3h30","objectif":"Permettre à chaque étudiant de transformer une intention créative en produit fini responsable : intégrer la RSE à toutes les étapes de fabrication, arbitrer entre innovation, impact environnemental, c","notions_cles":["Programme préconisé"],"intervenant":"","id":"M30"},{"titre":"Spé Strat Créa : Outils créatifs et workflow collaboratif","bloc_id":"B4III","competences_liees":[],"volume":"10,5h","sequençage":"S2 – 3 séances de 3h30","objectif":"Permettre à chaque étudiant de piloter un projet créatif collaboratif, de choisir et d’articuler les bons outils selon le contexte et les besoins, d’optimiser la gestion de l’information, la co-créati","notions_cles":["Programme préconisé"],"intervenant":"","id":"M31"},{"titre":"Spé Strat Créa : PAO/Adobe : Logotype & typo","bloc_id":"B4III","competences_liees":[],"volume":"10,5h","sequençage":"S2 – 3 séances de 3h30","objectif":"Permettre à chaque étudiant de piloter la création d’un logotype et d’une identité typographique forte, cohérente et différenciante, en lien avec la plateforme de marque, et de préparer des livrables","notions_cles":["Programme préconisé"],"intervenant":"","id":"M32"},{"titre":"Spé Strat Créa : Adobe Première","bloc_id":"B4III","competences_liees":[],"volume":"10,5h","sequençage":"S2 – 3 séances de 3h30","objectif":"Permettre à chaque étudiant de réaliser des vidéos professionnelles et impactantes, en lien avec un brief stratégique ou créatif, de justifier ses choix techniques et narratifs, et de préparer des liv","notions_cles":["Programme préconisé"],"intervenant":"","id":"M33"},{"titre":"Spé Strat Créa : Adobe – Montage Photo","bloc_id":"B4III","competences_liees":[],"volume":"10,5h","sequençage":"S2 – 3 séances de 3h30","objectif":"Permettre à chaque étudiant de réaliser des montages photo professionnels et créatifs, alignés avec un brief stratégique ou créatif, de justifier ses choix esthétiques et techniques, et de préparer de","notions_cles":["Programme préconisé"],"intervenant":"","id":"M34"}],"optionnel":true}],"intervenants":[],"notions_transversales":["RSE / communication responsable","Brand content et narration de marque","IA générative appliquée à la communication","Médiaplanning et SEO/SEA","Plateforme de marque","Adobe / outils créatifs numériques","Veille stratégique"],"alertes_detectees":[{"niveau":2,"notion":"Veille stratégique","modules":["M1","M2","M3","M41"],"message":"Quatre modules alimentent le dossier de veille (C.1/C.2) — articuler explicitement la progression entre le cours et les trois TD."},{"niveau":2,"notion":"RSE / communication responsable","modules":["M11","M9","M10"],"message":"La RSE est portée par C.9 en B2 et par C.13 et C.17 en B3 — fil conducteur à rendre visible sur les deux années."}],"_note_referentiel":"Référentiel officiel MSMC RNCP 38504 (LMD MediaSchool, juillet 2023). Bloc optionnel 4-I (Influence et réputation, C.20-I à C.22-I) non déployé chez Éminéo — volontairement exclu. Certification = blocs 1, 2 et 3 cumulés + un bloc optionnel."},
  '41295': {"formation":{"titre":"Master Manager des ressources humaines","etablissement":"ISME","rncp":"41295","annee":"2026-28"},"blocs":[{"id":"B1","titre":"Élaborer la stratégie RH de son périmètre","competences":[{"id":"C1","libelle":"Piloter la veille stratégique RH digitale"},{"id":"C2","libelle":"Manager l'innovation RH et sociale"},{"id":"C3","libelle":"Conduire un audit RH"},{"id":"C4","libelle":"Définir une stratégie RH RSE"}],"modules":[{"id":"M1","titre":"Module 1 : Veille stratégique RH digitale et réglementaire","activite":"A1 – Pilotage de la veille stratégique RH","competences_liees":["C1"],"volume":"21 heures","objectif":"Expliquer les enjeux stratégiques et opérationnels de la veille RH réglementaire et digitale pour sécuriser les pratiques et éclairer la décision RH. \nConcevoir un dispositif de veille RH structuré in","notions_cles":["1. Fondamentaux de la veille stratégique appliquée aux RH","2. Panorama réglementaire RH et veille juridique","3. Outils digitaux et IA pour la veille réglementaire","4. Méthodes d’analyse et de partage de la veille","5. Étude de cas intégrée : conception d’un dispositif de veille RH"],"intervenant":""},{"id":"M2","titre":"Module 2 : Veille économique, sociale et technologique avec outils IA","activite":"A1 – Pilotage de la veille stratégique RH","competences_liees":["C1"],"volume":"21 heures","objectif":"1) Expliquer les enjeux de la veille économique, sociale et technologique pour la fonction RH dans un contexte de transformations profondes du travail et des organisations à l’horizon 2026-2028. \n2) I","notions_cles":["2. Sources et indicateurs pour la veille économique et sociale RH","3. Veille technologique et innovations RH","5. De la veille à la décision : scénarios et recommandations RH"],"intervenant":""},{"id":"M3","titre":"Module 3 : Management de l’innovation sociale et organisationnelle","activite":"A2 – Management de l’innovation RH","competences_liees":["C2.1"],"volume":"21 heures","objectif":"1) Comprendre les concepts clés de l’innovation sociale et organisationnelle dans le contexte des ressources humaines, en lien avec les évolutions du futur du travail et les enjeux RSE. \n2) Appliquer","notions_cles":["1. Introduction à l’innovation sociale et organisationnelle RH","2. Méthodes collaboratives pour l’innovation","3. Gestion des disruptions et intégration des transitions","c) Stratégies pour une innovation responsable, inclusive, éthique.","4. Développement de la capacité de transformation"],"intervenant":""},{"id":"M4","titre":"Module 4 : Méthodes collaboratives et transformation digitale RH.","activite":"A2 – Management de l’innovation RH.","competences_liees":["C2.1"],"volume":"24,5 heures.","objectif":"1) Comprendre les principes des méthodes collaboratives et leur rôle dans l'accompagnement de la transformation digitale des ressources humaines. \n2) Mettre en œuvre des démarches participatives et in","notions_cles":["1. Fondements des méthodes collaboratives en management RH","b) Bénéfices et limites dans la gestion de la transformation digitale RH.","c) Typologie des acteurs et mobilisation des parties prenantes.","2. Démarches participatives pour la transformation digitale RH","b) Inclusion et diversité dans les processus participatifs."],"intervenant":""},{"id":"M5","titre":"Module 5 : Diagnostic stratégique RH et analyse des processus","activite":"A3 – Conduite d’audit RH","competences_liees":["C3.1"],"volume":"21 heures","objectif":"1) Réaliser un diagnostic stratégique RH en tenant compte de l’écosystème global de l’entreprise et ses spécificités. \n2) Identifier les besoins en ressources clés, les forces et faiblesses RH à court","notions_cles":["1. Principes du diagnostic stratégique en ressources humaines","a) Concepts clés : diagnostic, audit, diagnostic stratégique RH.","c) Le rôle du diagnostic dans l’élaboration de la stratégie RH.","d) Étude de cas d’introduction.","2. Identification et analyse des ressources clés"],"intervenant":""},{"id":"M6","titre":"Module 6 : Outils d’audit RH et utilisation de data analytics","activite":"A3 – Conduite d’audit RH","competences_liees":["C3.1"],"volume":"21 heures","objectif":"1) Maîtriser les outils digitaux et méthodologies nécessaires à la conduite d’un audit RH complet et performant. \n2) S’appuyer sur les données RH et les techniques de data analytics pour étayer ses an","notions_cles":["1. Introduction aux outils d’audit RH","c) Présentation des bonnes pratiques d’utilisation.","2. Collecte et préparation des données RH","a) Sources des données : bases internes, SIRH, enquêtes, données externes.","b) Nettoyage, structuration et validation des données pour analyse fiable."],"intervenant":""},{"id":"M7","titre":"Module 7 : Stratégie RH responsable et indicateurs clés (KPI)","activite":"A4 – Définition et évaluation d’une stratégie RH RSE","competences_liees":["C4.1"],"volume":"21 heures","objectif":"1) Définir une stratégie RH durable et inclusive alignée sur la vision et la stratégie globale de l’entreprise, en intégrant les enjeux de transitions numérique, écologique et démographique. \n2) Ident","notions_cles":["1. Enjeux et cadre de la stratégie RH responsable","2. Construction d’une stratégie RH durable et inclusive","4. Dispositifs de pilotage, tableaux de bord et reporting RH responsable","5. Évaluation et ajustement de la stratégie RH responsable"],"intervenant":""},{"id":"M8","titre":"Module 8 : RSE et transition écologique en RH","activite":"A4 – Définition et évaluation d’une stratégie RH RSE","competences_liees":["C4.1"],"volume":"24,5 heures","objectif":"1) Comprendre les concepts, enjeux et cadres réglementaires de la responsabilité sociétale des entreprises (RSE) appliqués aux ressources humaines. \n2) Mettre en œuvre une stratégie RH intégrée à la t","notions_cles":["1. Introduction à la RSE et à la transition écologique en entreprise","a) Définitions clés : RSE, développement durable, ODD, neutralité carbone.","d) Cas pratiques d’intégration de la RSE dans les politiques RH.","2. Analyse de matérialité et hiérarchisation des priorités RSE","c) Intégration des résultats dans la gouvernance et la stratégie RH."],"intervenant":""},{"id":"M9","titre":"Module 9 : Priorisation RSE et analyse de matérialité RH","activite":"A4 – Définition et évaluation d’une stratégie RH RSE","competences_liees":["C4.2"],"volume":"14 heures","objectif":"1) Réaliser une analyse de matérialité pour identifier, prioriser et hiérarchiser les enjeux RSE majeurs relatifs aux ressources humaines dans un contexte organisationnel donné. \n2) Identifier et cart","notions_cles":["1. Introduction à l’analyse de matérialité en contexte RSE","2. Identification et cartographie des parties prenantes","c) Outils de cartographie des parties prenantes et diagnostics associés.","3. Méthodes et outils pour la réalisation d’une analyse de matérialité","c) Gestion de la communication et de la transparence autour des résultats."],"intervenant":""},{"id":"M10","titre":"Module 10 : Gestion des risques RH avec IA prédictive et approche effectuale","activite":"A4 – Définition et évaluation d’une stratégie RH RSE","competences_liees":["C4.3"],"volume":"21 heures","objectif":"1) Identifier et évaluer les risques stratégiques et opérationnels liés aux ressources humaines dans un contexte organisationnel complexe. \n2) Utiliser des outils d’intelligence artificielle prédictiv","notions_cles":["1. Introduction à la gestion des risques RH","a) Définitions fondamentales : risques stratégiques, opérationnels, RH.","c) Normes et cadres réglementaires applicables.","d) Rôle de la fonction RH dans la gestion des risques organisationnels.","2. Outils et méthodes d’analyse des risques RH"],"intervenant":""}]},{"id":"B2","titre":"Manager les data, projets et équipes RH","competences":[{"id":"C5","libelle":"Manager la donnée RH (SIRH, analytics)"},{"id":"C6","libelle":"Conduire des projets de transformation durable"},{"id":"C7","libelle":"Manager des équipes en mode hybride"}],"modules":[{"id":"M19","titre":"Module 11 : Gouvernance et sécurité des données RH (RGPD et éthique)","activite":"A5 – Management de la donnée RH","competences_liees":["C5.1"],"volume":"28 heures","objectif":"1) Comprendre les principes de gouvernance des données RH dans un cadre réglementaire strict, notamment le RGPD. \n2) Maîtriser les exigences de sécurité, protection et confidentialité des données pers","notions_cles":["1. Comprendre le cadre de la gouvernance des données RH et du RGPD","3. Enjeux éthiques et usages responsables des données RH","4. Construire un mini‑plan de gouvernance des données RH à son niveau"],"intervenant":""},{"id":"M20","titre":"Module 12 : Stratégie RH data-driven et outils digitaux","activite":"A5 – Management de la donnée RH","competences_liees":["C5.1"],"volume":"17,5 heures","objectif":"1. Comprendre ce que signifie une stratégie RH “data‑Driven” et en quoi l’utilisation structurée des données change la manière de décider en RH, du quotidien opérationnel jusqu’aux choix plus stratégi","notions_cles":["1. Comprendre la logique d’une stratégie RH data-Driven","2. Panorama des outils digitaux RH courants et rôle des SIRH","3. Premières techniques d’analyse et d’interprétation de données RH","4. Cas d’usage concrets et mini-projet de stratégie RH data-driven"],"intervenant":""},{"id":"M21","titre":"Module 13 : SIRH avancé et data analytics RH","activite":"A5 – Management de la donnée RH","competences_liees":["C5.2"],"volume":"17,5 heures","objectif":"1. Maîtriser l'exploration et l'exploitation quotidienne des données disponibles dans les SIRH standards (Eurecia, Lucca, Talentsoft) pour répondre aux besoins opérationnels des managers RH.\n2. Appren","notions_cles":["1. Découverte et navigation dans les SIRH standards","2. Nettoyage et préparation des données RH pratiques","c) Création de colonnes calculées utiles.","3. Analyses statistiques RH essentielles avec Excel","4. Production de rapports RH opérationnels et partage"],"intervenant":""},{"id":"M22","titre":"Module 14 : Visualisation et reporting social interactif","activite":"A5 – Management de la donnée RH","competences_liees":["C5.2"],"volume":"21 heures","objectif":"1. Concevoir des tableaux de bord RH interactifs simples à comprendre et à utiliser par tous les managers, en s'appuyant sur les données disponibles dans les SIRH courants et les outils bureautiques s","notions_cles":["1. Sélection et organisation des indicateurs RH essentiels","2. Création de tableaux de bord avec Excel et Power BI Service gratuit","3. Design et principes de lisibilité pour managers non-data","4. Publication, partage et mise à jour des tableaux de bord"],"intervenant":""},{"id":"M23","titre":"Module 15 : Tableaux de bord RH et décision data-driven","activite":"A5 – Management de la donnée RH","competences_liees":["C5.3"],"volume":"21 heures","objectif":"1. Concevoir et paramétrer des tableaux de bord RH décisionnels intégrant des indicateurs multi-sources (SIRH, données externes, retours qualitatifs) permettant un suivi en temps réel des performances","notions_cles":["1. Fondamentaux des tableaux de bord RH décisionnels","2. Exploitation et Fiabilisation des données pour l'analyse","3. Storytelling data et communication des insights RH","4. Gouvernance, sécurité et prédiction via tableaux de bord"],"intervenant":""},{"id":"M24","titre":"Module 16 : Conception de projets RH durables et inclusifs","activite":"A6 – Conduite de projets de transformation durable","competences_liees":["C6.1"],"volume":"17,5 heures","objectif":"1. Identifier les transitions actuelles et futures du monde du travail (numérique, écologique, démographique) pour concevoir des projets RH anticipant ces évolutions et garantissant la pérennité de l'","notions_cles":["1. Analyse des transitions du monde du travail et impacts RH","2. Méthodologies de conception de projets de transformation RH","3. Intégration RSE et durabilité dans la conception projet","4. Spécification technique et planification projet durable"],"intervenant":""},{"id":"M25","titre":"Module 17 : Méthodologies agiles en gestion de projet RH","activite":"A6 – Conduite de projets de transformation durable","competences_liees":["C6.2"],"volume":"28 heures","objectif":"1. Maîtriser les méthodologies agiles (Scrum, Kanban, SAFe) adaptées aux projets de transformation RH et aux contraintes réglementaires du secteur.\n2. Concevoir et animer des rituels agiles (daily, ré","notions_cles":["1. Fondamentaux des méthodologies agiles appliquées aux projets RH","2. Mise en œuvre des rituels agiles en contexte RH","3. Outils et technologies pour l'agilité RH","4. Conduite du changement et scaling agile RH"],"intervenant":""},{"id":"M26","titre":"Module 18 : Contrôle budgétaire et pilotage financier RH","activite":"A6 – Conduite de projets de transformation durable","competences_liees":["C6.3"],"volume":"24,5 heures","objectif":"1. Élaborer des budgets RH réalistes et détaillés en intégrant les contraintes réglementaires, les priorités stratégiques et les spécificités des projets de transformation durable.\n2. Mettre en place","notions_cles":["1. Construction budgétaire RH : méthodologies et contraintes","2. Outils et techniques de suivi budgétaire en temps réel","3. Collaboration interservices et arbitrages financiers","4. Analyse de rentabilité et calcul ROI projets RH"],"intervenant":""},{"id":"M27","titre":"Module 19 : Animation participative et communication inclusive.","activite":"A7 – Management d’équipes en modes projet et hiérarchique.","competences_liees":["C7.1"],"volume":"14 heures","objectif":"1. Concevoir et animer des dispositifs de travail collectifs favorisant la participation active, l’expression de tous et la co‑construction de solutions RH, en contexte présentiel, distanciel et hybri","notions_cles":["1. Fondements de l’animation participative et de l’intelligence collective","2. Méthodes d’animation collaborative en présentiel et en hybride","3. Communication inclusive au service de la coopération","4. Capitalisation des bonnes pratiques et ancrage dans la durée"],"intervenant":""},{"id":"M28","titre":"Module 20 : Partenariats durables et collaboration responsable","activite":"A7 – Management d’équipes en modes projet et hiérarchique","competences_liees":["C7.2"],"volume":"21 heures","objectif":"1. Cartographier et développer un réseau stratégique de partenaires RH aligné sur les priorités RSE de l'entreprise.\n2. Négocier et contractualiser des collaborations durables intégrant les critères E","notions_cles":["1. Cartographie stratégique des partenaires RH","c) Matrice décisionnelle : impact stratégique vs maturité RSE.","d) Atelier : cartographie 15 partenaires prioritaires secteur (Miro).","2. Négociation et contractualisation responsable","b) Négociation win-win durable : partage valeur, innovation co-créée."],"intervenant":""},{"id":"M29","titre":"Module 21 : Management hybride des équipes et télétravail","activite":"A7 – Management d’équipes en modes projet et hiérarchique","competences_liees":["C7.3"],"volume":"28 heures","objectif":"1. Maîtriser les spécificités du management d'équipes hybrides présentiel/distanciel.\n2. Appliquer des méthodes et techniques de management collaboratives et inclusives adaptées au télétravail.\n3. Sup","notions_cles":["1. Fondamentaux du management hybride et télétravail","a) Typologie des organisations hybrides et enjeux managériaux.","c) Impact sur performance : productivité, créativité, rétention talents.","d) Atelier : autodiagnostic maturité hybride de son organisation.","2. Méthodes et outils de management collaboratif hybride"],"intervenant":""}]},{"id":"B3","titre":"Superviser l'administration du personnel","competences":[{"id":"C8","libelle":"Définir et piloter la politique de rémunération"},{"id":"C9","libelle":"Superviser la production des bulletins de paie"},{"id":"C10","libelle":"Gérer l'administration du personnel"}],"modules":[{"id":"M11","titre":"Module 22 : Stratégies de rémunération et mix salarial digital","activite":"A8 – Définition et pilotage de la politique de rémunération ","competences_liees":["C8.1"],"volume":"28 heures","objectif":"1. Comprendre les différents modèles de rémunération globale adaptés aux contextes d'entreprise PME/ETI et élaborer une politique salariale cohérente intégrant rémunération fixe, variable, avantages e","notions_cles":["2. Élaboration mix salarial adapté et budget prévisionnel réaliste","3. Conformité réglementaire et communication transparente rémunération","4. Pilotage performance et ajustements politiques rémunération"],"intervenant":""},{"id":"M12","titre":"Module 23 : Processus de paie sécurisés avec outils digitaux","activite":"A9 – Supervision de la production des bulletins de paie","competences_liees":["C9.1"],"volume":"17,5 heures","objectif":"1. Maîtriser le processus complet de production des bulletins de paie depuis la collecte des variables jusqu'à la déclaration fiscale, en identifiant les points de contrôle critiques pour garantir la","notions_cles":["3. Supervision de la production et contrôles qualité dans les SIRH","4. Conformité déclarations sociales et fiscales et posture responsable"],"intervenant":""},{"id":"M13","titre":"Module 24 : Digitalisation des processus RH et conformité réglementaire","activite":"A10 – Gestion administrative du personnel (hors paie)","competences_liees":["C10.1"],"volume":"21 heures","objectif":"1. Élaborer ou améliorer les processus de gestion administrative du personnel (contrats, déclarations sociales, suivi médical, archives) pour l'ensemble de la vie du contrat de travail, en s'appuyant","notions_cles":["2. Conception de processus digitalisés sécurisés et optimisés","3. Rédaction administrative standardisée et conformité obligatoire","4. Audit et amélioration continue des processus administratifs"],"intervenant":""}]},{"id":"B4","titre":"Piloter le dialogue social et la communication RH","competences":[{"id":"C11","libelle":"Conduire le dialogue social"},{"id":"C12","libelle":"Piloter la communication RH externe"},{"id":"C13","libelle":"Piloter la communication RH interne"},{"id":"C14","libelle":"Accompagner les managers"}],"modules":[{"id":"M14","titre":"Module 25 : Instances représentatives et climat social digital","activite":"A11 – Conduite du dialogue social","competences_liees":["C11.1"],"volume":"24,5 heures","objectif":"1) Comprendre le rôle et le fonctionnement des instances représentatives du personnel (IRP) en environnement numérique. \n2) Maîtriser la réglementation sociale applicable aux IRP, intégrant les spécif","notions_cles":["1. Fondements des instances représentatives du personnel","d) Droits, devoirs et responsabilités des acteurs du dialogue social.","2. Enjeux et spécificités du climat social digital","a) Réglementation sociale et veille juridique appliquée aux IRP","d) Prévention et gestion des conflits en environnement digital."],"intervenant":""},{"id":"M15","titre":"Module 26 : Dialogue social responsable et valorisation RSE","activite":"A12 – Conduite du dialogue social","competences_liees":["C11.2"],"volume":"14 heures","objectif":"1. Favoriser un dialogue social orienté vers la responsabilité sociétale de l'entreprise en identifiant les attentes communes entre direction, représentants du personnel et salariés sur les enjeux RSE","notions_cles":["1. Fondements et enjeux du dialogue social responsable en PME/ETI","2. Intégrer la RSE dans les réunions et échanges sociaux quotidiens","3. Construire des actions RSE co-décidées et mesurables","4. Mesurer l'impact et capitaliser les bonnes pratiques dialogue RSE"],"intervenant":""},{"id":"M16","titre":"Module 27 : Marketing RH digital et marque employeur responsable","activite":"A12 Communication RH externe","competences_liees":["C12.1"],"volume":"21 heures","objectif":"1) Définir et encadrer la marque employeur en cohérence avec la stratégie RH globale et la démarche RSE de l’entreprise. \n2) Utiliser les outils digitaux et les techniques de marketing RH pour valoris","notions_cles":["2. Définir l'identité marque employeur et son positionnement RSE","3. Stratégies et outils digitaux pour déployer la marque employeur","4. Mesure d'impact et amélioration continue de l'e-reputation"],"intervenant":""},{"id":"M17","titre":"Module 28 : Outils de communication interne hybrides et réseaux sociaux","activite":"A13 – Communication RH interne","competences_liees":["C13.1"],"volume":"14 heures","objectif":"1. Structurer un circuit de communication RH interne adapté aux environnements hybrides présentiel-distanciel, en combinant intelligemment les canaux physiques et numériques selon les publics et les m","notions_cles":["4. Mesure d'impact et amélioration continue de la communication RH"],"intervenant":""},{"id":"M18","titre":"Module 29 : Méthodes de recueil terrain et posture managériale","activite":"A14 – Accompagnement des managers et déploiement de la relat","competences_liees":["C14.1"],"volume":"28 heures","objectif":"1) Mettre en place un dispositif de recueil et traitement des problématiques RH rencontrées sur le terrain. \n2) Adopter une posture de proximité et de service auprès des opérationnels et des managers.","notions_cles":["1. Comprendre les attentes et besoins des managers opérationnels RH","2. Concevoir un dispositif de recueil terrain adapté et réaliste","3. Développer la posture de service et de facilitateur RH","4. Transformer les remontées terrain en actions et en apprentissages"],"intervenant":""}]},{"id":"B5","titre":"Manager les talents et l'expérience collaborateur","competences":[{"id":"C15","libelle":"Piloter la politique d'acquisition de talents"},{"id":"C16","libelle":"Manager les compétences et la formation"},{"id":"C17","libelle":"Manager l'expérience collaborateur"}],"modules":[{"id":"M30","titre":"Module 30 : Sourcing et sélection, pilotés par l’IA","activite":"A15 – Politique d’acquisition de talents","competences_liees":["C15.1"],"volume":"21 heures","objectif":"1. Maîtriser les techniques de sourcing omnicanal assistées par IA générative et prédictive.\n2. Paramétrer et utiliser les algorithmes IA pour optimiser la présélection et la sélection candidats.\n3. A","notions_cles":["1. Techniques de sourcing omnicanal avancées","b) Approche multicanale et ciblage précis des talents passifs et actifs.","2. Intelligence artificielle et automatisation du sourcing","b) Automatisation de tâches (candidatures, préqualification, chatbots).","c) Analyse prédictive pour optimisation pipeline candidats."],"intervenant":""},{"id":"M31","titre":"Module 31 : Neurosciences et optimisation de l’expérience candidat.","activite":"A15 – Politique d’acquisition de talents.","competences_liees":["C15.1"],"volume":"7 heures.","objectif":"1. Comprendre les apports fondamentaux des neurosciences cognitives et sociales à l'optimisation des processus de recrutement et de sélection.\n2. Identifier les leviers neuroscientifiques pour amélior","notions_cles":["1. Fondamentaux des neurosciences appliquées au recrutement","2. Optimisation de l'expérience candidat par les neurosciences","3. Assessments et outils neurosciences en recrutement","4. Intégration éthique et data-driven neurosciences/IA","a) Biais neuro vs biais IA : complémentarité ou risque d'amplification ?"],"intervenant":""},{"id":"M32","titre":"Module 32 : Rédaction RH inclusives et marketing RH attractif","activite":"A15 – Politique d’acquisition de talents","competences_liees":["C15.2"],"volume":"7 heures","objectif":"1. Maîtriser les techniques de rédaction inclusive pour fiches de poste et annonces RH conformes RGPD et Loi pour l'égalité professionnelle.\n2. Appliquer les principes du marketing RH digital pour cré","notions_cles":["1. Fondamentaux rédaction RH inclusive et réglementation","2. Marketing RH digital et EVP multigénérationnel","3. Techniques rédactionnelles neuro-marketing RH","4. Mesure performance et A/B testing annonces","b) Outils tracking : Google Analytics 4 UTM, LinkedIn Campaign Manager."],"intervenant":""},{"id":"M33","titre":"Module 33 : Analyse prédictive des compétences et veille marché","activite":"A16 – Management des compétences et GPEC","competences_liees":["C16.1"],"volume":"17,5 heures","objectif":"1. Identifier les besoins futurs en compétences via l’analyse prédictive intégrant données marché et internes.\n2. Anticiper les évolutions des métiers, obsolescence des compétences, et reconversions n","notions_cles":["1. Fondamentaux de l’analyse prédictive des compétences","c) Méthodologies agiles pour veille et ajustement rapide des compétences.","2. Outils et techniques d’analyse","3. Veille marché et prospective RH","a) Cartographie des acteurs et signaux faibles sur le marché du travail."],"intervenant":""},{"id":"M34","titre":"Module 34 : Talent marketplace et plan de succession digital","activite":"A16 – Management des compétences et GPEC","competences_liees":["C16.2"],"volume":"17,5 heures","objectif":"1) Mettre en œuvre et piloter une démarche de talent marketplace intégrée au plan de succession digital. \n2) Intégrer la dimension RSE dans la gestion des carrières et la sécurisation des parcours pro","notions_cles":["1. Fondamentaux talent marketplace et mobilité interne","c) Atelier : audit compétences internes (Excel → matrice readiness).","2. Conception plan de succession data-driven","d) Étude de cas : plan succession GE/SAP (avant/après marketplace).","3. Outils et implémentation marketplace talents"],"intervenant":""},{"id":"M35","titre":"Module 35 : Formation hybride et organisation apprenante","activite":"A16 – Management des compétences et GPEC","competences_liees":["C16.3"],"volume":"24,5 heures","objectif":"1) Concevoir et déployer des dispositifs de formation hybrides intégrés dans une organisation apprenante. \n2) Favoriser l’engagement, l’autonomie et le développement continu des collaborateurs. \n3) Ut","notions_cles":["1. Cadre réglementaire et pilotage du plan de formation","a) Réforme de la formation professionnelle et obligations entreprises.","d) Atelier : Élaboration budgétaire simplifiée avec Excel.","2. Dispositifs et modalités hybrides de formation","a) Présentiel vs distanciel : avantages, contraintes, usages."],"intervenant":""},{"id":"M36","titre":"Module 36 : Acculturation digitale et parcours collaborateur","activite":"A17 – Management de l’expérience collaborateur","competences_liees":["C17.1"],"volume":"14 heures","objectif":"1. Mettre en œuvre une démarche onboarding digitale, hybride et inclusive, intégrant supports accessibles pour tous les profils.\n2. Concevoir un parcours collaborateur adapté favorisant acculturation,","notions_cles":["1. Fondamentaux de l’onboarding digital et inclusif","b) Typologies de parcours collaborateurs en contextes hybrides.","2. Supports et outils pour un onboarding efficace","a) Plateformes digitales d’accompagnement : LMS, SIRH, chatbots IA.","d) Cas pratique : conception de kit digital onboarding (template Canva)."],"intervenant":""},{"id":"M37","titre":"Module 37 : Anticipation RH via Analytics et IA","activite":"A17 – Management de l’expérience collaborateur","competences_liees":["C17.2"],"volume":"21 heures","objectif":"1. Planifier la gestion anticipative des départs et des successions en exploitant les résultats de l'Analytics RH et de l'IA, sans nécessiter la construction de modèles techniques. \n2. Analyser et int","notions_cles":["1. Fondamentaux de l’Analytics et IA appliqués à l’anticipation RH","a) Concepts clés : offboarding, flight risk, Analytics prédictive.","c) Atelier : étude dataset turnover, visualisation KPIs.","2. Analyse critique et éthique des outils IA d'anticipation RH","3. Intégration de l’anticipation RH dans la stratégie QVCT"],"intervenant":""},{"id":"M38","titre":"Module 38 : Approche QVCT digitale et RSE intégrée","activite":"A17 – Management de l’expérience collaborateur","competences_liees":["C17.3"],"volume":"21 heures","objectif":"1. Déployer une démarche QVCT hybride intégrant outils digitaux, data RH et IA dans une approche RSE.\n2. Maîtriser les outils de mesure et d'analyse des facteurs QVCT (organisation, conditions, relati","notions_cles":["1. Diagnostic QVCT digital et cartographie des enjeux","d) Atelier : conception questionnaire QVCT 15 questions (Qualtrics).","2. Data analytics et IA pour analyse QVCT","c) IA prédictive : anticipation RPS, détection signaux faibles démissions.","d) Cas pratique : analyse dataset QVCT anonymisé (Power BI dashboard)."],"intervenant":""},{"id":"M39","titre":"Module 39 : Santé au travail digitale et prévention psychosociale","activite":"A17 – Management de l’expérience collaborateur","competences_liees":["C17.4"],"volume":"21 heures","objectif":"1) Évaluer et prévenir les risques physiques et psychosociaux en environnement digitalisé. \n2) Mettre en place une organisation du travail conciliant santé des collaborateurs et performance globale.","notions_cles":["1. Cadre réglementaire et enjeux santé travail","a) Obligations légales SST, DUERP, prévention RPS.","c) Impacts santé/performance : absentéisme, turnover, engagement.","2. Évaluation numérique des risques","c) Méthodes d’interprétation et alertes précoces via IA."],"intervenant":""}]}],"intervenants":[],"notions_transversales":["IA prédictive et analytics RH","RSE et transition écologique","SIRH et data-driven RH","Marque employeur et marketing RH digital","Management hybride et télétravail"],"alertes_detectees":[{"niveau":2,"notion":"Veille stratégique RH","modules":["M1","M2"],"message":"Deux modules de veille en BC01 (digitale/réglementaire + économique/IA) — articuler la progression entre les deux séquences."},{"niveau":3,"notion":"RSE","modules":["M4","M5"],"message":"RSE abordée dans la stratégie RH (C17) et la transition écologique (C18) — fil conducteur à rendre explicite."}]},
  '39354': {"formation":{"titre":"Master Manager du développement d'entreprise et commercial","etablissement":"ISME / Aforem","rncp":"39354","annee":"2026-28"},"blocs":[{"id":"B1","titre":"Élaborer la stratégie générale de développement","competences":[{"id":"C1","libelle":"Analyser les opportunités et menaces"},{"id":"C2","libelle":"Diagnostiquer forces et faiblesses"},{"id":"C3","libelle":"Synthétiser pour la réflexion collaborative"},{"id":"C4","libelle":"Déterminer la vision et le projet stratégique"},{"id":"C5","libelle":"Définir et prioriser les objectifs stratégiques"},{"id":"C6","libelle":"Communiquer les objectifs stratégiques"},{"id":"C7","libelle":"Élaborer des plans stratégiques détaillés"},{"id":"C8","libelle":"Accompagner les directions opérationnelles"},{"id":"C9","libelle":"Construire un dispositif d'évaluation de la performance"}],"modules":[{"id":"M1","titre":"C1 Veille, analyse et stratégie","competences_liees":["C.1"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de mettre en place un système de veille stratégique efficace, d'analyser l'environnement externe et interne de l'entreprise, et d'identifier les tendan","notions_cles":["Fondamentaux de la Business Intelligence et de la veille stratégique","Définition et enjeux de la business intelligence","Cycle de la veille et méthodologie","Outils et techniques de veille","Cartographie des sources d'information pertinentes"],"intervenant":""},{"id":"M2","titre":"C2 Diagnostic stratégique","competences_liees":["C.2"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de réaliser un diagnostic stratégique complet d'une organisation, d'identifier ses forces et faiblesses, et de déterminer les leviers d'action stratégi","notions_cles":["Fondamentaux du diagnostic stratégique","Définition et enjeux du diagnostic stratégique","Place du diagnostic dans le processus de planification stratégique","Approches contemporaines du diagnostic stratégique","Diagnostic interne de l'organisation"],"intervenant":""},{"id":"M3","titre":"C3 La Reflexion collaborative","competences_liees":["C.3"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de mettre en œuvre des méthodes d'intelligence collective et d'animation de réunion efficaces pour synthétiser les informations stratégiques et facilit","notions_cles":["Fondamentaux de l'intelligence collective","Rôle du manager dans l'animation de la réflexion stratégique collective","Conditions de réussite d'une démarche collaborative","Techniques d'animation de réunion","Préparation et structuration de réunions stratégiques efficaces"],"intervenant":""},{"id":"M4","titre":"C41 Culture et Gouvernance","competences_liees":["C.4"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de déterminer une vision stratégique cohérente pour l'entreprise, de l'articuler avec les principes de gouvernance et la culture organisationnelle, et","notions_cles":["Fondamentaux de la gouvernance d'entreprise","Modèles et systèmes de gouvernance","Rôles et responsabilités des instances de gouvernance","Gouvernance et création de valeur","Éthique et transparence dans la gouvernance"],"intervenant":""},{"id":"M5","titre":"C42 RSE","competences_liees":["C.4"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable d'intégrer les principes de la Responsabilité Sociétale des Entreprises (RSE) dans la stratégie globale de l'entreprise, en tenant compte des enjeux so","notions_cles":["Introduction à la RSE","Concepts et enjeux de la RSE","Normes et référentiels (ISO 26000, Global Compact, etc.)","Intégration de la RSE dans la stratégie d'entreprise","Enjeux sociétaux et environnementaux"],"intervenant":""},{"id":"M6","titre":"C5 Plan d'action stratégique","competences_liees":["C.5"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de définir et prioriser des objectifs stratégiques alignés avec la stratégie générale, en utilisant des outils d'analyse de la valeur pour maximiser l'","notions_cles":["Fondamentaux du plan d'action stratégique","Définition et rôle des plans d'action dans le cadre stratégique","Processus d'élaboration et priorisation des objectifs","Alignement entre stratégie globale et actions opérationnelles","Outils d'analyse et priorisation stratégique"],"intervenant":""},{"id":"M7","titre":"C6 Communication et Leadership","competences_liees":["C.6"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de communiquer efficacement les objectifs stratégiques à tous les niveaux de l'organisation, en mobilisant des techniques de leadership et de force de","notions_cles":["Principes fondamentaux de la communication stratégique","Rôle de la communication dans la mise en œuvre des objectifs stratégiques","Techniques de structuration des messages stratégiques","Leadership et force de conviction","Styles de leadership et impact sur la communication"],"intervenant":""},{"id":"M8","titre":"C7 Management de projet","competences_liees":["C.7"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable d'élaborer des plans stratégiques détaillés en identifiant les ressources, les étapes clés et les risques pour atteindre les objectifs fixés, tout en a","notions_cles":["Introduction au management de projet stratégique","Définition et principes fondamentaux du management de projet","Rôle du management de projet dans la mise en œuvre des stratégies","Différences entre gestion opérationnelle et gestion stratégique","Méthodologies et outils de planification stratégique"],"intervenant":""},{"id":"M9","titre":"C81 Négociation","competences_liees":["C.8"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable d'accompagner les directions opérationnelles dans la déclinaison des objectifs stratégiques sur leur périmètre en responsabilité, tout en assurant l'al","notions_cles":["Fondamentaux de la négociation stratégique","Définition et enjeux de la négociation dans un contexte stratégique","Différences entre négociation opérationnelle et stratégique","Rôle du manager dans les processus de négociation","Techniques et outils de négociation"],"intervenant":""},{"id":"M10","titre":"C82 L'accompagnement stratégique","competences_liees":["C.8"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable d'accompagner les équipes opérationnelles dans la mise en œuvre des objectifs stratégiques, en mobilisant des outils adaptés pour garantir leur cohéren","notions_cles":["Fondamentaux de l'accompagnement stratégique","Rôle du manager dans l'accompagnement des équipes","Processus d'alignement entre stratégie globale et actions opérationnelles","Techniques d'accompagnement des équipes opérationnelles","Méthodes collaboratives pour décliner les objectifs stratégiques"],"intervenant":""},{"id":"M11","titre":"C9 Stratégie de la Performance","competences_liees":["C.9"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de construire un dispositif d’évaluation de la performance des plans stratégiques définis, en utilisant des indicateurs clés pour identifier les ajuste","notions_cles":["Introduction à l’évaluation stratégique","Rôle et enjeux de l’évaluation dans le cycle stratégique","Processus d’évaluation : étapes clés","Alignement entre objectifs stratégiques et évaluation","Indicateurs clés de performance (KPI)"],"intervenant":""}]},{"id":"B2","titre":"Piloter un centre de profit","competences":[{"id":"C10","libelle":"Gérer les ressources financières — Excel"},{"id":"C11","libelle":"Assurer la conformité juridique"},{"id":"C12","libelle":"Piloter la GRH"},{"id":"C13","libelle":"Garantir la gestion des services généraux"},{"id":"C14","libelle":"Diriger les opérations d'ajustement"}],"modules":[{"id":"M36","titre":"C101 Maîtriser Excel","competences_liees":["C.10"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de manipuler efficacement Excel pour réaliser des prévisions budgétaires, des analyses de rentabilité et des tableaux de bord financiers adaptés à la g","notions_cles":["Introduction à Excel pour la gestion financière","Principes fondamentaux d’Excel : formules, fonctions, mises en forme","Utilisation des tableaux croisés dynamiques","Gestion des bases de données financières","Prévisions budgétaires avec Excel"],"intervenant":""},{"id":"M37","titre":"C102 Gestion budget","competences_liees":["C.10"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de concevoir, gérer et optimiser un budget en tenant compte des contraintes financières et des objectifs stratégiques du centre de profit.","notions_cles":["Fondamentaux de la gestion budgétaire","Rôle et enjeux du budget dans la gestion d’un centre de profit","Processus d’élaboration budgétaire","Typologie des budgets (fonctionnel, opérationnel, stratégique)","Techniques d’optimisation budgétaire"],"intervenant":""},{"id":"M38","titre":"C103 Analyse financière et financement","competences_liees":["C.10"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable d’analyser les performances financières d’un centre de profit, d’évaluer les besoins en financement et de proposer des solutions adaptées pour garantir","notions_cles":["Principes fondamentaux de l’analyse financière","Diagnostic financier : forces et faiblesses","Évaluation des besoins en financement","Identification des besoins à court, moyen et long terme","Analyse des options de financement interne et externe"],"intervenant":""},{"id":"M39","titre":"C11 Environnement réglementaire et juridique","competences_liees":["C.11"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable d’assurer la conformité juridique des activités d’un centre de profit en réalisant une veille réglementaire et en garantissant l’application de procédu","notions_cles":["Introduction à la conformité juridique","Principes fondamentaux du droit des affaires","Enjeux de la conformité pour un centre de profit","Identification des risques juridiques","Veille réglementaire et gestion des risques juridiques"],"intervenant":""},{"id":"M40","titre":"C121 Gestion RH","competences_liees":["C.12"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de piloter la gestion des ressources humaines d’un centre de profit, en mettant en place des politiques adaptées aux enjeux et au contexte, notamment e","notions_cles":["Principes fondamentaux de la gestion RH","Rôle stratégique des RH dans un centre de profit","Enjeux liés à la gestion des talents et des compétences","Cadre légal et réglementaire (droit du travail)","Recrutement et intégration des collaborateurs"],"intervenant":""},{"id":"M41","titre":"C122 Talent Acquisition","competences_liees":["C.12"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de concevoir et mettre en œuvre une stratégie de recrutement efficace, en identifiant les besoins en talents, en attirant des profils adaptés et en opt","notions_cles":["Introduction à la stratégie de recrutement","Enjeux stratégiques liés au recrutement","Identification des besoins en talents et analyse des postes","Alignement entre stratégie d’entreprise et stratégie RH","Stratégie de rémunération"],"intervenant":""},{"id":"M42","titre":"C13 Gestion des Services Généraux","competences_liees":["C.13"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de garantir la gestion efficace des services généraux (achats, gestion des bâtiments, matériels) en interne ou externalisés, tout en respectant les con","notions_cles":["Introduction à la gestion des services généraux","Rôle et enjeux stratégiques des services généraux","Organisation et structuration des fonctions support","Objectifs liés à la qualité et à la conformité","Gestion des achats et prestataires"],"intervenant":""},{"id":"M43","titre":"C141 Organisation agile","competences_liees":["C.14"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable de diriger les opérations d’ajustement ou de transformation organisationnelle dans une logique RSE et d’amélioration continue pour garantir la pérennit","notions_cles":["Introduction à l’organisation agile","Principes fondamentaux de l’agilité organisationnelle","Enjeux stratégiques liés à l’agilité","Différences entre organisation classique et agile","Méthodes et outils pour une organisation agile"],"intervenant":""},{"id":"M44","titre":"C142 RSE et Qualité continue","competences_liees":["C.14"],"volume":"","objectif":"À l'issue de ce module, l'apprenant sera capable d’intégrer les principes de la Responsabilité Sociétale des Entreprises (RSE) et d’amélioration continue dans les processus organisationnels pour renfo","notions_cles":["Introduction à la RSE et à la qualité continue","Concepts fondamentaux de la RSE appliquée à l’organisation","Enjeux stratégiques de la qualité continue","Alignement entre stratégie RSE et objectifs organisationnels","Mise en œuvre des démarches RSE"],"intervenant":""}]},{"id":"B3","titre":"Concevoir la stratégie de développement commercial","competences":[{"id":"C15","libelle":"Élaborer une stratégie de veille marchés"},{"id":"C16","libelle":"Identifier les segments de marché les plus lucratifs"},{"id":"C17","libelle":"Diagnostiquer les avantages concurrentiels"},{"id":"C18","libelle":"Élaborer la stratégie commerciale"},{"id":"C19","libelle":"Assurer la traduction en plan d'action commerciale"},{"id":"C20","libelle":"Sécuriser la stratégie commerciale"},{"id":"C21","libelle":"Inventorier les moyens et ressources"},{"id":"C22","libelle":"Négocier l'attribution des moyens"}],"modules":[{"id":"M26","titre":"C15 Veille et Innovation","competences_liees":["C.15"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable d’élaborer une stratégie de veille commerciale en exploitant les technologies intelligentes (IA, Big Data, CRM…) pour identifier les opportunités d’inn","notions_cles":["Introduction à la veille stratégique et à l’innovation","Concepts fondamentaux de la veille commerciale","Rôle de l’innovation dans la compétitivité des entreprises","Alignement entre stratégie d’entreprise et innovation","Technologies au service de la veille commerciale"],"intervenant":""},{"id":"M27","titre":"C16 Analyse du marché et ciblage","competences_liees":["C.16"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable d’identifier les segments de marché les plus lucratifs en analysant les comportements et attentes des clients, afin d’allouer efficacement les efforts","notions_cles":["Introduction à l’analyse de marché","Concepts fondamentaux : segmentation, ciblage, positionnement","Enjeux stratégiques liés à l’analyse des marchés","Méthodologies d’analyse qualitative et quantitative","Étude des comportements clients"],"intervenant":""},{"id":"M28","titre":"C17 Benchmarking et diagnostic","competences_liees":["C.17"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de diagnostiquer les avantages concurrentiels et les lacunes à combler de l’entreprise en évaluant comparativement la concurrence pour définir les axes","notions_cles":["Introduction au benchmarking stratégique","Concepts fondamentaux : benchmarking interne et externe","Objectifs et enjeux du benchmarking dans le développement commercial","Méthodologies d’analyse comparative","Évaluation des avantages concurrentiels"],"intervenant":""},{"id":"M29","titre":"C18 Stratégie commerciale","competences_liees":["C.18"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable d’élaborer une stratégie commerciale alignée avec les orientations définies par la direction générale, en vue de garantir la pérennité et le développem","notions_cles":["Introduction à la stratégie commerciale","Concepts fondamentaux : objectifs, moyens et ressources","Alignement entre stratégie globale et stratégie commerciale","Enjeux liés à la pérennité et au développement des activités","Développement de la stratégie commerciale"],"intervenant":""},{"id":"M30","titre":"C19 PAC et développement réseau","competences_liees":["C.19"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de superviser l’élaboration des Plans d’Action Commercial (PAC) établis par les responsables de périmètre, secteur ou produit, en vue de garantir leur","notions_cles":["Introduction aux Plans d’Action Commercial (PAC)","Concepts fondamentaux : objectifs, structuration et mise en œuvre","Rôle des PAC dans le développement commercial","Alignement entre PAC et stratégie commerciale globale","Supervision des PAC par secteur ou produit"],"intervenant":""},{"id":"M31","titre":"C201 Gestion des risques","competences_liees":["C.20"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de sécuriser la stratégie commerciale en identifiant, analysant et évaluant les aléas internes et externes pour réajuster les objectifs commerciaux et","notions_cles":["Introduction à la gestion des risques commerciaux","Concepts fondamentaux : identification, analyse et évaluation des risques","Typologie des aléas internes et externes","Enjeux stratégiques liés à la sécurisation commerciale","Méthodes d’identification et d’analyse des risques"],"intervenant":""},{"id":"M32","titre":"C202 Analyse et sécurisation de stratégie","competences_liees":["C.20"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable d’analyser les indicateurs commerciaux et d’évaluer les risques liés à la mise en œuvre de la stratégie commerciale, afin de proposer des ajustements p","notions_cles":["Introduction à l’analyse stratégique et sécurisation","Concepts fondamentaux : indicateurs commerciaux et gestion des risques","Enjeux liés à la sécurisation des stratégies commerciales","Méthodologies d’analyse des performances commerciales","Évaluation des indicateurs commerciaux"],"intervenant":""},{"id":"M33","titre":"C21 Business Plan","competences_liees":["C.21"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable d’inventorier les moyens et ressources disponibles (humains, techniques, budgétaires, matériels…) nécessaires à la mise en œuvre de la stratégie commer","notions_cles":["Introduction au business plan","Concepts fondamentaux : structure, objectifs et utilité","Rôle du business plan dans la stratégie commerciale","Enjeux liés à l’allocation des ressources","Inventaire des moyens et ressources disponibles"],"intervenant":""},{"id":"M34","titre":"C221 Budget et Négociation approfondie","competences_liees":["C.22","C.23"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de négocier avec la direction générale l’attribution des moyens et ressources complémentaires nécessaires à la mise en œuvre de la stratégie commercial","notions_cles":["Introduction à la gestion budgétaire stratégique","Concepts fondamentaux : élaboration, suivi et optimisation budgétaire","Enjeux liés à la négociation des ressources complémentaires","Alignement entre budget et stratégie commerciale","Techniques avancées de négociation budgétaire"],"intervenant":""},{"id":"M35","titre":"C222 Pitch","competences_liees":["C.22","C.23"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de structurer et présenter un pitch convaincant pour défendre la stratégie commerciale et mobiliser les parties prenantes autour des objectifs stratégi","notions_cles":["Introduction au pitch stratégique","Principes fondamentaux d’un pitch efficace","Objectifs : convaincre, mobiliser et inspirer","Structuration du discours selon les parties prenantes","Techniques avancées de présentation orale"],"intervenant":""}]},{"id":"B4","titre":"Superviser la mise en œuvre de la performance commerciale","competences":[{"id":"C24","libelle":"Développer une politique commerciale innovante"},{"id":"C25","libelle":"Concevoir une stratégie de satisfaction client"},{"id":"C26","libelle":"Élaborer des stratégies RSE commerciales"},{"id":"C27","libelle":"Évaluer la performance des équipes commerciales"},{"id":"C28","libelle":"Piloter le dispositif d'amélioration"}],"modules":[{"id":"M21","titre":"C24 Politique commerciale","competences_liees":["C.24"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de développer une politique commerciale innovante, alignée sur les objectifs de la stratégie commerciale, en collaboration avec les directions internes","notions_cles":["Introduction à la politique commerciale stratégique","Concepts fondamentaux : objectifs, structure et mise en œuvre","Enjeux liés à l’innovation dans les politiques commerciales","Alignement entre stratégie globale et politique commerciale","Création d’alliances stratégiques"],"intervenant":""},{"id":"M22","titre":"C25 Stratégie client","competences_liees":["C.25"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de concevoir et déployer une stratégie de satisfaction client omnicanal centrée sur l’excellence du service, la personnalisation des offres et la réact","notions_cles":["Introduction à la stratégie client","Concepts fondamentaux : satisfaction client, fidélisation et omnicanalité","Enjeux stratégiques liés à l’expérience client","Alignement entre stratégie commerciale et orientation client","Développement d’une stratégie omnicanal"],"intervenant":""},{"id":"M23","titre":"C26 RSE et pratiques commerciales","competences_liees":["C.26"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable d’élaborer des stratégies et des initiatives visant à intégrer la RSE dans les pratiques commerciales, en collaboration avec les différentes parties pr","notions_cles":["Introduction à la RSE appliquée aux pratiques commerciales","Concepts fondamentaux : responsabilité sociétale et développement durable","Enjeux liés à l’intégration de la RSE dans les stratégies commerciales","Alignement entre stratégie commerciale et principes RSE","Développement d’initiatives responsables"],"intervenant":""},{"id":"M24","titre":"C27 Performance commerciale et KPI","competences_liees":["C.27"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable d’évaluer la performance des équipes commerciales en analysant les indicateurs de performance (KPI) issus des processus mis en place, afin de mesurer l","notions_cles":["Introduction à la gestion de la performance commerciale","Concepts fondamentaux : objectifs, KPI et analyse","Enjeux liés à l’évaluation des performances commerciales","Alignement entre stratégie commerciale et mesure de performance","Analyse des indicateurs clés de performance (KPI)"],"intervenant":""},{"id":"M25","titre":"C28 Performance et pratiques responsables","competences_liees":["C.28"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de piloter un dispositif d’amélioration de la performance commerciale en développant des plans d’action intégrant des pratiques responsables pour renfo","notions_cles":["Introduction à la performance commerciale responsable","Concepts fondamentaux : qualité, durabilité et responsabilité","Alignement entre stratégie commerciale et principes RSE","Développement de plans d’action responsables","Techniques pour intégrer les principes RSE dans les processus commerciaux"],"intervenant":""}]},{"id":"B5","titre":"Manager une équipe","competences":[{"id":"C29","libelle":"Planifier les activités de l'équipe"},{"id":"C30","libelle":"Élaborer des procédures opérationnelles"},{"id":"C31","libelle":"Mesurer les performances individuelles et collectives"},{"id":"C32","libelle":"Développer la cohésion et l'esprit d'équipe"},{"id":"C33","libelle":"Assurer la conduite du changement"},{"id":"C34","libelle":"Définir des objectifs mobilisateurs"}],"modules":[{"id":"M12","titre":"C29 Structure et Organisation","competences_liees":["C.29"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de planifier les activités en établissant une feuille de route pour chaque membre de l’équipe, afin de répartir la charge de travail de manière équitab","notions_cles":["Introduction à la structuration organisationnelle","Concepts clés : organisation, planification et supervision","Enjeux liés à la répartition équitable des tâches","Alignement entre objectifs stratégiques et organisation opérationnelle","Techniques de planification des activités"],"intervenant":""},{"id":"M13","titre":"C30 Optimisation des processus RH","competences_liees":["C.30"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable d’élaborer des procédures opérationnelles en modélisant et optimisant les pratiques existantes des acteurs concernés, afin de consolider l’organisation","notions_cles":["Introduction à l’optimisation des processus RH","Concepts fondamentaux : organisation, modélisation et optimisation","Enjeux stratégiques liés à l’amélioration des pratiques RH","Alignement entre objectifs organisationnels et pratiques RH","Techniques de modélisation des processus RH"],"intervenant":""},{"id":"M14","titre":"C31 Performance RH","competences_liees":["C.31"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de mesurer les performances individuelles et collectives via des tableaux de bord et des remontées d’information, afin d’évaluer les écarts et décider","notions_cles":["Introduction à la mesure de la performance RH","Concepts fondamentaux : performance individuelle et collective","Enjeux liés à l’évaluation des écarts","Alignement entre objectifs stratégiques et indicateurs RH","Outils pour mesurer la performance RH"],"intervenant":""},{"id":"M15","titre":"C321 Management des équipes","competences_liees":["C.32"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de développer la cohésion et l’esprit d’équipe en valorisant le sens des actions menées, la complémentarité entre les membres et la plus-value apportée","notions_cles":["Introduction au management des équipes","Concepts fondamentaux : cohésion, complémentarité et engagement","Enjeux liés à la mobilisation des équipes","Alignement entre objectifs stratégiques et management opérationnel","Techniques pour renforcer la cohésion d’équipe"],"intervenant":""},{"id":"M16","titre":"C322 QSE","competences_liees":["C.32"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de mettre en œuvre des actions favorisant la qualité de vie au travail (QVT), la prévention des risques et la gestion des conflits au sein de l’équipe,","notions_cles":["Introduction à la Qualité, Sécurité et Environnement (QSE)","Enjeux stratégiques liés au bien-être au travail","Alignement entre objectifs organisationnels et pratiques QSE","Techniques pour favoriser la qualité de vie au travail (QVT)","Identification des leviers pour améliorer le bien-être"],"intervenant":""},{"id":"M17","titre":"C33 Conduite du changement","competences_liees":["C.33"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable d’assurer la conduite du changement en déployant des méthodes et outils adaptés pour garantir la pérennité, l’agilité de l’organisation et l’adhésion d","notions_cles":["Introduction à la conduite du changement","Concepts fondamentaux : transformation organisationnelle et adaptation","Enjeux liés à la pérennité et à l’agilité des organisations","Alignement entre stratégie globale et gestion du changement","Méthodes et outils pour conduire le changement"],"intervenant":""},{"id":"M18","titre":"C34 Entretien annuel : analyse et exploitation","competences_liees":["C.34"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable de conduire des entretiens annuels pour définir des objectifs individuels et collectifs mobilisateurs, en tenant compte des compétences, aspirations et","notions_cles":["Introduction à l’entretien annuel d’évaluation","Concepts fondamentaux : objectifs, structure et enjeux","Rôle stratégique de l’entretien dans le management d’équipe","Alignement entre stratégie organisationnelle et objectifs individuels","Conduite de l’entretien annuel"],"intervenant":""},{"id":"M19","titre":"C35-36 Gestion des talents","competences_liees":["C.35","C.36","C.37"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable d’identifier les besoins en compétences de chaque membre de l’équipe en fonction des exigences du poste, de soutenir les collaborateurs dans la réalisa","notions_cles":["Identification des besoins en compétences","Analyse des exigences des postes et profils nécessaires","Techniques pour évaluer les besoins individuels et collectifs","Utilisation des entretiens annuels comme outil d’identification","Soutien et développement des collaborateurs"],"intervenant":""},{"id":"M20","titre":"C37 Co-développement et Intelligence collective","competences_liees":["C.37"],"volume":"","objectif":"À l'issue de ce module, l’apprenant sera capable d’organiser des démarches de co-développement en exploitant l’intelligence collective pour résoudre des problématiques complexes, renforcer les compéte","notions_cles":["Introduction au co-développement et à l’intelligence collective","Concepts fondamentaux : collaboration, partage et apprentissage collectif","Enjeux liés à la mobilisation de l’intelligence collective","Alignement entre objectifs organisationnels et démarches collaboratives","Techniques pour organiser le co-développement"],"intervenant":""}]}],"intervenants":[],"notions_transversales":["RSE et pratiques responsables","Business Intelligence et veille stratégique","Management agile et conduite du changement","Performance commerciale et KPI","Leadership et communication"],"alertes_detectees":[{"niveau":2,"notion":"Veille stratégique / Business Intelligence","modules":["M1","M21"],"message":"Veille en BC1 (C1) et en BC3 (C15) — deux angles complémentaires à articuler explicitement dans la progression."},{"niveau":2,"notion":"RSE","modules":["M5","M26","M31"],"message":"RSE présente en BC1 (C42), BC3 (C26) et BC4 — fil conducteur transversal à rendre visible pour les intervenants."},{"niveau":3,"notion":"Management d'équipe","modules":["M27","M32"],"message":"BC5 Manager une équipe est scindé en M1 et M2 — veiller à la cohérence pédagogique entre les deux années."}]},
};

// ─── Métadonnées des formations Le Mans ──────────────────────────────────────
// Un titre RNCP peut se decliner en plusieurs annees de cycle : le M1 et le M2
// d'un meme Mastere partagent le referentiel (data_rncp) mais constituent deux
// promotions distinctes, avec leurs propres seances, previsionnels et digests.
// La cle d'idempotence du seed est donc titre_court + campus, pas rncp + campus.
const FORMATIONS_LE_MANS = [
  {
    "titre_court": "Bach CDC",
    "cycle": "B3",
    "data_rncp": "39741",
    "rncp": "39741",
    "niveau": "6",
    "titre": "Bachelor Chargé de communication",
    "certificateur": "Cesacom / Sup de Vinci",
    "campus": "Le Mans",
    "data_key": "cdc"
  },
  {
    "titre_court": "M1 MSMC",
    "cycle": "M1",
    "data_rncp": "38504",
    "rncp": "38504",
    "niveau": "7",
    "titre": "Manager des stratégies marketing et communication — M1",
    "certificateur": "Cesacom / MediaSchool",
    "campus": "Le Mans",
    "data_key": "msmc-m1"
  },
  {
    "titre_court": "M2 MSMC",
    "cycle": "M2",
    "data_rncp": "38504",
    "rncp": "38504",
    "niveau": "7",
    "titre": "Manager des stratégies marketing et communication — M2",
    "certificateur": "Cesacom / MediaSchool",
    "campus": "Le Mans",
    "data_key": "msmc-m2"
  },
  {
    "titre_court": "M1 MRH",
    "cycle": "M1",
    "data_rncp": "41295",
    "rncp": "41295",
    "niveau": "7",
    "titre": "Master Manager des ressources humaines — M1",
    "certificateur": "ISME",
    "campus": "Le Mans",
    "data_key": "mrh-m1"
  },
  {
    "titre_court": "M2 MRH",
    "cycle": "M2",
    "data_rncp": "41295",
    "rncp": "41295",
    "niveau": "7",
    "titre": "Master Manager des ressources humaines — M2",
    "certificateur": "ISME",
    "campus": "Le Mans",
    "data_key": "mrh-m2"
  },
  {
    "titre_court": "M1 MDEC",
    "cycle": "M1",
    "data_rncp": "39354",
    "rncp": "39354",
    "niveau": "7",
    "titre": "Master Manager du développement d'entreprise et commercial — M1",
    "certificateur": "ISME / Aforem",
    "campus": "Le Mans",
    "data_key": "mdec-m1"
  },
  {
    "titre_court": "M2 MDEC",
    "cycle": "M2",
    "data_rncp": "39354",
    "rncp": "39354",
    "niveau": "7",
    "titre": "Master Manager du développement d'entreprise et commercial — M2",
    "certificateur": "ISME / Aforem",
    "campus": "Le Mans",
    "data_key": "mdec-m2"
  }
];

// ─── Comptes RP + périmètres ──────────────────────────────────────────────────
const RP_LE_MANS = [
  {
    "nom": "Azerad",
    "prenom": "Etienne",
    "email": "etienne.azerad@cesacom.fr",
    "password": "atlas2026",
    "campus": "Le Mans",
    // Perimetre CESACOM (cadrage du 03/09/2026) : Bachelor CDC + les deux
    // annees du Mastere MSMC. Perimetre exprime en titre_court, car M1 et M2
    // partagent le meme code RNCP.
    "perimetre": [
      "Bach CDC",
      "M1 MSMC",
      "M2 MSMC"
    ]
  },
  {
    "nom": "Nicolas",
    "prenom": "Johnny",
    "email": "johnny.nicolas@isme.fr",
    "password": "atlas2026",
    "campus": "Le Mans",
    // Perimetre ISME : les deux annees du MRH et du MDEC.
    "perimetre": [
      "M1 MRH",
      "M2 MRH",
      "M1 MDEC",
      "M2 MDEC"
    ]
  }
];

// ─── Jeu de démonstration — MDEC (RNCP 39354, périmètre Johnny) ──────────────
// Activé uniquement par POST /api/setup?demo=1[&mois=2026-09].
// Objectif : donner à L'Atelier de quoi raconter quelque chose. Sans ces
// lignes, la cartographie est à 0 %, le journal est vide et le digest sort
// à 0/0/0 (audit Le Mans, point A3).
//
// MDEC est le seul titre du pilote dont les 44 modules sont tous rattachés à
// une compétence — c'est ce qui en fait le titre de démonstration.
//
// Les 4 intervenants sont fictifs et portent un domaine non routable
// (@demo.emineo-education.fr) : même en cas de clic sur "Valider et envoyer",
// aucun mail ne peut atteindre une vraie personne. Le garde-fou
// ATLAS_MAIL_REDIRECT d'api/fr.js constitue la seconde barrière.
const DEMO_TITRE = 'M1 MDEC';   // libelle du jeu de demonstration (titre_court)
const DEMO_INTERVENANTS = [
  { nom: 'Faure',    prenom: 'Camille', email: 'camille.faure@demo.emineo-education.fr' },
  { nom: 'Renard',   prenom: 'Thomas',  email: 'thomas.renard@demo.emineo-education.fr' },
  { nom: 'Belkacem', prenom: 'Nadia',   email: 'nadia.belkacem@demo.emineo-education.fr' },
  { nom: 'Ménard',   prenom: 'Olivier', email: 'olivier.menard@demo.emineo-education.fr' },
];

// 8 séances prévues, 6 déclarées. Répartition voulue des 4 états du
// comparateur : 4 NOMINAL · 1 ÉCART+ · 1 ÉCART− · 2 ALERTE.
// Aucune séance le 1er du mois : la comparaison de bornes d'api/fr.js les
// exclurait (bug B06, traité au bloc B).
const DEMO_SEANCES = [
  { jour: 7,  module: 'M1',  intervenant: 0, titre: 'Cycle de la veille et cartographie des sources',
    concepts: ['Business Intelligence', 'Cycle de la veille', 'Sources', 'Outils'],
    competences: ['C.1'],
    decl: { couvert: ['Business Intelligence', 'Cycle de la veille', 'Sources', 'Outils'], competences: ['C.1'] } },

  { jour: 8,  module: 'M1',  intervenant: 0, titre: 'De la veille à la décision stratégique',
    concepts: ['Analyse PESTEL', 'Signaux faibles', 'Note de synthèse'],
    competences: ['C.1'],
    decl: { couvert: ['Analyse PESTEL', 'Signaux faibles', 'Note de synthèse', 'Veille concurrentielle', 'Scénarios'],
            competences: ['C.1', 'C.15'] } },

  { jour: 14, module: 'M2',  intervenant: 1, titre: 'Diagnostic interne — chaîne de valeur et ressources',
    concepts: ['Chaîne de valeur', 'Ressources clés', 'VRIO', 'Diagnostic interne'],
    competences: ['C.2'],
    decl: { couvert: ['Chaîne de valeur', 'Ressources clés'], competences: ['C.2'] } },

  { jour: 15, module: 'M2',  intervenant: 1, titre: 'Diagnostic externe et synthèse SWOT',
    concepts: ['Diagnostic externe', 'SWOT', 'Facteurs clés de succès'],
    competences: ['C.2'],
    decl: { couvert: ['Diagnostic externe', 'SWOT', 'Facteurs clés de succès'], competences: ['C.2'] } },

  { jour: 21, module: 'M26', intervenant: 2, titre: 'Veille commerciale augmentée — IA et Big Data',
    concepts: ['Veille commerciale', 'IA appliquée', 'Big Data', 'CRM'],
    competences: ['C.15'],
    decl: { couvert: ['Veille commerciale', 'IA appliquée', 'Big Data', 'CRM'], competences: ['C.15'] } },

  { jour: 22, module: 'M26', intervenant: 2, titre: 'Détecter les opportunités d\u2019innovation',
    concepts: ['Innovation', 'Opportunités marché', 'Prospective', 'Benchmark'],
    competences: ['C.15'],
    decl: null },

  { jour: 28, module: 'M12', intervenant: 3, titre: 'Feuille de route et répartition de la charge',
    concepts: ['Planification', 'Feuille de route', 'Répartition de charge'],
    competences: ['C.29'],
    decl: { couvert: ['Planification', 'Feuille de route', 'Répartition de charge'], competences: ['C.29'] } },

  { jour: 29, module: 'M12', intervenant: 3, titre: 'Supervision et points d\u2019étape',
    concepts: ['Supervision', 'Points d\u2019étape', 'Reporting équipe'],
    competences: ['C.29'],
    decl: null },
];

function jourISO(mois, jour, heure) {
  return `${mois}-${String(jour).padStart(2, '0')}T${heure}:00.000Z`;
}

async function seedDemo(db, formationId, campus, mois, annee) {
  // Idempotence : on repart d'une base propre pour ce titre.
  await db.execute({ sql: 'DELETE FROM declaration WHERE formation_id=? AND annee_scolaire=?', args: [formationId, annee] });
  await db.execute({ sql: 'DELETE FROM previsionnel_seance WHERE formation_id=? AND annee_scolaire=?', args: [formationId, annee] });
  await db.execute({ sql: 'DELETE FROM digest_fr WHERE formation_id=? AND annee_scolaire=?', args: [formationId, annee] });

  // Comptes intervenants fictifs + rattachement au titre (ce sont eux qui
  // alimentent la liste des destinataires du digest).
  const ids = [];
  for (const p of DEMO_INTERVENANTS) {
    let uid;
    const ex = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [p.email] });
    if (ex.rows.length) {
      uid = Number(ex.rows[0].id);
    } else {
      const ins = await db.execute({
        sql: 'INSERT INTO users (role,nom,prenom,email,password_hash,campus) VALUES (?,?,?,?,?,?)',
        args: ['intervenant', p.nom, p.prenom, p.email, hashPassword('atlas2026'), campus],
      });
      uid = Number(ins.lastInsertRowid);
    }
    await db.execute({
      sql: "INSERT OR IGNORE INTO inscription (user_id,formation_id,campus,role,promo,groupe,annee_scolaire) VALUES (?,?,?,'intervenant','','',?)",
      args: [uid, formationId, campus, annee],
    });
    ids.push(uid);
  }

  let nbPrev = 0, nbDecl = 0;
  for (const s of DEMO_SEANCES) {
    const p = DEMO_INTERVENANTS[s.intervenant];
    const nom = `${p.prenom} ${p.nom}`;
    const uid = ids[s.intervenant];
    const date = jourISO(mois, s.jour, '09');

    const ins = await db.execute({
      sql: `INSERT INTO previsionnel_seance
              (formation_id, module_ref, campus, intervenant_id, intervenant_nom,
               numero, titre, date_prevue, modalite, contenu, concepts, competences, annee_scolaire)
            VALUES (?,?,?,?,?,?,?,?,'P','',?,?,?)`,
      args: [formationId, s.module, campus, uid, nom, nbPrev + 1, s.titre, date,
        JSON.stringify(s.concepts), JSON.stringify(s.competences), annee],
    });
    const prevId = Number(ins.lastInsertRowid);
    nbPrev++;

    if (s.decl) {
      await db.execute({
        sql: `INSERT INTO declaration
                (formation_id, module_ref, previsionnel_id, campus, intervenant_id, intervenant_nom,
                 seance_numero, date_seance, source, couvert, competences, compte_rendu, annee_scolaire)
              VALUES (?,?,?,?,?,?,?,?,'demo',?,?,'',?)`,
        args: [formationId, s.module, prevId, campus, uid, nom, nbPrev, date,
          JSON.stringify(s.decl.couvert), JSON.stringify(s.decl.competences), annee],
      });
      nbDecl++;
    }
  }

  return {
    mois,
    intervenants: DEMO_INTERVENANTS.length,
    seances_prevues: nbPrev,
    seances_declarees: nbDecl,
    attendu: '4 conformes · 1 écart + · 1 écart − · 2 alertes',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const db = getDB();

    // ─── Tables de base ──────────────────────────────────────────────────────
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      nom TEXT NOT NULL,
      prenom TEXT DEFAULT '',
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      campus TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS formations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campus TEXT DEFAULT '',
      titre TEXT DEFAULT '',
      rncp TEXT DEFAULT '',
      niveau TEXT DEFAULT '',
      titre_court TEXT DEFAULT '',
      certificateur TEXT DEFAULT '',
      data_json TEXT NOT NULL DEFAULT '{}',
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    for (const col of [
      "ALTER TABLE formations ADD COLUMN rncp TEXT DEFAULT ''",
      "ALTER TABLE formations ADD COLUMN niveau TEXT DEFAULT ''",
      "ALTER TABLE formations ADD COLUMN titre_court TEXT DEFAULT ''",
      "ALTER TABLE formations ADD COLUMN certificateur TEXT DEFAULT ''",
    ]) {
      try { await db.execute(col); } catch (_) {}
    }

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_formations_rncp ON formations(rncp, campus)`);
    // Cle d'idempotence du seed depuis le decoupage par annee de cycle.
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_formations_titre ON formations(titre_court, campus)`);

    // ─── Tables v2 ───────────────────────────────────────────────────────────
    await db.execute(`CREATE TABLE IF NOT EXISTS previsionnel_seance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      formation_id INTEGER NOT NULL,
      module_ref TEXT DEFAULT '',
      campus TEXT NOT NULL,
      intervenant_id INTEGER,
      intervenant_nom TEXT NOT NULL,
      numero INTEGER NOT NULL,
      titre TEXT NOT NULL,
      date_prevue TEXT,
      modalite TEXT NOT NULL DEFAULT 'P',
      contenu TEXT DEFAULT '',
      concepts TEXT NOT NULL DEFAULT '[]',
      competences TEXT NOT NULL DEFAULT '[]',
      annee_scolaire TEXT NOT NULL DEFAULT '2026-27',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_prev_formation ON previsionnel_seance(formation_id, annee_scolaire)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_prev_intervenant ON previsionnel_seance(intervenant_id, annee_scolaire)`);

    await db.execute(`CREATE TABLE IF NOT EXISTS declaration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      formation_id INTEGER NOT NULL,
      module_ref TEXT DEFAULT '',
      previsionnel_id INTEGER,
      campus TEXT NOT NULL,
      intervenant_id INTEGER,
      intervenant_nom TEXT DEFAULT '',
      seance_numero INTEGER,
      date_seance TEXT,
      source TEXT NOT NULL DEFAULT 'fr',
      couvert TEXT NOT NULL DEFAULT '[]',
      competences TEXT NOT NULL DEFAULT '[]',
      compte_rendu TEXT DEFAULT '',
      statut_cr TEXT DEFAULT '',
      ecart TEXT DEFAULT '',
      signal TEXT DEFAULT '',
      annee_scolaire TEXT NOT NULL DEFAULT '2026-27',
      declared_at TEXT DEFAULT (datetime('now'))
    )`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_decl_formation ON declaration(formation_id, annee_scolaire)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_decl_prev ON declaration(previsionnel_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_decl_module_date ON declaration(module_ref, date_seance)`);

    await db.execute(`CREATE TABLE IF NOT EXISTS digest_fr (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      formation_id INTEGER NOT NULL,
      campus TEXT NOT NULL,
      fr_id INTEGER,
      semaine_debut TEXT NOT NULL,
      semaine_fin TEXT NOT NULL,
      contenu_genere TEXT NOT NULL DEFAULT '{}',
      statut TEXT NOT NULL DEFAULT 'genere',
      valide_par INTEGER,
      valide_at TEXT,
      envoye_at TEXT,
      resend_id TEXT,
      destinataires TEXT NOT NULL DEFAULT '[]',
      annee_scolaire TEXT NOT NULL DEFAULT '2026-27',
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_digest_formation ON digest_fr(formation_id, annee_scolaire)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_digest_fr ON digest_fr(fr_id, statut)`);
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_digest_semaine ON digest_fr(formation_id, campus, semaine_debut)`);

    // ─── Table v3 inscription ────────────────────────────────────────────────
    await db.execute(`CREATE TABLE IF NOT EXISTS inscription (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      formation_id INTEGER NOT NULL,
      campus TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      promo TEXT DEFAULT '',
      groupe TEXT DEFAULT '',
      annee_scolaire TEXT NOT NULL DEFAULT '2026-27',
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_insc_user ON inscription(user_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_insc_formation ON inscription(formation_id, annee_scolaire)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_insc_campus ON inscription(campus, annee_scolaire)`);
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_insc_unique ON inscription(user_id, formation_id, promo, groupe, annee_scolaire)`);

    // ─── Comptes Direction ───────────────────────────────────────────────────
    const dirAccounts = [
      { nom: 'Robert',    prenom: 'Arnaud',  email: 'arnaud.robert@emineo-education.fr',    password: 'atlas2026' },
      { nom: 'Hervé',     prenom: 'Ludovic', email: 'ludovic.herve@emineo-education.fr',    password: 'atlas2026' },
      { nom: 'Kornowski', prenom: 'Sylvain', email: 'sylvain.kornowski@emineo-education.fr', password: 'atlas2026' },
      // Directeur du campus du Mans — acces a l'ensemble du perimetre pilote.
      { nom: 'Duclos',    prenom: 'Sylvain', email: 'sylvain.duclos@emineo-education.fr',    password: 'atlas2026' },
    ];
    let createdDir = 0;
    for (const a of dirAccounts) {
      const ex = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [a.email] });
      if (!ex.rows.length) {
        await db.execute({ sql: 'INSERT INTO users (role,nom,prenom,email,password_hash,campus) VALUES (?,?,?,?,?,?)', args: ['dir',a.nom,a.prenom,a.email,hashPassword(a.password),'tous'] });
        createdDir++;
      }
    }

    // ─── Seed formations Le Mans (idempotent par titre_court+campus) ────────
    // Cle = titre_court + campus : M1 et M2 d'un meme Mastere partagent le code
    // RNCP, rncp+campus ne discriminerait plus depuis le decoupage par annee de
    // cycle (03/09/2026).
    // Par defaut, une formation deja en base n'est mise a jour que si ses blocs
    // sont vides — pour ne jamais ecraser un referentiel enrichi a la main.
    // ?force=1 leve cette protection : indispensable quand DATA_LE_MANS evolue
    // (ex. reconstruction du MSMC 38504 sur le referentiel officiel de juillet
    // 2023, le 25/08/2026). A n'utiliser que volontairement.
    const forceRefs = req.query && (req.query.force === '1' || req.query.force === 'true');
    let createdFormations = 0, updatedFormations = 0;
    const formationIds = {};

    for (const f of FORMATIONS_LE_MANS) {
      // Copie defensive : plusieurs annees de cycle partagent le meme objet
      // source dans DATA_LE_MANS, une mutation directe fuirait de M1 vers M2.
      const data = JSON.parse(JSON.stringify(DATA_LE_MANS[f.data_rncp] || {}));
      data._campus = f.campus;
      data._cycle = f.cycle;
      // Les modules ne portent pas encore de marqueur d'annee : M1 et M2
      // heritent du referentiel complet du titre. Le taux de couverture par
      // annee restera donc sous-evalue tant que le decoupage des modules par
      // annee de cycle n'aura pas ete instruit avec la Direction des programmes.
      data._note_cycle = 'Référentiel complet du titre. Modules non encore ventilés par année de cycle.';
      const dataStr = JSON.stringify(data);

      const ex = await db.execute({
        sql: 'SELECT id, data_json FROM formations WHERE titre_court = ? AND campus = ?',
        args: [f.titre_court, f.campus],
      });
      if (ex.rows.length) {
        const row = ex.rows[0];
        formationIds[f.titre_court] = Number(row.id);
        let existing = {};
        try { existing = JSON.parse(row.data_json || '{}'); } catch(_) {}
        if (forceRefs || !existing.blocs || existing.blocs.length === 0) {
          await db.execute({
            sql: 'UPDATE formations SET titre=?,rncp=?,niveau=?,titre_court=?,certificateur=?,data_json=? WHERE id=?',
            args: [f.titre, f.rncp, f.niveau, f.titre_court, f.certificateur, dataStr, row.id],
          });
          updatedFormations++;
        }
      } else {
        const ins = await db.execute({
          sql: 'INSERT INTO formations (campus,titre,rncp,niveau,titre_court,certificateur,data_json,created_at) VALUES (?,?,?,?,?,?,?,datetime(\'now\'))',
          args: [f.campus, f.titre, f.rncp, f.niveau, f.titre_court, f.certificateur, dataStr],
        });
        formationIds[f.titre_court] = Number(ins.lastInsertRowid);
        createdFormations++;
      }
    }

    // ─── Purge hors périmètre (titres + campus) ─────────────────────────────
    // Le seed ci-dessus ajoute et met a jour, mais ne retire jamais. Deux
    // categories sont donc a nettoyer explicitement :
    //   1. les titres du Mans sortis de FORMATIONS_LE_MANS (BTS, Bachelors
    //      hors CDC) — decision du 02/09/2026 ;
    //   2. toutes les formations d'un autre campus que Le Mans — Le Mans est
    //      le seul site pilote, decision du 03/09/2026.
    // Sans cette purge elles resteraient visibles depuis un compte 'dir', qui
    // ne filtre pas par perimetre RP.
    // Protegee par ?purge=1 : jamais declenchee par un rejeu de routine.
    const veutPurge = req.query && (req.query.purge === '1' || req.query.purge === 'true');
    const titresAutorises = FORMATIONS_LE_MANS.map(f => f.titre_court);
    let purge = null;

    {
      const ph = titresAutorises.map(() => '?').join(',');
      const horsPerimetre = await db.execute({
        sql: `SELECT id, rncp, campus, titre_court FROM formations
              WHERE campus <> ? OR titre_court NOT IN (${ph})`,
        args: ['Le Mans', ...titresAutorises],
      });
      const cibles = horsPerimetre.rows.map(r => ({
        id: Number(r.id),
        campus: String(r.campus || ''),
        libelle: `${String(r.campus || '—')} · ${String(r.titre_court || r.rncp || 'sans libellé')}`,
      }));

      if (!cibles.length) {
        purge = { effectuee: false, motif: 'Aucune formation hors périmètre en base.', cibles: [] };
      } else if (!veutPurge) {
        purge = {
          effectuee: false,
          motif: 'Formations hors périmètre détectées. Relancer avec ?purge=1 pour les supprimer.',
          cibles: cibles.map(c => c.libelle),
        };
      } else {
        let supprLignes = 0;
        for (const c of cibles) {
          for (const t of ['previsionnel_seance', 'declaration', 'digest_fr', 'inscription']) {
            try {
              const r = await db.execute({ sql: `DELETE FROM ${t} WHERE formation_id = ?`, args: [c.id] });
              supprLignes += Number(r.rowsAffected || 0);
            } catch (_) {}
          }
          await db.execute({ sql: 'DELETE FROM formations WHERE id = ?', args: [c.id] });
        }

        purge = {
          effectuee: true,
          cibles: cibles.map(c => c.libelle),
          formations_supprimees: cibles.length,
          autres_campus_supprimes: cibles.filter(c => c.campus !== 'Le Mans').length,
          lignes_dependantes_supprimees: supprLignes,
        };
      }
    }

    // ─── Nettoyage des comptes FR placeholder ────────────────────────────────
    // Les seeds anterieurs creaient un compte FR "À nommer" par titre. Ils ne
    // sont plus generes : on retire ceux qui restent, a condition qu'ils
    // n'aient jamais ete renommes ni rattaches a une formation. Un FR
    // reellement nomme est conserve — a arbitrer manuellement.
    let frPlaceholdersSupprimes = 0;
    if (veutPurge) {
      const frOrphelins = await db.execute({
        sql: "SELECT u.id FROM users u WHERE u.role='fr' AND u.nom='À nommer' AND u.email LIKE 'fr.%@emineo-education.fr' AND NOT EXISTS (SELECT 1 FROM inscription i WHERE i.user_id = u.id)",
        args: [],
      });
      for (const row of frOrphelins.rows) {
        await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [Number(row.id)] });
        await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [Number(row.id)] });
        frPlaceholdersSupprimes++;
      }
      if (purge) purge.comptes_fr_placeholder_supprimes = frPlaceholdersSupprimes;
    }

    // ─── Comptes RP Le Mans + inscriptions ───────────────────────────────────
    let createdRP = 0, createdInscriptions = 0, purgedInscriptions = 0;
    for (const rp of RP_LE_MANS) {
      let rpId;
      const ex = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [rp.email] });
      if (ex.rows.length) {
        rpId = Number(ex.rows[0].id);
      } else {
        const ins = await db.execute({ sql: 'INSERT INTO users (role,nom,prenom,email,password_hash,campus) VALUES (?,?,?,?,?,?)', args: ['rp',rp.nom,rp.prenom,rp.email,hashPassword(rp.password),rp.campus] });
        rpId = Number(ins.lastInsertRowid);
        createdRP++;
      }
      // Périmètre attendu pour ce RP.
      const fidsAttendus = rp.perimetre.map(t => formationIds[t]).filter(Boolean);

      // Purge des inscriptions RP hors périmètre. Indispensable au rejeu :
      // INSERT OR IGNORE ajoute, mais ne retire jamais. Sans cette purge, le
      // BTS COM resterait rattaché à Etienne après la correction A2.
      const inscExistantes = await db.execute({
        sql: "SELECT id, formation_id FROM inscription WHERE user_id=? AND role='rp'",
        args: [rpId],
      });
      for (const row of inscExistantes.rows) {
        if (!fidsAttendus.includes(Number(row.formation_id))) {
          await db.execute({ sql: 'DELETE FROM inscription WHERE id = ?', args: [row.id] });
          purgedInscriptions++;
        }
      }

      for (const fid of fidsAttendus) {
        try {
          await db.execute({ sql: "INSERT OR IGNORE INTO inscription (user_id,formation_id,campus,role,promo,groupe,annee_scolaire) VALUES (?,?,?,'rp','','','2026-27')", args: [rpId,fid,rp.campus] });
          createdInscriptions++;
        } catch(_) {}
      }
    }

    // ─── Comptes FR (Formateur Référent) — non seedes ────────────────────────
    // Le role 'fr' reste actif dans le schema et dans les garde-fous d'acces
    // (api/fr.js autorise dir + fr + rp), mais aucun compte FR n'est cree :
    // le perimetre pilote arrete au 03/09/2026 ne compte que 6 acteurs, les
    // deux RP couvrant eux-memes le poste de travail de leur pole. La creation
    // de comptes FR reels se fera via l'ecran Comptes, apres validation du
    // role et de sa compensation par la Direction generale.

    // ─── Jeu de démonstration (optionnel) ────────────────────────────────────
    // POST /api/setup?demo=1        → seed MDEC sur septembre 2026
    // POST /api/setup?demo=1&mois=2026-10 → autre mois
    // Sans ?demo=1, rien n'est seedé : le comportement historique est inchangé.
    let demo = null;
    const veutDemo = req.query && (req.query.demo === '1' || req.query.demo === 'true');
    if (veutDemo) {
      const mois = (req.query.mois && /^\d{4}-\d{2}$/.test(req.query.mois)) ? req.query.mois : '2026-09';
      const fid = formationIds[DEMO_TITRE];
      if (!fid) {
        demo = { error: `Formation ${DEMO_TITRE} introuvable — seed démo ignoré.` };
      } else {
        demo = await seedDemo(db, fid, 'Le Mans', mois, '2026-27');
        demo.formation_id = fid;
        demo.titre = DEMO_TITRE;
      }
    }

    return res.status(200).json({
      ok: true,
      message: 'Migration + seed Le Mans complets.',
      details: {
        comptes_dir_crees: createdDir,
        formations_creees: createdFormations,
        formations_mises_a_jour: updatedFormations,
        referentiels_forces: !!forceRefs,
        rp_crees: createdRP,
        inscriptions_rp: createdInscriptions,
        inscriptions_rp_purgees: purgedInscriptions,
        fr_seedes: 0,
        fr_placeholders_supprimes: frPlaceholdersSupprimes,
      },
      purge,
      demo,
      comptes: {
        dir: dirAccounts.map(a => ({ email: a.email, mdp: a.password })),
        rp: RP_LE_MANS.map(a => ({ email: a.email, mdp: a.password, titres: a.perimetre.length })),
        fr: 'Aucun compte FR seedé — à créer via l\'écran Comptes après validation du rôle.',
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
