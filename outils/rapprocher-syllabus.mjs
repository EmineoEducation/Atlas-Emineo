/* ─────────────────────────────────────────────────────────────────────────────
   rapprocher-syllabus.mjs — alignement programme Word ↔ plan de formation

   Le plan de formation nomme les modules ; le programme Word les nomme aussi,
   rarement de la même façon. « worflow » contre « workflow », « Spé Srat Créa »
   contre « Spé Strat Créa », une parenthèse en plus, un apostrophe droit contre
   un apostrophe courbe. Sans alignement, le contenu d'un syllabus n'a aucun
   module où se poser.

   Trois états en sortie, jamais deux :

     aligné        — un seul candidat au-dessus du seuil haut, non déjà pris.
                     Appliqué sans intervention.
     à arbitrer    — plusieurs candidats, ou un seul mais incertain. Les trois
                     meilleurs sont écrits dans le fichier, à trancher à la main.
     sans candidat — aucun rapprochement crédible. Ce n'est pas un échec de
                     l'outil : c'est que le module existe d'un côté et pas de
                     l'autre. L'information vaut d'être lue telle quelle.

   Le score compare les mots signifiants des deux intitulés, avec tolérance aux
   coquilles sur les mots longs (cinq premières lettres identiques). Il ne
   cherche pas à comprendre le sens — il cherche à ne pas se tromper. Ce qu'il
   ne tranche pas, il l'expose.

   Usage : node rapprocher-syllabus.mjs <syllabi.json> <referentiel.json> [clé]
───────────────────────────────────────────────────────────────────────────── */

import { readFileSync } from 'node:fs'

const SEUIL_SUR = 85      // au-dessus : appliqué
const SEUIL_DOUTE = 50    // entre les deux : proposé à l'arbitrage

const VIDES = new Set(['de','du','des','la','le','les','et','en','pour','au','aux',
  'd','l','un','une','a','the','of','sur','avec','par','dans'])

function normaliser(t) {
  return String(t || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}
function mots(t) {
  return normaliser(t).split(' ').filter(w => w.length > 1 && !VIDES.has(w))
}
function score(a, b) {
  const A = new Set(mots(a)), B = new Set(mots(b))
  if (!A.size || !B.size) return 0
  let communs = 0
  for (const w of A) if (B.has(w)) communs++
  // Coquilles : « worflow » / « workflow », « Srat » / « Strat ».
  let approx = 0
  for (const x of A) {
    if (B.has(x)) continue
    for (const y of B) {
      if (B.has(x)) break
      if (x.length > 4 && y.length > 4 && x.slice(0, 5) === y.slice(0, 5)) { approx += 0.7; break }
    }
  }
  return Math.round(100 * (2 * (communs + approx)) / (A.size + B.size))
}

export function rapprocher(syllabi, referentiel) {
  // Les modules hors bloc font partie du plan de formation.
  // Omission du 05/10/2026 : seuls blocs[].modules étaient lus, si bien que
  // l'anglais, les séminaires d'intégration, le personal branding et la
  // compétition — rangés dans modules_hors_bloc parce qu'aucune épreuve ne les
  // sanctionne — étaient déclarés absents du plan. Ils y sont.
  const pf = []
  for (const b of referentiel.blocs || [])
    for (const m of b.modules || [])
      pf.push({ bloc: b.id, titre: m.titre })
  for (const m of referentiel.modules_hors_bloc || [])
    pf.push({ bloc: 'HB', titre: m.titre, section: m.section || '' })

  const aligne = [], aArbitrer = [], sansCandidat = []
  const recu = {}

  // Un module de plan peut recevoir plusieurs syllabi — le plan tient en une
  // ligne ce que le programme découpe en trois TD. Et un syllabus peut nourrir
  // plusieurs modules — une option dédoublée entre deux parcours au choix.
  // La correspondance n'est donc pas exclusive : on ne retire plus un module
  // des candidats une fois retenu, on signale les convergences.
  for (const s of syllabi) {
    const notes = pf.map(p => ({ ...p, score: score(s.titre, p.titre) }))
      .sort((x, y) => y.score - x.score)
    const tete = notes[0]
    if (tete && tete.score >= SEUIL_SUR) {
      const k = tete.bloc + '§' + tete.titre
      recu[k] = (recu[k] || 0) + 1
      aligne.push({ bloc: tete.bloc, titre_pf: tete.titre, titre_syllabus: s.titre, score: tete.score })
    } else if (tete && tete.score >= SEUIL_DOUTE) {
      aArbitrer.push({
        titre_syllabus: s.titre, bloc_annonce: s.bloc,
        candidats: notes.slice(0, 3).map(c => ({ bloc: c.bloc, titre_pf: c.titre, score: c.score })),
      })
    } else {
      sansCandidat.push({ titre_syllabus: s.titre, bloc_annonce: s.bloc,
        meilleur: tete ? { bloc: tete.bloc, titre_pf: tete.titre, score: tete.score } : null })
    }
  }

  const fusions = Object.keys(recu).filter(k => recu[k] > 1).map(k => ({
    bloc: k.split('§')[0], titre_pf: k.split('§').slice(1).join('§'),
    syllabi: aligne.filter(a => a.bloc + '§' + a.titre_pf === k).map(a => a.titre_syllabus),
  }))

  const modulesSansSyllabus = pf
    .filter(p => !recu[p.bloc + '§' + p.titre])
    .filter(p => !aArbitrer.some(a => a.candidats.some(c => c.bloc === p.bloc && c.titre_pf === p.titre)))

  return { aligne, a_arbitrer: aArbitrer, sans_candidat: sansCandidat, modules_sans_syllabus: modulesSansSyllabus, fusions }
}

const [fSyl, fRef, cle] = process.argv.slice(2)
if (fSyl && fRef) {
  const syl = JSON.parse(readFileSync(fSyl, 'utf8'))
  const modules = (syl.sources || []).flatMap(s => s.modules || [])
  const ref = JSON.parse(readFileSync(fRef, 'utf8'))
  const r = rapprocher(modules, ref)
  process.stdout.write(JSON.stringify({
    cle: cle || '', genere_le: new Date().toISOString().slice(0, 10),
    outil: 'rapprocher-syllabus',
    resume: {
      syllabus: modules.length, plan_de_formation: (ref.blocs || []).reduce((n, b) => n + (b.modules || []).length, 0) + (ref.modules_hors_bloc || []).length,
      alignes: r.aligne.length, a_arbitrer: r.a_arbitrer.length,
      sans_candidat: r.sans_candidat.length, modules_sans_syllabus: r.modules_sans_syllabus.length,
      fusions: r.fusions.length,
    },
    ...r,
  }, null, 1))
}
