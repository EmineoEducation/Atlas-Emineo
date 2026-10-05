/* ─────────────────────────────────────────────────────────────────────────────
   extraire-pf-isme.mjs — plans de formation ISME (MDEC, MRH)

   Troisième profil d'extraction, après CESACOM et MediaSchool. Les deux
   classeurs ISME ne se ressemblent pas davantage entre eux qu'ils ne
   ressemblent aux précédents, mais tous deux sont réguliers — et surtout,
   aucun des deux ne code l'information par la couleur. La structure est
   portée par l'occupation des colonnes, ce qui se lit sans ambiguïté.

   MDEC — « MDEC 25 modules par année »
     A  hiérarchie mêlée : année, bloc (« BC 1 - … »), activité numérotée
        (« 1.Analyse de l'environnement… »), puis les thèmes du module
     B  le module, préfixé de son code : « C1 Veille, analyse et stratégie »
     C  volume horaire
     D  la compétence RNCP et son libellé
     F  évaluation certificative, G observations
     Un module commence là où B est renseignée ; les lignes suivantes sans B
     portent ses thèmes en A.

   MRH — « MRH GLOBAL »
     A  bloc (« BC01 … ») ou activité (« A1 … ») ; la colonne C répète le
        libellé sur ces lignes de section, ce qui les rend reconnaissables
     B  la compétence (« C1 Piloter un dispositif de veille… »), fusionnée
        verticalement sur les modules qu'elle couvre
     C  les modules, un par ligne

   Le code du module est la clé qui relie ensuite le plan au syllabus et aux
   séances de CESAR. C'est pourquoi il est isolé plutôt que laissé dans
   l'intitulé.

   Usage : node extraire-pf-isme.mjs <classeur.xlsx> <mdec|mrh> > referentiel.json
───────────────────────────────────────────────────────────────────────────── */

import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { basename } from 'node:path'

/* ── Lecture du classeur ───────────────────────────────────────────────────
   Lecture directe du .xlsx plutôt que par lire-xlsx-cellules.mjs : sur ces
   deux fichiers, ce lecteur ne rend pas les cellules à leur position de
   colonne, et une grille décalée d'une colonne produit un référentiel faux
   sans rien signaler. Ici chaque cellule est rangée à l'indice que donne sa
   référence (A1, C7…), et rien d'autre n'est supposé.
   Les plans ISME n'encodent aucune information par la couleur, contrairement
   aux plans CESACOM : lire les valeurs suffit. */
function entreesZip(buf) {
  let fin = buf.length - 22
  while (fin >= 0 && buf.readUInt32LE(fin) !== 0x06054b50) fin--
  if (fin < 0) throw new Error('Archive illisible.')
  let p = buf.readUInt32LE(fin + 16)
  const total = buf.readUInt16LE(fin + 10)
  const sortie = {}
  for (let i = 0; i < total; i++) {
    const nL = buf.readUInt16LE(p + 28), eL = buf.readUInt16LE(p + 30), cL = buf.readUInt16LE(p + 32)
    const nom = buf.toString('utf8', p + 46, p + 46 + nL)
    const debut = buf.readUInt32LE(p + 42)
    const compression = buf.readUInt16LE(debut + 8)
    const nL2 = buf.readUInt16LE(debut + 26), eL2 = buf.readUInt16LE(debut + 28)
    const donnees = buf.subarray(debut + 30 + nL2 + eL2)
    const taille = buf.readUInt32LE(p + 24)
    sortie[nom] = () => compression === 0
      ? donnees.subarray(0, taille).toString('utf8')
      : inflateRawSync(donnees).toString('utf8')
    p += 46 + nL + eL + cL
  }
  return sortie
}

function decoderXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
          .replace(/&amp;/g, '&')
}
const texteDesT = x => decoderXml((x.match(/<t[^>]*>[\s\S]*?<\/t>/g) || [])
  .map(t => t.replace(/<[^>]+>/g, '')).join('')).replace(/\s+/g, ' ').trim()

