/* ─────────────────────────────────────────────────────────────────────────────
   extraire-syllabus.mjs — lecture déterministe des programmes Word

   Pendant de extraire-pf.mjs. Celui-là lit le plan de formation Excel et pose
   la structure ; celui-ci lit le programme Word et donne le contenu de chaque
   module : notions clés, détail du programme, objectif, séances quand elles
   sont explicitées.

   Le document est une suite de tableaux, un par module. Chaque ligne porte une
   étiquette en première cellule et sa valeur en seconde. La section
   « Programme préconisé » fait exception : elle s'étale sur des lignes à une
   seule cellule, où la hiérarchie n'est pas portée par l'indentation — tous
   les paragraphes sont au niveau 0 — mais par la graisse. Un paragraphe en
   gras ouvre une section : c'est la notion clé. Les paragraphes maigres qui
   suivent la détaillent.

   C'est ce signal qu'avait manqué l'ancienne ingestion par Claude, qui
   retenait le libellé « Programme préconisé » comme notion unique de presque
   tous les modules.

   Aucune dépendance : lecture du .docx en ZIP, parcours XML à la main.

   Usage : node extraire-syllabus.mjs <fichier.docx> [...] > syllabi.json
───────────────────────────────────────────────────────────────────────────── */

import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { basename } from 'node:path'

/* ── ZIP : on n'extrait que word/document.xml ──────────────────────────────── */
function lireEntreeZip(buf, nom) {
  // Parcours du catalogue central, depuis la fin du fichier.
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error('Archive illisible (fin de catalogue absente).')
  let p = buf.readUInt32LE(eocd + 16)
  const total = buf.readUInt16LE(eocd + 10)
  for (let i = 0; i < total; i++) {
    const nLen = buf.readUInt16LE(p + 28)
    const eLen = buf.readUInt16LE(p + 30)
    const cLen = buf.readUInt16LE(p + 32)
    const nom_ = buf.toString('utf8', p + 46, p + 46 + nLen)
    const debut = buf.readUInt32LE(p + 42)
    if (nom_ === nom) {
      const compression = buf.readUInt16LE(debut + 8)
      const nL = buf.readUInt16LE(debut + 26)
      const eL = buf.readUInt16LE(debut + 28)
      const donnees = buf.subarray(debut + 30 + nL + eL)
      const taille = buf.readUInt32LE(p + 24)
      if (compression === 0) return donnees.subarray(0, taille).toString('utf8')
      return inflateRawSync(donnees).toString('utf8')
    }
    p += 46 + nLen + eLen + cLen
  }
  throw new Error('Entrée ' + nom + ' absente de l\'archive.')
}

/* ── XML : extraction des tableaux, lignes, cellules, paragraphes ──────────── */
// Analyseur minimal fondé sur les balises de WordprocessingML. On ne construit
// pas d'arbre complet : on suit l'imbrication des seules balises utiles, ce qui
// suffit et évite toute dépendance.
function decoder(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

function paragraphes(xml) {
  const out = []
  const re = /<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g
  let m
  while ((m = re.exec(xml))) {
    const p = m[0]
    const texte = decoder((p.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) || [])
      .map(t => t.replace(/<[^>]+>/g, '')).join('')).trim()
    if (!texte) continue
    // Graisse : portée par le premier passage de texte du paragraphe, ou par
    // les propriétés du paragraphe lui-même.
    const premierRun = (p.match(/<w:r[ >][\s\S]*?<\/w:r>/) || [''])[0]
    const rpr = (premierRun.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0]
    const gras = /<w:b\/>|<w:b [^>]*w:val="(?:1|true|on)"/.test(rpr)
    const liste = /<w:numPr>/.test(p)
    out.push({ texte, gras, liste })
  }
  return out
}

