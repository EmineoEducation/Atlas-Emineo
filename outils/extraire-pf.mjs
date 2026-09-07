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
  const teinte = r => (f.cellules[r] && f.cellules[r][0] && f.cellules[r][0].fill) || '';

  const blocs = [];
  const horsPerimetre = [];
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
      const d = conservees[conserve];
      courant = {
        id: d.id, titre: d.titre || titreCell, nature: 'obligatoire',
        volume_annonce: null,   // sélection partielle : le total du fichier ne s'applique plus
        _filtre: (d.modules || []).map(x => nettoyer(x).toLowerCase()),
        _volume_section: isFinite(volume) ? volume : null,
        competences: [], modules: [], ecartes: [],
      };
      blocs.push(courant);
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
    if (horsBloc) {
      courant = { hors: true, titre: titreCell, volume_annonce: isFinite(volume) ? volume : null, modules: [] };
      horsPerimetre.push(courant);
      dernierModule = null;
      continue;
    }

    // ── Module ───────────────────────────────────────────────────────────────
    if (!courant) { anomalies.push({ ligne: r + 1, message: `« ${titreCell} » hors de toute section` }); continue; }

    const mod = {
      titre: titreCell,
      volume: isFinite(volume) ? volume : null,
      competences_liees: comps,
      competences_plage: compsPlage,
      epreuve: val(r, 3) || '',
      commentaire: val(r, 4) || '',
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
  for (const s of [...blocs, ...horsPerimetre]) {
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
  for (const s of [...blocs, ...horsPerimetre]) {
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
    delete s.volume_annonce; delete s._filtre;
  }
  for (const b of blocs) for (const m of b.modules) delete m._teinte;

  // Compétences de chaque bloc, déduites des modules qui le composent.
  for (const b of blocs) {
    const set = new Set();
    for (const m of b.modules) m.competences_liees.forEach(c => set.add(c.split('.')[0]));
    b.competences = [...set].sort((a, b2) => Number(a.slice(1)) - Number(b2.slice(1)));
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
          const contenu = val(r, c);
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
    hors_perimetre: horsPerimetre.map(s => ({ titre: s.titre, modules: s.modules.length })),
    controles,
    anomalies,
  };
}
