// outils/construire-referentiel.mjs — Atlas Éminéo
//
// Assemble le référentiel exploitable d'un titre : plan de formation extrait,
// croisé avec le RACE officiel. Produit un fichier dans referentiels/ et un
// rapport de couverture à l'écran.
//
// Usage : node outils/construire-referentiel.mjs bach-cdc
//
// La configuration de chaque titre vit dans outils/titres.mjs. Ajouter un titre
// consiste à y déclarer sa feuille et ses sections — jamais à modifier le code.

import { writeFileSync, readFileSync } from 'node:fs';
import { extraire } from './extraire-pf.mjs';
import { TITRES } from './titres.mjs';

const cle = process.argv[2];
const cfg = TITRES[cle];
if (!cfg) {
  console.error(`Titre inconnu : ${cle}. Connus : ${Object.keys(TITRES).join(', ')}`);
  process.exit(1);
}

const pf = extraire(cfg.source, cfg);
const race = JSON.parse(readFileSync(cfg.race, 'utf-8'));

// ── Croisement plan de formation × RACE ──────────────────────────────────────
// Les deux référentiels ne numérotent pas au même niveau. Le RACE 39741 découpe
// en treize activités (C1…C13) que le plan cite directement. Le RACE 38504
// numérote ses vingt-huit compétences (C.1…C.22-III), et le plan les cite sans
// leur suffixe de spécialisation — « C20 » dans le bloc SPE 5 désigne C.20-II.
// Le mode de correspondance est donc déclaré par titre, jamais deviné.
const mode = cfg.codes_pf || 'activites';
const corrBlocs = cfg.correspondance_blocs || {};

// Index des compétences du RACE, par code nu et par code complet.
const parCode = new Map();
for (const a of race.activites) {
  for (const c of a.competences) {
    parCode.set(c.id, { ...c, activite: a.code || a.id, activite_libelle: a.libelle, bloc: a.bloc || '' });
  }
}

// Résout un code du plan vers une ou plusieurs compétences du RACE.
function resoudre(code, blocLocal) {
  const nu = String(code).replace(/^C\.?/i, '');
  if (mode === 'competences') {
    const blocRace = corrBlocs[blocLocal] || '';
    // Une spécialisation suffixe ses compétences : C20 dans le bloc 4-II est
    // C.20-II. Le suffixe se lit sur le bloc, pas sur le code.
    const suffixe = (blocRace.match(/-(I{1,3})$/) || [, ''])[1];
    const cible = 'C.' + nu + (suffixe ? '-' + suffixe : '');
    return parCode.has(cible) ? [parCode.get(cible)] : (parCode.has('C.' + nu) ? [parCode.get('C.' + nu)] : []);
  }
  // Mode activités : le code désigne une activité, on prend ses compétences.
  const act = race.activites.find(a => a.id === 'C' + nu || a.code === 'C' + nu);
  return act ? act.competences.map(c => parCode.get(c.id)).filter(Boolean) : [];
}

const tousModules = [
  ...pf.blocs.flatMap(b => b.modules.map(m => ({ ...m, bloc: b.id }))),
  ...(pf.modules_hors_bloc || []).map(m => ({ ...m, bloc: 'hors bloc' })),
];

const couverture = new Map([...parCode.keys()].map(k => [k, []]));
for (const m of tousModules) {
  for (const code of (m.competences_liees || [])) {
    for (const c of resoudre(code, m.bloc)) {
      if (couverture.has(c.id)) couverture.get(c.id).push({ bloc: m.bloc, module: m.titre, plage: !!m.competences_plage });
    }
  }
}

const nonCouvertes = [];
const couverturesLarges = [];
for (const [id, refs] of couverture) {
  if (!refs.length) { nonCouvertes.push(id); continue; }
  if (!refs.some(r => !r.plage)) {
    couverturesLarges.push({ competence: id, libelle: (parCode.get(id) || {}).libelle || '', via: [...new Set(refs.map(r => r.module))] });
  }
}

