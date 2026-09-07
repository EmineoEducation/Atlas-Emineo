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
// Le plan désigne les compétences par leur code d'activité (C1…C13) et parfois
// par le code précis d'une compétence (C4.2). On rattache les deux au RACE, et
// surtout on relève ce qu'aucun module ne couvre : c'est le premier signal utile
// que la cartographie doit porter.
const parActivite = new Map(race.activites.map(a => [a.id, a]));
const couverture = new Map(race.activites.map(a => [a.id, []]));

for (const b of pf.blocs) {
  for (const m of b.modules) {
    for (const code of m.competences_liees) {
      const act = 'C' + code.slice(1).split('.')[0];
      if (couverture.has(act)) couverture.get(act).push({ bloc: b.id, module: m.titre, code, plage: !!m.competences_plage });
    }
  }
}

// Une activité n'est réputée couverte de façon propre que si un module la vise
// nommément. Une plage « C3 à C5 » vaut mention, pas enseignement dédié.
const nonCouvertes = [];
const couverturesLarges = [];
for (const [id, refs] of couverture) {
  if (!refs.length) { nonCouvertes.push(id); continue; }
  // Un enseignement dédié vise l'activité nommément, pas via une plage
  // englobante : « C4.2 » compte, « C3 à C5 » non.
  const dedie = refs.some(r => !r.plage && (r.code === id || r.code.startsWith(id + '.')));
  if (!dedie) couverturesLarges.push({ activite: id, libelle: (parActivite.get(id)||{}).libelle||'', via: [...new Set(refs.map(r => r.module))] });
}

// Les blocs héritent du libellé officiel des activités qu'ils portent.
for (const b of pf.blocs) {
  b.activites = b.competences.map(c => {
    const a = parActivite.get(c);
    return a ? { id: a.id, libelle: a.libelle, competences: a.competences.map(x => x.id) } : { id: c, libelle: '', competences: [] };
  });
}

const sortie = {
  genere_le: new Date().toISOString().slice(0, 10),
  outil: 'outils/construire-referentiel.mjs',
  formation: pf.formation,
  race: { rncp: race.rncp, intitule: race.intitule, certificateur: race.certificateur, source: race.source },
  blocs: pf.blocs,
  hors_perimetre: pf.hors_perimetre,
  controles: pf.controles,
  anomalies: pf.anomalies,
  couverture: {
    activites_sans_module_dedie: nonCouvertes,
    activites_couvertes_par_transverse: couverturesLarges,
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
  for (const e of (b.ecartes || [])) console.log(`     écarté sur décision : ${e.titre} (${e.volume} h)`);
}
console.log(`\nTotal certifiant : ${pf.blocs.reduce((n, b) => n + vol(b), 0)} h`);
console.log(`Contrôles        : ${pf.controles.filter(c => c.ok).length}/${pf.controles.length} conformes`);
console.log(`Anomalies        : ${pf.anomalies.length || 'aucune'}`);
if (nonCouvertes.length) console.log(`Activités sans aucun module : ${nonCouvertes.join(', ')}`);
if (couverturesLarges.length) {
  console.log(`Activités sans module dédié (couvertes seulement par un transverse) :`);
  for (const c of couverturesLarges) console.log(`  ${c.activite} ← ${c.via.join(', ')}`);
}
console.log(`\nÉcrit : ${dest}`);
