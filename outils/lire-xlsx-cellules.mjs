// outils/lire-xlsx-cellules.mjs — Atlas Éminéo
//
// Lecteur de classeurs .xlsx pour l'outillage Node, sans dépendance externe.
//
// Différence avec le lecteur du navigateur : celui-ci ne rend pas du texte
// aplati mais une MATRICE DE CELLULES, chacune portant sa valeur et sa couleur
// de remplissage. C'est indispensable ici — dans les plans de formation
// CESACOM, la teinte d'une ligne distingue une section d'un module. Aplatir en
// texte détruisait cette information, et c'est précisément ce qui a fait
// dérailler les premières ingestions.

import { inflateRawSync } from 'node:zlib';

// ── Archive ZIP ──────────────────────────────────────────────────────────────
function lireZip(buffer) {
  const vue = new DataView(buffer);
  const oct = new Uint8Array(buffer);

  let finCat = -1;
  for (let i = oct.length - 22; i >= 0 && i > oct.length - 66000; i--) {
    if (vue.getUint32(i, true) === 0x06054b50) { finCat = i; break; }
  }
  if (finCat < 0) throw new Error("Ce fichier n'est pas une archive Excel valide.");

  const nbEntrees = vue.getUint16(finCat + 10, true);
  const debutCat = vue.getUint32(finCat + 16, true);
  const entrees = new Map();
  let p = debutCat;

  for (let n = 0; n < nbEntrees; n++) {
    if (vue.getUint32(p, true) !== 0x02014b50) break;
    const methode = vue.getUint16(p + 10, true);
    const tailleComp = vue.getUint32(p + 20, true);
    const lgNom = vue.getUint16(p + 28, true);
    const lgExtra = vue.getUint16(p + 30, true);
    const lgComm = vue.getUint16(p + 32, true);
    const posLocale = vue.getUint32(p + 42, true);
    const nom = new TextDecoder('utf-8').decode(oct.subarray(p + 46, p + 46 + lgNom));
    entrees.set(nom, { methode, tailleComp, posLocale });
    p += 46 + lgNom + lgExtra + lgComm;
  }

  return {
    fichier(nom) {
      const e = entrees.get(nom);
      if (!e) return null;
      const lgNom = vue.getUint16(e.posLocale + 26, true);
      const lgExtra = vue.getUint16(e.posLocale + 28, true);
      const debut = e.posLocale + 30 + lgNom + lgExtra;
      const brut = Buffer.from(oct.subarray(debut, debut + e.tailleComp));
      const clair = e.methode === 0 ? brut : inflateRawSync(brut);
      return clair.toString('utf-8');
    },
    noms: [...entrees.keys()],
  };
}

// ── XML ──────────────────────────────────────────────────────────────────────
const decoder = s => String(s)
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

const attr = (balise, nom) => {
  const m = balise.match(new RegExp(nom + '="([^"]*)"'));
  return m ? m[1] : null;
};

