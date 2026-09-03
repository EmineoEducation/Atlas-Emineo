// src/lire-xlsx.js — Atlas Éminéo
//
// Lecteur de classeurs .xlsx / .xlsm, sans dépendance externe.
//
// Pourquoi pas SheetJS : la dernière version publiée sur npm (0.18.5) porte
// deux vulnérabilités sans correctif sur ce canal — pollution de prototype et
// déni de service par expression régulière. SheetJS a quitté npm et ne publie
// plus que sur son propre CDN, dépendance que l'on ne peut ni auditer ni
// épingler depuis package.json de façon vérifiable.
//
// Un .xlsx est une archive ZIP de fichiers XML. Le navigateur sait décompresser
// nativement (DecompressionStream, disponible sur Safari 16.4+, Chrome 80+,
// Firefox 113+). Il ne manquait qu'une lecture de l'archive et un balayage du
// XML — c'est tout ce que fait ce fichier.
//
// Ce qu'il extrait : le nom de chaque feuille, et le contenu de chaque cellule
// en respectant sa position en colonne. Les dates sont restituées au format
// jour/mois/année et non en numéro de série, ce qui compte pour les plannings
// et les dates d'épreuves certificatives.
//
// Ce qu'il ne fait pas : formules (seul le résultat calculé est lu), mise en
// forme, images, graphiques. Aucun de ces éléments n'a de sens pour une
// ingestion pédagogique.

// ── Décompression ────────────────────────────────────────────────────────────

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Ce navigateur ne sait pas décompresser les fichiers Excel. ' +
      'Utiliser une version récente de Safari, Chrome ou Firefox, ' +
      'ou convertir le classeur en CSV.'
    )
  }
  const flux = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(flux).arrayBuffer())
}

// ── Lecture de l'archive ZIP ─────────────────────────────────────────────────
// On passe par le catalogue central plutôt que par les en-têtes locaux : c'est
// la seule partie de l'archive qui donne des tailles fiables, les en-têtes
// locaux pouvant les reporter en fin de flux.

function lireZip(buffer) {
  const vue = new DataView(buffer)
  const oct = new Uint8Array(buffer)

  // Fin du catalogue central — signature 0x06054b50, cherchée depuis la fin.
  let finCat = -1
  for (let i = oct.length - 22; i >= 0 && i > oct.length - 66000; i--) {
    if (vue.getUint32(i, true) === 0x06054b50) { finCat = i; break }
  }
  if (finCat < 0) throw new Error("Ce fichier n'est pas une archive Excel valide.")

  let nbEntrees = vue.getUint16(finCat + 10, true)
  let debutCat = vue.getUint32(finCat + 16, true)

  // Zip64 : les champs 32 bits saturés renvoient vers un catalogue étendu.
  if (debutCat === 0xffffffff || nbEntrees === 0xffff) {
    for (let i = finCat - 20; i >= 0; i--) {
      if (vue.getUint32(i, true) === 0x07064b50) {
        const posEocd64 = Number(vue.getBigUint64(i + 8, true))
        nbEntrees = Number(vue.getBigUint64(posEocd64 + 32, true))
        debutCat = Number(vue.getBigUint64(posEocd64 + 48, true))
        break
      }
    }
  }

  const entrees = new Map()
  let p = debutCat
  for (let n = 0; n < nbEntrees; n++) {
    if (vue.getUint32(p, true) !== 0x02014b50) break
    const methode = vue.getUint16(p + 10, true)
    let tailleComp = vue.getUint32(p + 20, true)
    const lgNom = vue.getUint16(p + 28, true)
    const lgExtra = vue.getUint16(p + 30, true)
    const lgComm = vue.getUint16(p + 32, true)
    let posLocale = vue.getUint32(p + 42, true)
    const nom = new TextDecoder('utf-8').decode(oct.subarray(p + 46, p + 46 + lgNom))

    // Champ extra Zip64 (0x0001) : reprend les valeurs saturées, dans l'ordre
    // taille décompressée, taille compressée, position locale.
    if (tailleComp === 0xffffffff || posLocale === 0xffffffff) {
      let e = p + 46 + lgNom
      const finExtra = e + lgExtra
      while (e + 4 <= finExtra) {
        const idBloc = vue.getUint16(e, true)
        const lgBloc = vue.getUint16(e + 2, true)
        if (idBloc === 0x0001) {
          let q = e + 4
          if (vue.getUint32(p + 24, true) === 0xffffffff) q += 8       // taille décompressée
          if (tailleComp === 0xffffffff) { tailleComp = Number(vue.getBigUint64(q, true)); q += 8 }
          if (posLocale === 0xffffffff) { posLocale = Number(vue.getBigUint64(q, true)) }
          break
        }
        e += 4 + lgBloc
      }
    }

    entrees.set(nom, { methode, tailleComp, posLocale })
    p += 46 + lgNom + lgExtra + lgComm
  }

  return {
    async fichier(nom) {
      const e = entrees.get(nom)
      if (!e) return null
      // L'en-tête local répète nom et extra, avec des longueurs qui lui sont
      // propres : les données commencent après.
      const lgNom = vue.getUint16(e.posLocale + 26, true)
      const lgExtra = vue.getUint16(e.posLocale + 28, true)
      const debut = e.posLocale + 30 + lgNom + lgExtra
      const brut = oct.subarray(debut, debut + e.tailleComp)
      const clair = e.methode === 0 ? brut : await inflateRaw(brut)
      return new TextDecoder('utf-8').decode(clair)
    },
    noms: [...entrees.keys()],
  }
}