// Chaque bloc reçoit les compétences officielles qu'il porte.
for (const b of pf.blocs) {
  const vues = new Map();
  for (const m of b.modules) {
    for (const code of (m.competences_liees || [])) {
      if (m.competences_plage) continue;
      for (const c of resoudre(code, b.id)) vues.set(c.id, c);
    }
    for (const sm of (m.sous_modules || [])) {
      for (const code of (sm.competences_liees || [])) for (const c of resoudre(code, b.id)) vues.set(c.id, c);
    }
  }
  b.competences_race = [...vues.values()].map(c => ({ id: c.id, libelle: c.libelle, activite: c.activite }));
  b.bloc_race = corrBlocs[b.id] || '';
}

const sortie = {
  genere_le: new Date().toISOString().slice(0, 10),
  outil: 'outils/construire-referentiel.mjs',
  formation: pf.formation,
  race: { rncp: race.rncp, intitule: race.intitule, certificateur: race.certificateur, source: race.source },
  blocs: pf.blocs,
  modules_hors_bloc: pf.modules_hors_bloc || [],
  hors_bloc_ecartes: pf.hors_bloc_ecartes || [],
  epreuves_planifiees: pf.epreuves_planifiees || [],
  hors_perimetre: pf.hors_perimetre,
  controles: pf.controles,
  anomalies: pf.anomalies,
  couverture: {
    competences_sans_module: nonCouvertes,
    competences_couvertes_par_transverse: couverturesLarges,
  },
};

const dest = `referentiels/${cle}.json`;
writeFileSync(dest, JSON.stringify(sortie, null, 2), 'utf-8');

// ── Rapport ──────────────────────────────────────────────────────────────────
const vol = b => b.modules.reduce((n, m) => n + (m.volume || 0), 0);
console.log(`\n${pf.formation.titre_court} — RNCP ${pf.formation.rncp} · ${pf.formation.campus}\n`);
for (const b of pf.blocs) {
  console.log(`${b.id}  ${String(b.modules.length).padStart(2)} modules  ${String(vol(b)).padStart(6)} h  ${b.competences.join(' ')}`);
  console.log(`     ${b.titre}`);
  for (const e of (b.epreuves || [])) {
    const cal = e.date ? ` — ${e.duree} h, le ${e.date}` : (e.duree ? ` — ${e.duree} h` : '');
    console.log(`     épreuve : ${e.intitule} (${e.modalite})${cal}`);
  }
}
const hb = pf.modules_hors_bloc || [];
if (hb.length) {
  console.log(`\nModules hors bloc — aucune épreuve rattachée  ${hb.reduce((n, m) => n + (m.volume || 0), 0)} h`);
  for (const m of hb) console.log(`     ${m.titre} (${m.volume} h) ${m.competences_liees.join(',')}`);
  for (const e of (pf.hors_bloc_ecartes || [])) console.log(`     écarté sur décision : ${e.titre} (${e.volume} h)`);
}
console.log(`\nVolume blocs : ${pf.blocs.reduce((n, b) => n + vol(b), 0)} h · hors bloc : ${hb.reduce((n, m) => n + (m.volume || 0), 0)} h`);
console.log(`Contrôles        : ${pf.controles.filter(c => c.ok).length}/${pf.controles.length} conformes`);
console.log(`Anomalies        : ${pf.anomalies.length || 'aucune'}`);
if (nonCouvertes.length) console.log(`Compétences sans aucun module : ${nonCouvertes.join(', ')}`);
if (couverturesLarges.length) {
  console.log(`Compétences sans module dédié (couvertes seulement par un transverse) :`);
  for (const c of couverturesLarges) console.log(`  ${c.competence} ← ${c.via.slice(0,3).join(', ')}`);
}
console.log(`\nÉcrit : ${dest}`);
