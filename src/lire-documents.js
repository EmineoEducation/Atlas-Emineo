// src/lire-documents.js — Atlas Éminéo
//
// Extraction du texte des documents déposés, côté navigateur.
//
// Pourquoi ce fichier existe : la zone de dépôt annonçait .pdf, .docx et .xlsx,
// mais le code lisait tous les fichiers avec FileReader.readAsText('utf-8').
// Un .docx est une archive ZIP, un .pdf un format binaire, un .xlsx une archive
// ZIP également : les lire en UTF-8 produit du bruit. Claude recevait ce bruit,
// n'y trouvait aucun module, et renvoyait une structure vide — sans erreur, ce
// qui donnait une ingestion « réussie » à zéro module. Panne silencieuse.
//
// Chaque format a désormais son extracteur. Un format non pris en charge lève
// une erreur nommée plutôt que de laisser passer du binaire.

// Les trois parseurs pèsent ensemble près de 1,5 Mo. Les importer en tête de
// fichier les faisait charger à chaque ouverture de l'Atlas, y compris pour un
// intervenant qui consulte une fiche depuis son téléphone. Ils sont donc
// chargés à la demande, uniquement quand un fichier du format concerné est
// déposé — l'écran de connexion reste léger.
let _mammoth = null, _pdfjs = null

async function chargerMammoth() {
  if (!_mammoth) _mammoth = (await import('mammoth')).default
  return _mammoth
}

// pdf.js appelle Promise.withResolvers, que Safari n'expose qu'à partir de la
// version 17.4 — sur une version antérieure, l'appel échoue avec un laconique
// « undefined is not a function ». Ni le build standard ni le build legacy ne
// polyfillent cette méthode. Six lignes suffisent, et elles ne s'activent que
// si le navigateur en a besoin.
function polyfillWithResolvers() {
  if (typeof Promise.withResolvers === 'function') return
  Promise.withResolvers = function () {
    let resolve, reject
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }
}

// On utilise le build « legacy », transpilé pour les navigateurs plus anciens.
// Le build standard vise des moteurs très récents et casse silencieusement
// ailleurs. L'import '?url' laisse Vite émettre le worker comme asset et en
// donner l'URL finale — sans quoi le worker est introuvable en production.
async function chargerPdfjs() {
  if (!_pdfjs) {
    polyfillWithResolvers()
    const lib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
    lib.GlobalWorkerOptions.workerSrc = workerUrl
    _pdfjs = lib
  }
  return _pdfjs
}

const EXT_TEXTE = ['txt', 'md', 'csv', 'json']

function extension(nom) {
  return String(nom || '').split('.').pop().toLowerCase()
}

function lireArrayBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res(e.target.result)
    r.onerror = () => rej(new Error('Lecture impossible : ' + file.name))
    r.readAsArrayBuffer(file)
  })
}

function lireTexteBrut(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res(e.target.result)
    r.onerror = () => rej(new Error('Lecture impossible : ' + file.name))
    r.readAsText(file, 'utf-8')
  })
}

// ── .docx ────────────────────────────────────────────────────────────────────
// mammoth restitue le texte du corps. Les tableaux sont aplatis ligne à ligne,
// ce qui suffit pour un plan de formation tabulaire : l'en-tête de colonne
// « M1 » reste au-dessus des modules qu'il couvre, donc lisible par Claude.
async function lireDocx(file) {
  const mammoth = await chargerMammoth()
  const buf = await lireArrayBuffer(file)
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf })
  return value || ''
}

// ── .xlsx / .xlsm ────────────────────────────────────────────────────────────
// Lecteur maison, sans dépendance : voir src/lire-xlsx.js pour le détail et la
// raison du choix. Chaque feuille est précédée de son nom — celui-ci porte
// souvent l'année de cycle (« PF M1 », « Année 2 »), qui est l'indice le plus
// fiable dont Claude dispose pour ventiler les modules.
async function lireTableur(file) {
  const { lireClasseur } = await import('./lire-xlsx.js')
  const buf = await lireArrayBuffer(file)
  return await lireClasseur(buf)
}

// ── .pdf ─────────────────────────────────────────────────────────────────────
// Extraction page par page, chaque page annoncée. Un PDF scanné (image sans
// couche texte) ressortira vide : le cas est détecté plus bas et signalé, car
// il demande une océrisation que le navigateur ne peut pas faire.
async function lirePdf(file) {
  const pdfjsLib = await chargerPdfjs()
  const buf = await lireArrayBuffer(file)
  const doc = await pdfjsLib.getDocument({ data: buf }).promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const contenu = await page.getTextContent()
    const texte = contenu.items.map(it => it.str).join(' ')
    if (texte.trim()) pages.push('### PAGE ' + i + '\n' + texte)
  }
  return pages.join('\n\n')
}

// ── Point d'entrée ───────────────────────────────────────────────────────────
// Renvoie le texte extrait. Lève une erreur explicite si le format n'est pas
// pris en charge, ou si l'extraction ne rend rien d'exploitable : mieux vaut
// une erreur nommée qu'une ingestion vide présentée comme réussie.
export async function extraireTexte(file) {
  const ext = extension(file.name)
  let texte = ''

  if (ext === 'docx') texte = await lireDocx(file)
  else if (ext === 'xlsx' || ext === 'xlsm') texte = await lireTableur(file)
  else if (ext === 'pdf') texte = await lirePdf(file)
  else if (EXT_TEXTE.includes(ext)) texte = await lireTexteBrut(file)
  else if (ext === 'doc' || ext === 'xls') {
    throw new Error(
      file.name + ' : les anciens formats binaires .doc et .xls ne sont pas ' +
      'lisibles. Réenregistrer en .docx ou .xlsx depuis Office.'
    )
  } else {
    throw new Error(file.name + ' : format .' + ext + ' non pris en charge.')
  }

  if (!texte || texte.trim().length < 40) {
    throw new Error(
      file.name + ' : aucun texte exploitable extrait. ' +
      (ext === 'pdf'
        ? 'Ce PDF est probablement un scan sans couche texte — fournir une version texte ou le document source.'
        : 'Le fichier est peut-être vide ou protégé.')
    )
  }

  return texte
}

// Extrait plusieurs fichiers en signalant la progression fichier par fichier.
export async function extraireTextes(files, onProgress) {
  const out = []
  for (let i = 0; i < files.length; i++) {
    if (onProgress) onProgress('Lecture ' + (i + 1) + '/' + files.length + ' — ' + files[i].name)
    try {
      out.push(await extraireTexte(files[i]))
    } catch (e) {
      // Une panne interne de parseur remonte un message technique sans nom de
      // fichier — inexploitable quand on dépose plusieurs documents. On dit
      // toujours lequel a échoué.
      const msg = (e && e.message) ? e.message : String(e)
      if (msg.startsWith(files[i].name)) throw e
      throw new Error(files[i].name + ' : lecture impossible (' + msg + ')')
    }
  }
  return out
}
