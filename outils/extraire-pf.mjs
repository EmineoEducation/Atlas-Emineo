// outils/extraire-pf.mjs — Atlas Éminéo
//
// Extracteur déterministe des plans de formation CESACOM / ISME.
// Aucun appel à un modèle de langage : le plan est un tableau, il se lit.
//
// Format attendu (constaté sur PF-Bachelor_CDC_25-27_Vdef.xlsx) :
//   - une feuille par année de cycle ; seule l'année certifiante est retenue
//   - ligne 1  : intitulé du titre + code RNCP
//   - ligne 2  : en-têtes de colonnes
//   - colonne A : intitulé du module, ou d'une section
//   - colonne B : volume horaire
//   - colonne C : compétences visées par le module (« C1 », « C4.2 », « C3 à C5 »)
//   - colonne D : épreuve certificative rattachée
//   - colonne E : commentaire
//   - colonne F : référentiel de compétences, recopié en vrac (ignoré : le RACE
//                 fait foi, et cette colonne n'est pas alignée sur les blocs)
//   - lignes teintées : sections. Un bloc de compétences se reconnaît au motif
//     « Bloc NN - », les autres sections sont hors périmètre certifiant.
//
// La teinte seule ne suffit pas : dans le fichier de référence, « Identité
// d'agence » est teinté comme une section alors que c'est un module doté d'un
// volume et d'une compétence. Le motif « Bloc NN » tranche, et le contrôle
// arithmétique final confirme.

import { readFileSync } from 'node:fs';
import { lireClasseurComplet } from './lire-xlsx-cellules.mjs';

// Sections qui ne sont pas des blocs de compétences certifiants.
// Lignes de synthèse : ni bloc, ni section. Elles totalisent, elles ne
// contiennent pas.
const LIGNES_IGNOREES = [
  /^total\s+volum/i,
  /^volum[eé]trie\s+cible/i,
];

// Le programme détaillé des options est un tableau à part, traité séparément.
const RE_PROG_OPTIONS = /^programme\s+des\s+.*intensives/i;

const SECTIONS_HORS_BLOC = [
  /^remise\s+[aà]\s+niveau/i,
  /^comp[eé]tences\s+transversales/i,
  /^organisation\s+p[eé]dagogique/i,
  /^[eé]preuves\s+de\s+certification/i,
];

const RE_BLOC = /^bloc\s*0*(\d+)\s*[-–—:]\s*(.+)$/i;