const NUMFMT_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function serieVersDate(n) {
  const d = new Date(Math.round((n - 25569) * 86400 * 1000));
  if (isNaN(d.getTime())) return String(n);
  const p = x => String(x).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function colonneDepuisRef(ref) {
  const m = String(ref || '').match(/^([A-Z]+)/);
  if (!m) return 0;
  let n = 0;
  for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// ── Lecture ──────────────────────────────────────────────────────────────────
export function lireClasseurComplet(arrayBuffer) {
  const zip = lireZip(arrayBuffer);

  // Chaînes partagées
  const chaines = [];
  const xmlCh = zip.fichier('xl/sharedStrings.xml');
  if (xmlCh) {
    for (const si of xmlCh.split(/<si[\s>]/).slice(1)) {
      chaines.push([...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => decoder(m[1])).join(''));
    }
  }

  // Styles : on retient le format de date ET la couleur de remplissage.
  // La couleur passe par deux indirections — cellXfs[s].fillId, puis
  // fills[fillId].patternFill.fgColor — et peut être exprimée en RGB direct ou
  // en référence de thème. Les deux sont conservées telles quelles : ce qui
  // compte n'est pas la teinte exacte mais le fait que deux lignes partagent
  // ou non la même.
  const xmlSt = zip.fichier('xl/styles.xml') || '';
  const formats = new Map();
  for (const m of xmlSt.matchAll(/<numFmt\b[^>]*\/>/g)) {
    const id = attr(m[0], 'numFmtId');
    if (id) formats.set(Number(id), decoder(attr(m[0], 'formatCode') || ''));
  }
  const remplissages = [];
  const blocFills = xmlSt.match(/<fills\b[\s\S]*?<\/fills>/);
  if (blocFills) {
    for (const m of blocFills[0].matchAll(/<fill>([\s\S]*?)<\/fill>/g)) {
      const pat = m[1].match(/<patternFill\b[^>]*patternType="([^"]*)"/);
      if (!pat || pat[1] === 'none') { remplissages.push(''); continue; }
      const fg = m[1].match(/<fgColor\b[^>]*\/>/);
      if (!fg) { remplissages.push(pat[1]); continue; }
      const rgb = attr(fg[0], 'rgb');
      const theme = attr(fg[0], 'theme');
      remplissages.push(rgb || (theme != null ? 'theme' + theme : pat[1]));
    }
  }
  const styleFill = [], styleDate = [];
  const blocXf = xmlSt.match(/<cellXfs[\s\S]*?<\/cellXfs>/);
  if (blocXf) {
    for (const m of blocXf[0].matchAll(/<xf\b[^>]*>/g)) {
      const nf = Number(attr(m[0], 'numFmtId') || 0);
      const code = formats.get(nf) || '';
      styleDate.push(NUMFMT_DATE.has(nf) || /[dy]|h.*m/i.test(code.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '')));
      styleFill.push(remplissages[Number(attr(m[0], 'fillId') || 0)] || '');
    }
  }

  // Ordre des feuilles
  const rels = new Map();
  const xmlRel = zip.fichier('xl/_rels/workbook.xml.rels') || '';
  for (const m of xmlRel.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = attr(m[0], 'Id');
    let t = (attr(m[0], 'Target') || '').replace(/^\/xl\//, '').replace(/^\.\//, '');
    if (id) rels.set(id, t.startsWith('xl/') ? t : 'xl/' + t);
  }

  const feuilles = [];
  const xmlWb = zip.fichier('xl/workbook.xml') || '';
  for (const m of xmlWb.matchAll(/<sheet\b[^>]*\/>/g)) {
    const nom = decoder(attr(m[0], 'name') || 'Feuille');
    const chemin = rels.get(attr(m[0], 'r:id') || attr(m[0], 'id'));
    if (!chemin) continue;
    const xml = zip.fichier(chemin);
    if (!xml) continue;

    const cellules = [];
    let nbColonnes = 0;
    for (const mr of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const numLigne = Number(attr('<row ' + mr[1] + '>', 'r') || cellules.length + 1) - 1;
      const ligne = [];
      for (const mc of mr[2].matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = '<c ' + (mc[1] || '') + '>';
        const corps = mc[2] || '';
        const type = attr(a, 't');
        const idxStyle = Number(attr(a, 's') || -1);
        const col = colonneDepuisRef(attr(a, 'r'));

        let v = '';
        if (type === 'inlineStr') {
          v = [...corps.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => decoder(x[1])).join('');
        } else {
          const mv = corps.match(/<v>([\s\S]*?)<\/v>/);
          const brut = mv ? decoder(mv[1]) : '';
          if (brut === '') v = '';
          else if (type === 's') v = chaines[Number(brut)] ?? '';
          else if (type === 'b') v = brut === '1' ? 'VRAI' : 'FAUX';
          else if (type === 'e') v = '';
          else if (type === 'str') v = brut;
          else {
            const num = Number(brut);
            v = (styleDate[idxStyle] && isFinite(num) && num > 0) ? serieVersDate(num) : brut;
          }
        }
        ligne[col] = { v, fill: styleFill[idxStyle] || '' };
        if (col + 1 > nbColonnes) nbColonnes = col + 1;
      }
      cellules[numLigne] = ligne;
    }
    feuilles.push({ nom, cellules, nbLignes: cellules.length, nbColonnes });
  }

  return { feuilles };
}