// ── XML ──────────────────────────────────────────────────────────────────────

function decoderEntites(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function attribut(balise, nom) {
  const m = balise.match(new RegExp(nom + '="([^"]*)"'))
  return m ? m[1] : null
}

// ── Dates ────────────────────────────────────────────────────────────────────
// Excel compte les jours depuis le 30/12/1899 — décalage qui absorbe le bug
// historique du 29 février 1900, jour qui n'a jamais existé.

function serieVersDate(n) {
  const ms = Math.round((n - 25569) * 86400 * 1000)
  const d = new Date(ms)
  if (isNaN(d.getTime())) return String(n)
  const jj = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const aaaa = d.getUTCFullYear()
  const frac = n - Math.floor(n)
  if (frac > 1e-6) {
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mi = String(d.getUTCMinutes()).padStart(2, '0')
    return `${jj}/${mm}/${aaaa} ${hh}:${mi}`
  }
  return `${jj}/${mm}/${aaaa}`
}

// Formats de date intégrés à Excel, par identifiant.
const NUMFMT_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

function estFormatDate(code) {
  if (!code) return false
  // Un format contenant j/m/a ou h:m, hors échappements, est une date.
  const sansTexte = code.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '')
  return /[dmyhs]/i.test(sansTexte) && /[dy]|h.*m|m.*s/i.test(sansTexte)
}

// ── Référence de cellule ─────────────────────────────────────────────────────

