/* ─────────────────────────────────────────────────────────────────────────────
   familles-notions.mjs — regroupement conceptuel des notions, hors ligne

   Les notions des syllabi ne se répètent jamais à l'identique : sur les 149
   intitulés distincts du M1 MSMC par exemple, deux seulement reviennent, et ce
   sont des formules de trame pédagogique. Aucun rapprochement par chaîne ni par mots
   communs ne peut donc relier « Structuration d'une veille dynamique » et
   « Choix du sujet et veille sectorielle ». C'est un travail de lecture, fait
   une fois, relu à la main, et figé dans un fichier versionné.

   Deux sorties, et la seconde compte autant que la première :

     familles   des concepts réellement enseignés, avec les modules qui les
                portent. C'est de là que naissent les liens de la cartographie
                et les alertes de coordination.

     ecartees   les intitulés qui ne désignent aucun concept — cadrage,
                restitution, atelier, accueil. Près d'un tiers du corpus. Les
                garder produirait un graphe dense et faux, où le bloc créatif
                serait relié au bloc diagnostic parce que tous deux comportent
                une « restitution professionnelle ».

   Le regroupement est posé sur l'INTITULÉ de la notion, pas sur son
   occurrence : deux modules qui emploient la même formule parlent de la même
   chose. Le script retrouve ensuite toutes les occurrences, et vérifie qu'au-
   cune notion du corpus n'a été oubliée — c'est le contrôle qui rend le
   fichier relisible.

   Le regroupement lui-même est une donnée, pas du code : il vit dans
   referentiels/notions/def-<promotion>.json, relu et corrigé à la main. Ce
   fichier-ci ne fait que le résoudre sur le référentiel et contrôler qu'aucune
   notion n'a été perdue en route.

   Usage : node familles-notions.mjs <definition.json> <referentiel-applicatif.json>
───────────────────────────────────────────────────────────────────────────── */

import { readFileSync } from 'node:fs'

// type : concept   savoir enseigné, susceptible de résonner d'un module à l'autre
//        outil     maîtrise technique d'un logiciel ou d'un dispositif
//        posture   savoir-être professionnel
/* ── Résolution sur le référentiel ────────────────────────────────────────── */
const definition = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const ref = JSON.parse(readFileSync(process.argv[3], 'utf8'))

// Les syllabi emploient l'espace fine insécable avant les deux-points, comme
// le veut la typographie française. Six intitulés sur 149 en portent une, et
// elle suffit à faire échouer une comparaison de chaînes. On compare sur une
// clé où toute espace Unicode devient une espace ordinaire ; le libellé
// d'origine, lui, est conservé tel quel dans la sortie.
const cle = t => String(t).replace(/\s+/gu, ' ').trim()

const occurrences = new Map()   // clé d'intitulé -> [{bloc, module, competences}]
for (const b of ref.blocs || [])
  for (const m of b.modules || [])
    for (const n of m.notions_cles || []) {
      const k = cle(n)
      if (!occurrences.has(k)) occurrences.set(k, { libelle: n, occ: [] })
      occurrences.get(k).occ.push({ bloc: b.id, module: m.titre, competences: m.competences_liees || [] })
    }
for (const m of ref.modules_hors_bloc || [])
  for (const n of m.notions_cles || []) {
    const k = cle(n)
    if (!occurrences.has(k)) occurrences.set(k, { libelle: n, occ: [] })
    occurrences.get(k).occ.push({ bloc: 'HB', module: m.titre, competences: m.competences_liees || [] })
  }

const inconnues = [], vues = new Set()
function resoudre(intitule) {
  const k = cle(intitule)
  const e = occurrences.get(k)
  if (!e) { inconnues.push(intitule); return [] }
  vues.add(k)
  return e.occ
}

const familles = (definition.familles || []).map((f, i) => {
  const { libelle, type, notions: intitules } = f
  const membres = intitules.flatMap(t => resoudre(t).map(o => ({ notion: t, ...o })))
  const blocs = [...new Set(membres.map(m => m.bloc))].sort()
  const modules = [...new Set(membres.map(m => m.module))]
  const competences = [...new Set(membres.flatMap(m => m.competences))].sort()
  return { id: 'F' + String(i + 1).padStart(2, '0'), libelle, type,
           blocs, modules, competences, notions: membres }
})

const ecartees = (definition.ecartees || []).map(({ motif, notions: intitules }) => ({
  motif, notions: intitules.flatMap(t => resoudre(t).map(o => ({ notion: t, bloc: o.bloc, module: o.module }))),
}))

const oubliees = [...occurrences.entries()].filter(([k]) => !vues.has(k)).map(([, e]) => e.libelle)

process.stdout.write(JSON.stringify({
  cle: ref.formation.titre_court || '', genere_le: new Date().toISOString().slice(0, 10),
  outil: 'familles-notions', methode: 'regroupement hors ligne, à relire et corriger à la main',
  controle: {
    notions_distinctes: occurrences.size,
    occurrences: [...occurrences.values()].reduce((n, e) => n + e.occ.length, 0),
    classees: vues.size, ecartees: ecartees.reduce((n, e) => n + e.notions.length, 0),
    intitules_oublies: oubliees, intitules_inconnus: inconnues,
  },
  familles, ecartees,
}, null, 1))