// « BC12 » -> 54. Base 26 sans zéro.
function indiceColonne(ref) {
  const lettres = (String(ref).match(/^([A-Z]+)/) || [, ''])[1]
  let n = 0
  for (const c of lettres) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

function lireClasseur(chemin) {
  const zip = entreesZip(readFileSync(chemin))
  const chaines = zip['xl/sharedStrings.xml']
    ? (zip['xl/sharedStrings.xml']().match(/<si>[\s\S]*?<\/si>/g) || []).map(texteDesT)
    : []
  const classeur = zip['xl/workbook.xml'] ? zip['xl/workbook.xml']() : ''
  const noms = (classeur.match(/<sheet [^>]*>/g) || [])
    .map(s => decoderXml((s.match(/name="([^"]*)"/) || [, ''])[1]))

  const feuilles = []
  for (let i = 1; zip['xl/worksheets/sheet' + i + '.xml']; i++) {
    const xml = zip['xl/worksheets/sheet' + i + '.xml']()
    const grille = []
    for (const mr of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const ligne = []
      for (const mc of mr[2].matchAll(/<c ([^>]*?)\/>|<c ([^>]*?)>([\s\S]*?)<\/c>/g)) {
        const attrs = mc[1] || mc[2] || ''
        const corps = mc[3] || ''
        const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [, ''])[1]
        if (!ref) continue
        const type = (attrs.match(/t="(\w+)"/) || [, ''])[1]
        let valeur = ''
        if (type === 'inlineStr') valeur = texteDesT(corps)
        else {
          const v = (corps.match(/<v>([\s\S]*?)<\/v>/) || [, ''])[1]
          valeur = type === 's' ? (chaines[Number(v)] || '') : decoderXml(v)
        }
        ligne[indiceColonne(ref)] = valeur
      }
      grille[Number(mr[1]) - 1] = ligne
    }
    feuilles.push({ nom: noms[i - 1] || ('Feuille ' + i), cellules: grille })
  }
  return { feuilles }
}

const txt = c => String(c == null ? '' : c).replace(/\s+/g, ' ').trim()
const nombre = c => { const n = parseFloat(String(txt(c)).replace(',', '.')); return isFinite(n) ? n : null }

/* ── Repères de structure ─────────────────────────────────────────────────── */
const RE_BLOC_MDEC = /^BC\s*(\d+)\s*[-–—]\s*(.+)$/i
const RE_BLOC_MRH = /^BC\s*0?(\d+)\s+(.+)$/i
const RE_ACTIVITE_MDEC = /^(\d+)\s*\.\s*(.+)$/
const RE_ACTIVITE_MRH = /^A\s*(\d+)\s+(.+)$/i
const RE_ANNEE = /^(\d)(?:ère|ème|e)?\s*ANN[ÉE]E/i
const RE_PREPA = /^pr[ée]pa\s+ec/i
// Lignes qui ne sont pas de l'enseignement : épreuves certificatives sous
// leurs différentes graphies, et temps transversaux (bloc technique,
// intégration, masterclass). Les compter comme modules fausserait la
// couverture autant que les perdre.
const RE_EPREUVE = /^(?:CT\s+)?(?:pr[ée]pa\s+ec|ec\s?bc|soutenance)/i
const RE_TRANSVERSE = /^(?:BT\b|Int[ée]gration\b|A\s+developper$)/i

// « C1 Veille, analyse et stratégie » ; « C41 Culture et Gouvernance » ;
// « C2.1 Favoriser le développement… ». Le code peut porter un point.
const RE_CODE = /^C\s*\.?\s*(\d{1,3}(?:\.\d)?)\s*[-–—:.]?\s*(.*)$/i

function codeEtLibelle(brut) {
  const m = String(brut || '').match(RE_CODE)
  if (!m) return { code: '', libelle: String(brut || '').trim() }
  return { code: 'C' + m[1], libelle: m[2].trim() }
}

/* ── MDEC ─────────────────────────────────────────────────────────────────── */
function lireMDEC(grille) {
  const blocs = []
  const horsBloc = []
  let bloc = null, activite = '', annee = '', module = null

  for (const ligne of grille) {
    if (!ligne) continue
    const a = txt(ligne[0]), b = txt(ligne[1]), d = txt(ligne[3])
    const vol = nombre(ligne[2])
    const evalCert = txt(ligne[5]), obs = txt(ligne[6])

    let m
    if (a && (m = a.match(RE_ANNEE))) { annee = m[1]; module = null; continue }
    if (a && (m = a.match(RE_BLOC_MDEC))) {
      // Le plan MDEC découpe un même bloc en « PARTIE M1 » et « PARTIE M2 »,
      // et ouvre des sections de tutorat sous un numéro déjà employé. Le bloc
      // du référentiel reste le bloc de compétences : on rejoint les parties
      // plutôt que de fabriquer des doublons d'identifiant.
      const id = 'B' + String(m[1]).padStart(2, '0')
      const titre = m[2].replace(/\s*\(PARTIE\s+M\d\)\s*$/i, '').trim()
      const existant = blocs.find(b => b.id === id)
      if (existant) {
        bloc = existant
        if (vol != null) bloc.volume_annonce = (bloc.volume_annonce || 0) + vol
        if (titre && !/^TUTORAT/i.test(titre) && titre.length > bloc.titre.length) bloc.titre = titre
      } else {
        bloc = { id, titre, nature: 'obligatoire',
                 competences: [], modules: [], epreuves: [], competences_mentionnees: [],
                 competences_race: [], bloc_race: '', volume_annonce: vol }
        blocs.push(bloc)
      }
      activite = ''; module = null; continue
    }
    if (a && !b && (m = a.match(RE_ACTIVITE_MDEC))) {
      activite = 'A.' + m[1]
      // L'évaluation certificative est annoncée sur la ligne d'activité.
      if (bloc && evalCert && !bloc.epreuves.some(e => e.intitule === evalCert))
        bloc.epreuves.push({ intitule: evalCert, activite, observations: obs })
      module = null; continue
    }
    if (b && RE_EPREUVE.test(b)) {
      if (bloc && !bloc.epreuves.some(e => e.intitule === b)) bloc.epreuves.push({ intitule: b, activite, observations: obs })
      module = null; continue
    }
    if (b && RE_TRANSVERSE.test(b)) {
      horsBloc.push({ titre: b, code: '', libelle: b, volume: vol, competences_liees: [],
        competences_plage: false, activite, annee, sequencage: '', seances: null,
        epreuve: '', commentaire: obs, sous_modules: [], themes: a ? [a] : [], section: 'Transversal' })
      module = null; continue
    }
    if (b) {
      const { code, libelle } = codeEtLibelle(b)
      const comp = codeEtLibelle(d)
      module = {
        titre: b, code, libelle, volume: vol, competences_liees: comp.code ? [comp.code] : [],
        competences_plage: false, activite, annee, sequencage: '', seances: null,
        epreuve: evalCert, commentaire: obs, sous_modules: [], themes: a ? [a] : [],
      }
      if (!bloc) continue
      bloc.modules.push(module)
      if (comp.code && !bloc.competences.includes(comp.code)) bloc.competences.push(comp.code)
      if (comp.code && comp.libelle) bloc.competences_mentionnees.push({ id: comp.code, libelle: comp.libelle })
      continue
    }
    // Ligne de continuation : un thème de plus pour le module en cours.
    if (a && module && !RE_PREPA.test(a)) module.themes.push(a)
  }
  return { blocs, horsBloc }
}

/* ── MRH ──────────────────────────────────────────────────────────────────── */
function lireMRH(grille) {
  const blocs = []
  let bloc = null, activite = '', competence = null

  const horsBloc = []
  for (const ligne of grille) {
    if (!ligne) continue
    const a = txt(ligne[0]), b = txt(ligne[1]), c = txt(ligne[2])

    let m
    if (a && (m = a.match(RE_BLOC_MRH))) {
      bloc = { id: 'B' + String(m[1]).padStart(2, '0'), titre: m[2].trim(), nature: 'obligatoire',
               competences: [], modules: [], epreuves: [], competences_mentionnees: [],
               competences_race: [], bloc_race: '' }
      blocs.push(bloc); activite = ''; competence = null; continue
    }
    if (a && (m = a.match(RE_ACTIVITE_MRH))) { activite = 'A.' + m[1]; competence = null; continue }
    if (a && RE_PREPA.test(a)) {
      if (bloc) bloc.epreuves.push({ intitule: a, activite, observations: '' })
      continue
    }
    // Une compétence ouvre une série de modules ; fusionnée verticalement, elle
    // n'apparaît que sur la première ligne de sa série.
    if (b) {
      const { code, libelle } = codeEtLibelle(b)
      competence = code || null
      if (bloc && code) {
        if (!bloc.competences.includes(code)) bloc.competences.push(code)
        if (libelle) bloc.competences_mentionnees.push({ id: code, libelle })
      }
    }
    // La colonne C répète le libellé de section sur les lignes de bloc et
    // d'activité : seule une valeur différente de A est un module.
    if (c && c !== a && bloc && RE_EPREUVE.test(c)) {
      bloc.epreuves.push({ intitule: c, activite, observations: '' })
      continue
    }
    if (c && c !== a && bloc) {
      const { code, libelle } = codeEtLibelle(c)
      bloc.modules.push({
        titre: c, code, libelle: libelle || c, volume: null,
        competences_liees: competence ? [competence] : [], competences_plage: false,
        activite, annee: '', sequencage: '', seances: null,
        epreuve: '', commentaire: '', sous_modules: [], themes: [],
      })
    }
  }
  return { blocs, horsBloc }
}

/* ── Assemblage ───────────────────────────────────────────────────────────── */
const PROFILS = {
  mdec: { lire: lireMDEC, rncp: '39354', titre: 'Mastère Manager du développement commercial',
          titre_court: 'M1 MDEC', feuille: 1 },
  mrh: { lire: lireMRH, rncp: '41295', titre: 'Mastère Management des ressources humaines',
         titre_court: 'M1 MRH', feuille: 0 },
}

const [fichier, nomProfil] = process.argv.slice(2)
if (fichier && nomProfil) {
  const profil = PROFILS[nomProfil]
  if (!profil) { console.error('Profil inconnu : ' + nomProfil); process.exit(1) }

  const cl = lireClasseur(fichier)
  const feuille = cl.feuilles[profil.feuille]
  const { blocs, horsBloc } = profil.lire(feuille.cellules)

  const anomalies = []
  for (const b of blocs) {
    if (!b.modules.length) anomalies.push({ bloc: b.id, raison: 'aucun module' })
    if (!b.competences.length) anomalies.push({ bloc: b.id, raison: 'aucune compétence' })
  }
  const sansCode = blocs.flatMap(b => b.modules).filter(m => !m.code).map(m => m.titre)
  if (sansCode.length) anomalies.push({ raison: 'modules sans code', titres: sansCode })

  const controles = blocs
    .filter(b => b.volume_annonce != null)
    .map(b => {
      const calcule = b.modules.reduce((n, m) => n + (m.volume || 0), 0)
      return { titre: b.titre, annonce: b.volume_annonce, calcule: Math.round(calcule * 10) / 10,
               ok: Math.abs(b.volume_annonce - calcule) < 0.5 }
    })

  process.stdout.write(JSON.stringify({
    genere_le: new Date().toISOString().slice(0, 10),
    outil: 'extraire-pf-isme',
    formation: { rncp: profil.rncp, titre: profil.titre, titre_court: profil.titre_court,
                 campus: 'Le Mans', annee_cycle: '', source: basename(fichier), feuille: feuille.nom },
    race: {}, blocs, modules_hors_bloc: horsBloc, hors_bloc_ecartes: [], epreuves_planifiees: [],
    hors_perimetre: [], controles, anomalies,
    couverture: { competences_sans_module: [], competences_couvertes_par_transverse: [] },
  }, null, 1))
}