function colonneDepuisRef(ref) {
  const m = String(ref || '').match(/^([A-Z]+)/)
  if (!m) return 0
  let n = 0
  for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

// ── Lecture principale ───────────────────────────────────────────────────────

export async function lireClasseur(arrayBuffer) {
  const zip = lireZip(arrayBuffer)

  // Chaînes partagées : la plupart des textes y sont mutualisés.
  const chaines = []
  const xmlChaines = await zip.fichier('xl/sharedStrings.xml')
  if (xmlChaines) {
    for (const bloc of xmlChaines.split(/<si[\s>]/).slice(1)) {
      const morceaux = [...bloc.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => decoderEntites(m[1]))
      chaines.push(morceaux.join(''))
    }
  }

  // Styles : on ne retient que « cette cellule affiche-t-elle une date ».
  const formatsPerso = new Map()
  const styleEstDate = []
  const xmlStyles = await zip.fichier('xl/styles.xml')
  if (xmlStyles) {
    for (const m of xmlStyles.matchAll(/<numFmt\b[^>]*\/>/g)) {
      const id = attribut(m[0], 'numFmtId')
      const code = attribut(m[0], 'formatCode')
      if (id) formatsPerso.set(Number(id), decoderEntites(code || ''))
    }
    const blocXf = xmlStyles.match(/<cellXfs[\s\S]*?<\/cellXfs>/)
    if (blocXf) {
      for (const m of blocXf[0].matchAll(/<xf\b[^>]*>/g)) {
        const id = Number(attribut(m[0], 'numFmtId') || 0)
        styleEstDate.push(NUMFMT_DATE.has(id) || estFormatDate(formatsPerso.get(id)))
      }
    }
  }

  // Ordre et noms des feuilles : workbook.xml donne les noms et un rId, les
  // relations donnent le chemin réel du XML. Se fier à sheet1.xml, sheet2.xml
  // dans l'ordre alphabétique donnerait un ordre faux dès qu'une feuille a été
  // supprimée puis recréée.
  const relations = new Map()
  const xmlRels = await zip.fichier('xl/_rels/workbook.xml.rels')
  if (xmlRels) {
    for (const m of xmlRels.matchAll(/<Relationship\b[^>]*\/>/g)) {
      const id = attribut(m[0], 'Id')
      let cible = attribut(m[0], 'Target') || ''
      if (id) {
        cible = cible.replace(/^\/xl\//, '').replace(/^\.\//, '')
        relations.set(id, cible.startsWith('xl/') ? cible : 'xl/' + cible)
      }
    }
  }

  const feuilles = []
  const xmlWb = await zip.fichier('xl/workbook.xml')
  if (xmlWb) {
    for (const m of xmlWb.matchAll(/<sheet\b[^>]*\/>/g)) {
      const nom = decoderEntites(attribut(m[0], 'name') || 'Feuille')
      const rid = attribut(m[0], 'r:id') || attribut(m[0], 'id')
      const chemin = relations.get(rid)
      if (chemin) feuilles.push({ nom, chemin })
    }
  }
  if (!feuilles.length) {
    for (const n of zip.noms.filter(x => /^xl\/worksheets\/sheet\d+\.xml$/.test(x))) {
      feuilles.push({ nom: n.replace(/.*sheet(\d+)\.xml/, 'Feuille $1'), chemin: n })
    }
  }

  // Contenu des feuilles.
  const sortie = []
  for (const f of feuilles) {
    const xml = await zip.fichier(f.chemin)
    if (!xml) continue
    const lignes = []

    for (const mLigne of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cellules = []
      for (const mCell of mLigne[1].matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = mCell[1] || ''
        const corps = mCell[2] || ''
        const type = attribut('<c ' + attrs + '>', 't')
        const styleIdx = Number(attribut('<c ' + attrs + '>', 's') || -1)
        const col = colonneDepuisRef(attribut('<c ' + attrs + '>', 'r'))

        let valeur = ''
        if (type === 'inlineStr') {
          valeur = [...corps.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => decoderEntites(x[1])).join('')
        } else {
          const mv = corps.match(/<v>([\s\S]*?)<\/v>/)
          const brut = mv ? decoderEntites(mv[1]) : ''
          if (brut === '') valeur = ''
          else if (type === 's') valeur = chaines[Number(brut)] ?? ''
          else if (type === 'b') valeur = brut === '1' ? 'VRAI' : 'FAUX'
          else if (type === 'e') valeur = ''
          else if (type === 'str') valeur = brut
          else {
            const num = Number(brut)
            valeur = (styleEstDate[styleIdx] && isFinite(num) && num > 0) ? serieVersDate(num) : brut
          }
        }
        cellules[col] = String(valeur).replace(/\s+/g, ' ').trim()
      }
      if (cellules.length) {
        const ligne = []
        for (let i = 0; i < cellules.length; i++) ligne.push(cellules[i] ?? '')
        while (ligne.length && ligne[ligne.length - 1] === '') ligne.pop()
        if (ligne.some(v => v !== '')) lignes.push(ligne.join(' | '))
      }
    }

    if (lignes.length) sortie.push('### FEUILLE : ' + f.nom + '\n' + lignes.join('\n'))
  }

  return sortie.join('\n\n')
}