function nettoyer(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

// Variante conservant les sauts de ligne, pour les champs dont ils portent la
// structure : épreuves multiples, contenu des semaines d'option.
function nettoyerMulti(v) {
  return String(v == null ? '' : v).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

// « C1 », « C4.2 », « C3 à C5 », « C1 à C13 » → liste de codes d'activité.
// Renvoie { codes, plage }. La distinction compte : « C4.2 » désigne un
// enseignement dédié, « C3 à C5 » une simple mention dans un module transverse.
// Les confondre effaçait le signal le plus utile du plan — les compétences que
// personne n'enseigne nommément.
export function codesCompetences(brut) {
  const s = nettoyer(brut);
  if (!s) return { codes: [], plage: false };
  const plage = s.match(/^C\s*(\d+)(?:\.\d+)?\s*(?:à|a|-|–)\s*C?\s*(\d+)(?:\.\d+)?$/i);
  if (plage) {
    const [a, b] = [Number(plage[1]), Number(plage[2])];
    const out = [];
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push('C' + i);
    return { codes: out, plage: true };
  }
  const codes = [...s.matchAll(/C\s*(\d+)(\.\d+)?/gi)]
    .map(m => 'C' + m[1] + (m[2] || ''));
  return { codes: Array.from(new Set(codes)), plage: false };
}

export function extraire(chemin, cfg) {
  const { feuille, rncp, titre, titreCourt, campus, annee_cycle } = cfg;
  // Sections conservées comme blocs alors qu'elles ne portent pas le motif
  // « Bloc NN », et sélection nominative de leurs modules. Décision
  // pédagogique, déclarée par titre : elle ne se devine pas du fichier.
  const conservees = cfg.sections_conservees || {};
  const exclues = cfg.sections_exclues || [];
  const buf = readFileSync(chemin);
  const classeur = lireClasseurComplet(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const f = classeur.feuilles.find(x => x.nom === feuille);
  if (!f) throw new Error(`Feuille « ${feuille} » absente. Disponibles : ${classeur.feuilles.map(x => x.nom).join(', ')}`);

  const val = (r, c) => nettoyer(f.cellules[r] && f.cellules[r][c] && f.cellules[r][c].v);
  const valM = (r, c) => nettoyerMulti(f.cellules[r] && f.cellules[r][c] && f.cellules[r][c].v);
  const teinte = r => (f.cellules[r] && f.cellules[r][0] && f.cellules[r][0].fill) || '';

  const blocs = [];
  const sectionsHorsBloc = [];   // enseignements sans épreuve rattachée
  const horsPerimetre = [];
  const epreuvesPlanifiees = [];
  const anomalies = [];
  let courant = null;          // section en cours
  let dernierModule = null;    // conservé pour la réconciliation
  let ligneOptions = -1;       // début du tableau des options intensives

  for (let r = 2; r < f.nbLignes; r++) {
    const titreCell = val(r, 0);
    if (!titreCell) continue;

    const volume = parseFloat(String(val(r, 1)).replace(',', '.'));
    const { codes: comps, plage: compsPlage } = codesCompetences(val(r, 2));
    const estTeinte = !!teinte(r);

    // ── Section ──────────────────────────────────────────────────────────────
    if (LIGNES_IGNOREES.some(re => re.test(titreCell))) { courant = null; dernierModule = null; continue; }
    if (RE_PROG_OPTIONS.test(titreCell)) { ligneOptions = r; break; }

    const mBloc = titreCell.match(RE_BLOC);
    const conserve = Object.keys(conservees).find(k => nettoyer(k).toLowerCase() === titreCell.toLowerCase());
    const horsBloc = !conserve && (exclues.some(k => nettoyer(k).toLowerCase() === titreCell.toLowerCase())
      || SECTIONS_HORS_BLOC.some(re => re.test(titreCell)));

    if (conserve) {
      // Un bloc de compétences se définit par ses épreuves de certification.
      // Les enseignements transversaux — anglais, expression, personal
      // branding — n'en portent aucune : les ériger en sixième bloc gonflait la
      // cartographie et laissait croire à une certification qui n'existe pas.
      // Ils sont conservés comme modules rattachés à aucun bloc.
      const d = conservees[conserve];
      courant = {
        horsBlocRetenu: true, titre: d.titre || titreCell,
        volume_annonce: null,
        _filtre: (d.modules || []).map(x => nettoyer(x).toLowerCase()),
        modules: [], ecartes: [],
      };
      sectionsHorsBloc.push(courant);
      dernierModule = null;
      continue;
    }

    if (mBloc) {
      courant = {
        id: 'B' + String(mBloc[1]).padStart(2, '0'),
        titre: nettoyer(mBloc[2]),
        nature: 'obligatoire',
        volume_annonce: isFinite(volume) ? volume : null,
        competences: [],
        modules: [],
      };
      blocs.push(courant);
      dernierModule = null;
      continue;
    }
    if (/^[eé]preuves\s+de\s+certification/i.test(titreCell)) {
      courant = { hors: true, epreuves: true, titre: titreCell, volume_annonce: isFinite(volume) ? volume : null, modules: [] };
      horsPerimetre.push(courant);
      dernierModule = null;
      continue;
    }
    if (horsBloc) {
      courant = { hors: true, titre: titreCell, volume_annonce: isFinite(volume) ? volume : null, modules: [] };
      horsPerimetre.push(courant);
      dernierModule = null;
      continue;
    }

    // ── Module ───────────────────────────────────────────────────────────────
    if (!courant) { anomalies.push({ ligne: r + 1, message: `« ${titreCell} » hors de toute section` }); continue; }

    // Les lignes de la section « Épreuves de certification » décrivent le
    // déroulement des EC : durée et date de programmation. C'est ce qui relie
    // un bloc à son évaluation, donc l'information la plus structurante du plan.
    if (courant.epreuves) {
      const com = valM(r, 4);
      const dateM = com.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      epreuvesPlanifiees.push({
        intitule: titreCell,
        volume: isFinite(volume) ? volume : null,
        date: dateM ? dateM[1] : '',
        note: com,
      });
      courant.modules.push({ titre: titreCell, volume: isFinite(volume) ? volume : null, competences_liees: [], sous_modules: [] });
      continue;
    }

    const mod = {
      titre: titreCell,
      volume: isFinite(volume) ? volume : null,
      competences_liees: comps,
      competences_plage: compsPlage,
      epreuve: valM(r, 3) || '',
      commentaire: valM(r, 4) || '',
      sous_modules: [],
    };

    mod._teinte = estTeinte;
    // Sélection nominative : ce qui n'est pas retenu est écarté explicitement,
    // avec son volume, pour que l'exclusion reste visible et chiffrée.
    if (courant._filtre && !courant._filtre.includes(titreCell.toLowerCase())) {
      courant.ecartes.push({ titre: titreCell, volume: mod.volume });
      continue;
    }
    courant.modules.push(mod);
    dernierModule = mod;
  }

  // ── Réconciliation par les volumes ─────────────────────────────────────────
  // Certains modules se décomposent en ateliers listés juste en dessous. Rien
  // ne les distingue visuellement de façon fiable : parents et enfants sont
  // teintés, simplement d'une teinte différente. C'est le total annoncé en tête
  // de section qui tranche — si la somme le dépasse, on cherche un module dont
  // le volume égale celui des lignes suivantes dépourvues de compétence, et on
  // les lui rattache. La somme retombe alors juste, ou l'anomalie est signalée.
  for (const s of [...blocs, ...sectionsHorsBloc, ...horsPerimetre]) {
    if (s.volume_annonce == null) continue;
    const somme = () => s.modules.reduce((n, m) => n + (m.volume || 0), 0);
    if (Math.abs(somme() - s.volume_annonce) < 0.01) continue;

    for (let i = 0; i < s.modules.length; i++) {
      const parent = s.modules[i];
      if (!parent.volume) continue;
      let cumul = 0;
      const enfants = [];
      for (let j = i + 1; j < s.modules.length; j++) {
        const c = s.modules[j];
        if (c.competences_liees.length || !c.volume) break;
        cumul += c.volume;
        enfants.push(c);
        if (Math.abs(cumul - parent.volume) < 0.01) break;
      }
      if (!enfants.length || Math.abs(cumul - parent.volume) > 0.01) continue;
      // Le rattachement ne vaut que s'il fait retomber le total juste.
      if (Math.abs(somme() - cumul - s.volume_annonce) > 0.01) continue;
      parent.sous_modules = enfants.map(c => ({ titre: c.titre, volume: c.volume }));
      s.modules.splice(i + 1, enfants.length);
      break;
    }
  }

  // ── Contrôle arithmétique ──────────────────────────────────────────────────
  // Le volume annoncé en tête de section doit égaler la somme de ses modules.
  // C'est la vérification qui prouve que le découpage est juste : si une ligne
  // a été prise pour une section, ou l'inverse, le total ne tombe pas.
  const controles = [];
  for (const s of [...blocs, ...sectionsHorsBloc, ...horsPerimetre]) {
    const somme = (s.modules || []).reduce((n, m) => n + (m.volume || 0), 0);
    const ok = s.volume_annonce == null || Math.abs(somme - s.volume_annonce) < 0.01;
    controles.push({ titre: s.titre, annonce: s.volume_annonce, calcule: +somme.toFixed(1), ok });
    if (!ok) anomalies.push({ message: `Volume de « ${s.titre} » : ${s.volume_annonce} annoncé, ${somme.toFixed(1)} calculé` });
    for (const m of s.modules || []) {
      if (!m.sous_modules.length) continue;
      const sm = m.sous_modules.reduce((n, x) => n + (x.volume || 0), 0);
      if (Math.abs(sm - (m.volume || 0)) > 0.01) {
        anomalies.push({ message: `Sous-modules de « ${m.titre} » : ${m.volume} annoncé, ${sm.toFixed(1)} calculé` });
      }
    }
    delete s.volume_annonce; delete s._filtre; delete s._volume_section;
  }
  for (const b of blocs) for (const m of b.modules) delete m._teinte;
  for (const s of sectionsHorsBloc) { delete s._filtre; for (const m of s.modules) delete m._teinte; }

  // ── Épreuves de certification par bloc ─────────────────────────────────────
  // La colonne D porte, sur la première ligne d'un bloc, la ou les épreuves qui
  // le sanctionnent. Un bloc en compte une ou deux — c'est sa définition même.
  // Le libellé entre parenthèses décrit l'objet évalué, pas une épreuve de plus.
  for (const b of blocs) {
    const brut = (b.modules.find(m => m.epreuve) || {}).epreuve || '';
    b.epreuves = [];
    let objet = '';
    for (const ligne of brut.split('\n').map(x => x.trim()).filter(Boolean)) {
      const par = ligne.match(/^\((.+)\)$/);
      if (par) { objet = par[1]; continue; }
      const m = ligne.match(/^(.*?)\s*:\s*(.+)$/);
      b.epreuves.push(m ? { intitule: nettoyer(m[1]), modalite: nettoyer(m[2]) } : { intitule: nettoyer(ligne), modalite: '' });
    }
    if (objet) for (const e of b.epreuves) e.objet = objet;
  }

  // Rapprochement avec le calendrier des épreuves, déclaré par titre : le
  // libellé du calendrier (« Grand final ») ne ressemble pas toujours à celui de
  // l'épreuve (« EC MSPR Compet' nat' »). Ce lien est une donnée pédagogique,
  // il se déclare plutôt qu'il ne se devine.
  const liens = cfg.calendrier_epreuves || {};
  for (const b of blocs) {
    for (const e of b.epreuves) {
      const cible = Object.keys(liens).find(k => nettoyer(k).toLowerCase() === e.intitule.toLowerCase());
      const plan = cible ? epreuvesPlanifiees.find(p => nettoyer(p.intitule).toLowerCase() === nettoyer(liens[cible]).toLowerCase()) : null;
      if (plan) { e.duree = plan.volume; e.date = plan.date; e.note = plan.note; e.calendrier = plan.intitule; }
    }
  }

  // Compétences de chaque bloc, déduites des modules qui le composent.
  for (const b of blocs) {
    const nommees = new Set(), mentionnees = new Set();
    for (const m of b.modules) {
      for (const c of m.competences_liees) {
        (m.competences_plage ? mentionnees : nommees).add(c.split('.')[0]);
      }
    }
    const tri = (a, b2) => Number(a.slice(1)) - Number(b2.slice(1));
    b.competences = [...nommees].sort(tri);
    // Simplement évoquées par un module transverse : conservé à part, pour ne
    // pas faire croire que le bloc les enseigne.
    b.competences_mentionnees = [...mentionnees].filter(c => !nommees.has(c)).sort(tri);
  }

  // ── Options intensives ─────────────────────────────────────────────────────
  // Trois parcours au choix, décrits sous le tableau principal. Ils ne
  // constituent pas des blocs : ce sont trois contenus possibles d'un même
  // module (« Semaines intensives d'option », 70 h dans le bloc 04). Un
  // étudiant en suit un seul, et le volume ne se cumule donc pas.
  const options = [];
  if (ligneOptions >= 0) {
    for (let r = ligneOptions + 1; r < f.nbLignes; r++) {
      const t = val(r, 0);
      if (!t) continue;
      if (/^option\b/i.test(t)) {
        options.push({ titre: t, semaines: [] });
      } else if (options.length) {
        // La ligne suivante porte le contenu des deux semaines, une par colonne.
        for (const c of [0, 1]) {
          const contenu = valM(r, c);
          if (contenu) options[options.length - 1].semaines.push(contenu);
        }
      }
    }
  }
  // Rattachement au module qui les porte.
  const moduleOption = blocs.flatMap(b => b.modules).find(m => /intensives?\s+d'option/i.test(m.titre));
  if (moduleOption && options.length) {
    moduleOption.nature = 'option';
    moduleOption.option_groupe = 'Semaines intensives';
    moduleOption.parcours = options.map(o => ({
      titre: o.titre,
      semaines: o.semaines.map(s2 => {
        const [entete, ...reste] = s2.split(/\s*⏎\s*|\n/);
        return { intitule: nettoyer(reste[0] || entete), libelle: nettoyer(entete), detail: nettoyer(reste.slice(1).join(' ')) };
      }),
    }));
  }

  return {
    formation: { rncp, titre, titre_court: titreCourt, campus, annee_cycle, source: chemin.split('/').pop(), feuille },
    options_intensives: options.length,
    blocs,
    // Enseignements sans épreuve de certification rattachée : ils comptent dans
    // la formation mais ne constituent pas un bloc.
    modules_hors_bloc: sectionsHorsBloc.flatMap(s => s.modules.map(m => ({ ...m, section: s.titre }))),
    hors_bloc_ecartes: sectionsHorsBloc.flatMap(s => s.ecartes || []),
    epreuves_planifiees: epreuvesPlanifiees,
    hors_perimetre: horsPerimetre.map(s => ({ titre: s.titre, modules: s.modules.length })),
    controles,
    anomalies,
  };
}