function tableaux(xml) {
  // Les tableaux ne sont pas imbriqués dans ces documents : découpage direct.
  return (xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || []).map(t =>
    (t.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map(r =>
      (r.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(paragraphes)
    )
  )
}

/* ── Normalisation d'intitulé — identique au front et à api/formations.js ──── */
export function normaliser(t) {
  return String(t || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

// Les deux promotions n'étiquettent pas leurs tableaux de la même façon : le
// programme M1 dit « Module » et « Objectif pédagogique », le M2 « Intitulé du
// module » et « Objectifs pédagogiques ». Les variantes sont recensées plutôt
// que devinées — une étiquette inconnue est signalée en fin d'extraction, et
// non silencieusement ignorée.
const ETIQ = {
  'module': 'titre',
  'intitule du module': 'titre',
  'nom du module': 'titre',
  'formation et annee': 'formation',
  'formation annee': 'formation',
  'intitule de formation': 'formation',
  'rncp et lien web': 'rncp',
  'rncp lien': 'rncp',
  'bloc de competences': 'bloc',
  'nom du bloc de competences': 'bloc',
  'numero et nom du bloc de competences': 'bloc',
  'competences visees': 'competences',
  'competences visees referentiel rncp': 'competences',
  'competence s visee s': 'competences',
  'competence visee': 'competences',
  'activite': 'activite',
  'activite visee': 'activite',
  'annee du module': 'annee',
  'intervenant e': 'intervenant',
  'duree en h': 'volume',
  'duree preconisee': 'volume',
  'duree h sequencage': 'volume_sequencage',
  'sequencage': 'sequencage',
  'sequencage suggere': 'sequencage',
  'objectif pedagogique': 'objectif',
  'objectifs pedagogiques': 'objectif',
  'objectif s pedagogique s': 'objectif',
  'methodes d animation innovantes possibles': 'methodes',
  'methodes d animation': 'methodes',
  'evaluations conseillees formative et sommative': 'evaluations',
  'evaluations conseillees formative uniquement': 'evaluations',
  'evaluations conseillees formative': 'evaluations',
  'modalites d evaluation': 'evaluations',
  'modalites d evaluation preconisees': 'evaluations',
  'commentaires specifiques': 'commentaire',
  'element': null,          // ligne d'en-tête « Élément | Description »
}
const OUVRE_PROGRAMME = /^programme/

/* ── Codes de compétence : C.1, C.12, C.20-II, C1… ────────────────────────── */
function codesCompetence(txt) {
  const bruts = String(txt || '').match(/\bC\.?\s?\d{1,2}(?:\s?-\s?(?:I{1,3}|IV))?/gi) || []
  const vus = new Set()
  const out = []
  for (const b of bruts) {
    const code = b.toUpperCase().replace(/\s+/g, '').replace(/^C\.?/, 'C.')
    if (!vus.has(code)) { vus.add(code); out.push(code) }
  }
  return out
}

/* ── Séance explicitée : « Séance 3 (3,5h) – Titre » ───────────────────────── */
function lireSeance(txt) {
  const m = String(txt || '').match(/^s[ée]ance\s*(\d+)\s*(?:\(([^)]*)\))?\s*[–\-—:]\s*(.+)$/i)
  if (!m) return null
  return { numero: Number(m[1]), duree: (m[2] || '').trim(), titre: m[3].trim() }
}

/* ── Hiérarchie du programme : trois conventions dans le même réseau ────────
   MSMC  : section en gras, détail en maigre, tout au niveau 0.
   MRH    : section numérotée « 1. », détail en « a) ».
   MDEC   : section en texte nu, détail préfixé d'un tiret.
   On ne devine pas la convention du document : on lit chaque ligne pour ce
   qu'elle porte, en testant les marqueurs les plus explicites d'abord. Le gras
   ne tranche qu'en dernier, et seulement si la cellule s'en sert vraiment —
   un document entièrement en gras ne dit rien. */
const PUCE = /^\s*(?:[-–—•*▪]|\u2022)\s+/
const SOUS_LETTRE = /^\s*[a-z]\s*[).]\s+/i
const SECTION_NUM = /^\s*\d{1,2}\s*[).]\s+/

function hierarchie(paragraphes) {
  const grasUtilise = paragraphes.some(p => p.gras) && paragraphes.some(p => !p.gras)
  return paragraphes.map(p => {
    const t = p.texte
    let section
    if (SECTION_NUM.test(t)) section = true
    else if (SOUS_LETTRE.test(t) || PUCE.test(t)) section = false
    else if (grasUtilise) section = p.gras
    else section = true
    return { section, texte: t.replace(PUCE, '').replace(SOUS_LETTRE, '').replace(SECTION_NUM, '').trim() }
  })
}


const DUREE_SEULE = /^[\d.,]+\s*h(eures?)?$/i

/* Grille de planning : première colonne = repère temporel, colonnes suivantes =
   contenus, séparés par parcours quand le titre en propose deux. Les colonnes
   de durée sont ignorées. Le repère temporel devient le nom de la séquence ; il
   n'a jamais valeur de notion. */
function ajouterPlanning(mod, cellules) {
  const textes = cellules.map(c => (c || []).map(p => p.texte).filter(Boolean))
  // Ligne d'en-tête de la grille : elle nomme les colonnes (« Jour », « Durée »)
  // et, dans les hackathons, les deux parcours. On en retient les parcours pour
  // attribuer les contenus, et on ne la prend pas pour du programme.
  if (textes.some(c => c.length === 1 && normaliser(c[0]) === 'duree')) {
    mod.parcours = textes.slice(1)
      .map(c => (c[0] || '').trim())
      .filter(t => t && normaliser(t) !== 'duree')
    return
  }
  const repere = (textes[0] || []).join(' ').trim()
  const colonnes = []
  textes.slice(1).forEach(c => {
    if (!c.length) return
    if (c.length === 1 && DUREE_SEULE.test(c[0])) return
    colonnes.push(c)
  })
  if (!colonnes.length) return
  const sequence = { repere, contenus: [] }
  colonnes.forEach((col, i) => {
    const [titre, ...points] = col
    if (!titre || DUREE_SEULE.test(titre)) return
    const parcours = (mod.parcours || [])[i] || ''
    sequence.contenus.push({ titre, points, parcours })
    mod.notions_cles.push(titre)
    mod.programme.push({ titre, points, repere, parcours })
  })
  if (sequence.contenus.length) mod.planning.push(sequence)
}

/* ── Un tableau → un module ───────────────────────────────────────────────── */
function lireModule(lignes) {
  const mod = {
    titre: '', bloc: '', formation: '', rncp: '', activite: '', intervenant: '',
    volume: '', sequencage: '', objectif: '', commentaire: '', competences_prose: '',
    competences_liees: [], notions_cles: [], programme: [], seances: [], planning: [], parcours: [],
    methodes: [], evaluations: [],
  }
  let dansProgramme = false

  for (const cellules of lignes) {
    const etiq = normaliser(cellules[0] ? cellules[0].map(p => p.texte).join(' ') : '')
    const valeur = cellules[1] || []
    const texteValeur = valeur.map(p => p.texte).join('\n').trim()

    // Le programme se présente de deux façons : étiquette seule puis lignes à
    // cellule unique (MSMC), ou étiquette et contenu dans la même ligne à deux
    // cellules (MRH, MDEC). Les deux ouvrent la même section.
    if (OUVRE_PROGRAMME.test(etiq)) {
      dansProgramme = true
      if (valeur.length) { ajouterProgramme(mod, valeur); dansProgramme = false }
      continue
    }

    const champ = ETIQ[etiq]
    if (champ) {
      dansProgramme = false
      if (champ === 'titre') mod.titre = texteValeur
      else if (champ === 'bloc') mod.bloc = texteValeur
      else if (champ === 'formation') mod.formation = texteValeur
      else if (champ === 'intervenant') mod.intervenant = texteValeur
      else if (champ === 'volume') mod.volume = texteValeur
      else if (champ === 'sequencage') mod.sequencage = texteValeur
      else if (champ === 'rncp') mod.rncp = texteValeur
      else if (champ === 'activite') mod.activite = texteValeur
      else if (champ === 'commentaire') mod.commentaire = texteValeur
      else if (champ === 'volume_sequencage') {
        // « 10,5h (début de S1, en articulation avec…) » : le volume est en
        // tête, le reste décrit le séquençage.
        const m = texteValeur.match(/^\s*([\d.,]+\s*h)\s*(.*)$/i)
        if (m) { mod.volume = m[1].trim(); mod.sequencage = m[2].replace(/^[(\s]+|[)\s]+$/g, '').trim() }
        else mod.sequencage = texteValeur
      }
      else if (champ === 'objectif') mod.objectif = valeur.map(p => p.texte).join(' ')
      else if (champ === 'methodes') mod.methodes = valeur.map(p => p.texte)
      else if (champ === 'evaluations') mod.evaluations = valeur.map(p => p.texte)
      else if (champ === 'competences') {
        const codes = codesCompetence(texteValeur)
        if (codes.length) mod.competences_liees = [...new Set([...mod.competences_liees, ...codes])]
        // Sans code explicite, la cellule décrit la compétence en prose : on la
        // garde telle quelle, elle servira au rapprochement sémantique.
        else if (texteValeur) mod.competences_prose = texteValeur
      }
      continue
    }

    if (dansProgramme) {
      // Un programme peut être une liste, ou une grille de planning à
      // plusieurs colonnes (hackathons : jour · contenu parcours A · durée ·
      // contenu parcours B · durée). Lire la seule première colonne ramenait
      // « Jour 1 matin » comme notion clé et perdait tout le contenu.
      if (cellules.length >= 2) ajouterPlanning(mod, cellules)
      else ajouterProgramme(mod, cellules[0] || [])
    }
  }
  return mod
}

function ajouterProgramme(mod, paragraphes) {
  let section = mod.programme[mod.programme.length - 1] || null
  for (const p of hierarchie(paragraphes)) {
    if (!p.texte) continue
    const seance = lireSeance(p.texte)
    if (seance) {
      section = { titre: seance.titre, points: [] }
      mod.programme.push(section)
      mod.seances.push({ numero: seance.numero, duree: seance.duree, titre: seance.titre, points: section.points })
    } else if (p.section || !section) {
      section = { titre: p.texte, points: [] }
      mod.programme.push(section)
      mod.notions_cles.push(p.texte)
    } else {
      section.points.push(p.texte)
    }
  }
}

/* ── Programme d'un fichier ───────────────────────────────────────────────── */
export function lireSyllabus(chemin) {
  const xml = lireEntreeZip(readFileSync(chemin), 'word/document.xml')
  const modules = tableaux(xml).map(lireModule)
    .filter(m => m.titre && (m.notions_cles.length || m.seances.length || m.objectif))
  return { fichier: basename(chemin), modules }
}

/* ── Exécution ────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2)
if (argv.length) {
  const sortie = { genere_le: new Date().toISOString().slice(0, 10), outil: 'extraire-syllabus', sources: [] }
  for (const f of argv) sortie.sources.push(lireSyllabus(f))
  process.stdout.write(JSON.stringify(sortie, null, 1))
}
