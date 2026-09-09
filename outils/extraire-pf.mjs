// outils/extraire-pf.mjs — Atlas Éminéo
//
// Extracteur déterministe des plans de formation. Aucun appel à un modèle de
// langage : un plan est un tableau, il se lit.
//
// Deux mises en page coexistent dans le réseau, et rien ne dit qu'il n'y en
// aura pas d'autres. Le lecteur est donc piloté par un profil déclaré dans
// outils/titres.mjs : indices de colonnes, motifs reconnaissant un bloc, une
// activité, une ligne à ignorer. Décrire une nouvelle école revient à décrire
// son tableau, pas à modifier ce fichier.
//
//   Profil CESACOM (Bachelor CDC)
//     A titre · B volume · C compétences · D épreuve · E commentaire
//     Un bloc se reconnaît à « Bloc NN - ». Pas de niveau intermédiaire.
//
//   Profil MediaSchool (Mastère MSMC)
//     A titre · B volume · C séances · D séquençage · E compétences
//     F évaluation certifiante · G libellé de compétence
//     H épreuve écrite · I épreuve orale
//     Un bloc se reconnaît à « TC BCn », « TC Bloc n », « SPE BLOC n »,
//     « Bloc transversal ». Un niveau « A.n » regroupe les modules d'une
//     activité et porte l'épreuve qui la sanctionne.
//
// Garde-fou commun : le volume annoncé en tête de section doit égaler la somme
// de ses modules. C'est cette vérification qui prouve que le découpage est
// juste — une ligne prise pour une section, ou l'inverse, et le total tombe à
// côté. Elle a déjà révélé deux structures parent/enfants invisibles à l'œil.

import { readFileSync } from 'node:fs';
import { lireClasseurComplet } from './lire-xlsx-cellules.mjs';

const RE_TOTAL = /^(total\s+volum|volum[eé]trie\s+cible)/i;
const RE_EPREUVES = /^[eé]preuves?\s+de\s+certification/i;

function nettoyer(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

// Variante conservant les sauts de ligne, pour les champs dont ils portent la
// structure : épreuves multiples, contenu détaillé des évaluations.
function nettoyerMulti(v) {
  return String(v == null ? '' : v).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

// « C1 », « C4.2 », « C20-II », « C3 à C6 » → codes d'activité.
// Renvoie { codes, plage }. La distinction compte : « C4.2 » désigne un
// enseignement dédié, « C3 à C6 » une mention dans un module transverse.
// Les confondre efface le signal le plus utile du plan — les compétences que
// personne n'enseigne nommément.
export function codesCompetences(brut) {
  const s = nettoyer(brut);
  if (!s || s === '-') return { codes: [], plage: false };
  const plage = s.match(/^C\s*(\d+)(?:\.\d+)?\s*(?:à|a|-|–)\s*C?\s*(\d+)(?:\.\d+)?$/i);
  if (plage) {
    const [a, b] = [Number(plage[1]), Number(plage[2])];
    const out = [];
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push('C' + i);
    return { codes: out, plage: true };
  }
  const codes = [...s.matchAll(/C\s*(\d+)(\.\d+|-I{1,3})?/gi)].map(m => 'C' + m[1] + (m[2] || ''));
  return { codes: Array.from(new Set(codes)), plage: false };
}

export function extraire(chemin, cfg) {
  const col = Object.assign(
    { titre: 0, volume: 1, competences: 2, epreuve: 3, commentaire: 4 },
    cfg.colonnes || {}
  );
  const reBloc = (cfg.motifs_blocs || ['^bloc\\s*0*(\\d+)\\s*[-–—:]']).map(m => new RegExp(m, 'i'));
  const reActivite = cfg.motif_activite ? new RegExp(cfg.motif_activite, 'i') : null;
  const reIgnore = (cfg.lignes_ignorees || []).map(m => new RegExp(m, 'i'));
  const conservees = cfg.sections_conservees || {};
  const exclues = (cfg.sections_exclues || []).map(x => nettoyer(x).toLowerCase());

  const buf = readFileSync(chemin);
  const classeur = lireClasseurComplet(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const f = classeur.feuilles.find(x => x.nom === cfg.feuille);
  if (!f) throw new Error(`Feuille « ${cfg.feuille} » absente. Disponibles : ${classeur.feuilles.map(x => '«' + x.nom + '»').join(', ')}`);

  const val = (r, c) => (c == null ? '' : nettoyer(f.cellules[r] && f.cellules[r][c] && f.cellules[r][c].v));
  const valM = (r, c) => (c == null ? '' : nettoyerMulti(f.cellules[r] && f.cellules[r][c] && f.cellules[r][c].v));

  const blocs = [];
  const sectionsHorsBloc = [];
  const horsPerimetre = [];
  const epreuvesPlanifiees = [];
  const anomalies = [];
  let courant = null;
  let activite = null;

  const debut = Number.isFinite(cfg.premiere_ligne) ? cfg.premiere_ligne - 1 : 2;

  for (let r = debut; r < f.nbLignes; r++) {
    const t = val(r, col.titre);
    if (!t) continue;
    // Le tableau des parcours au choix vient après le tableau principal : il a
    // sa propre structure et se lit à part. On arrête ici la lecture des blocs.
    if (cfg.section_options && new RegExp(cfg.section_options, 'i').test(t)) break;
    if (RE_TOTAL.test(t) || reIgnore.some(re => re.test(t))) { courant = null; activite = null; continue; }

    const volume = parseFloat(String(val(r, col.volume)).replace(',', '.'));
    const { codes: comps, plage: compsPlage } = codesCompetences(val(r, col.competences));

    // ── Section « Épreuves de certification » ────────────────────────────────
    // Elle porte les créneaux et les dates de passage : c'est ce qui relie un
    // bloc à son évaluation, donc l'information la plus structurante du plan.
    if (RE_EPREUVES.test(t)) {
      courant = { hors: true, section_epreuves: true, titre: t, volume_annonce: isFinite(volume) ? volume : null, modules: [] };
      horsPerimetre.push(courant);
      activite = null;
      continue;
    }
    if (courant && courant.section_epreuves) {
      const note = [valM(r, col.commentaire), valM(r, col.evaluation), valM(r, col.sequencage)].filter(Boolean).join(' · ');
      const d = note.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})|(\d{4}-\d{2}-\d{2})/);
      epreuvesPlanifiees.push({
        intitule: t,
        volume: isFinite(volume) ? volume : null,
        bloc_vise: val(r, col.competences),
        date: d ? d[0] : '',
        note,
      });
      courant.modules.push({ titre: t, volume: isFinite(volume) ? volume : null, competences_liees: [], sous_modules: [] });
      continue;
    }

    const conserve = Object.keys(conservees).find(k => nettoyer(k).toLowerCase() === t.toLowerCase());
    const exclu = !conserve && exclues.includes(t.toLowerCase());
    const mBloc = reBloc.map(re => t.match(re)).find(Boolean);

    // ── Bloc de compétences ──────────────────────────────────────────────────
    if (mBloc && !conserve && !exclu) {
      const num = String(mBloc[1] || '').padStart(2, '0');
      const apres = t.slice(mBloc[0].length).replace(/^[\s:–—-]+/, '');
      courant = {
        id: (cfg.prefixe_bloc || 'B') + (num !== '00' ? num : String(blocs.length + 1).padStart(2, '0')),
        titre: nettoyer(apres) || t,
        nature: 'obligatoire',
        volume_annonce: isFinite(volume) ? volume : null,
        competences: [], modules: [], epreuves: [],
      };
      blocs.push(courant);
      activite = null;
      continue;
    }

    // ── Section conservée sans épreuve : modules hors bloc ───────────────────
    // Un bloc se définit par ses épreuves de certification. Les enseignements
    // transversaux n'en portent aucune : les ériger en bloc gonflerait la
    // cartographie et laisserait croire à une certification qui n'existe pas.
    if (conserve) {
      const d = conservees[conserve];
      courant = {
        horsBlocRetenu: true, titre: d.titre || t,
        volume_annonce: d.modules ? null : (isFinite(volume) ? volume : null),
        _filtre: d.modules ? d.modules.map(x => nettoyer(x).toLowerCase()) : null,
        modules: [], ecartes: [],
      };
      sectionsHorsBloc.push(courant);
      activite = null;
      continue;
    }

    if (exclu) {
      courant = { hors: true, titre: t, volume_annonce: isFinite(volume) ? volume : null, modules: [] };
      horsPerimetre.push(courant);
      activite = null;
      continue;
    }

    if (!courant) { anomalies.push({ ligne: r + 1, message: `« ${t.slice(0, 60)} » hors de toute section` }); continue; }

    // ── Niveau activité ──────────────────────────────────────────────────────
    // Sous-en-tête « A.n » : pas de volume, mais l'épreuve qui sanctionne le
    // bloc et le libellé officiel de la compétence. Retenu sans devenir module.
    if (reActivite && reActivite.test(t) && !isFinite(volume)) {
      const m = t.match(/^(A\.?\s*\d+(?:-I{1,3})?)/i);
      activite = { code: m ? m[1].replace(/\s+/g, '') : '', libelle: t };
      if (Array.isArray(courant.epreuves)) {
        const ec = valM(r, col.evaluation);
        if (ec) courant.epreuves.push({
          intitule: nettoyer(ec.split('\n')[0]),
          detail: ec,
          ecrit: valM(r, col.epreuve_ecrit),
          oral: valM(r, col.epreuve_oral),
          activite: activite.code,
        });
      }
      continue;
    }

    // ── Module ───────────────────────────────────────────────────────────────
    const mod = {
      titre: t,
      volume: isFinite(volume) ? volume : null,
      competences_liees: comps,
      competences_plage: compsPlage,
      activite: activite ? activite.code : '',
      sequencage: val(r, col.sequencage),
      seances: col.seances != null ? (parseFloat(val(r, col.seances)) || null) : null,
      epreuve: reActivite ? '' : valM(r, col.epreuve),
      commentaire: valM(r, col.commentaire),
      sous_modules: [],
      _teinte: (f.cellules[r] && f.cellules[r][col.titre] && f.cellules[r][col.titre].fill) || '',
    };

    if (courant._filtre && !courant._filtre.includes(t.toLowerCase())) {
      courant.ecartes.push({ titre: t, volume: mod.volume });
      continue;
    }
    courant.modules.push(mod);
  }

  // ── Réconciliation par les volumes ─────────────────────────────────────────
  // Certains modules se décomposent en ateliers listés juste en dessous —
  // « Identité d'agence » au Bachelor, les hackathons au Mastère. Rien ne les
  // distingue de façon fiable : parents et enfants sont teintés, simplement
  // d'une teinte différente. C'est le total annoncé qui tranche. On rattache
  // autant de parents que nécessaire pour que la somme retombe juste.
  for (const s of [...blocs, ...sectionsHorsBloc]) {
    if (s.volume_annonce == null) continue;
    const somme = () => s.modules.reduce((n, m) => n + (m.volume || 0), 0);
    let garde = 0;
    while (Math.abs(somme() - s.volume_annonce) > 0.01 && garde++ < 12) {
      let rattache = false;
      for (let i = 0; i < s.modules.length; i++) {
        const parent = s.modules[i];
        if (!parent.volume || parent.sous_modules.length) continue;
        // La teinte tranche : un parent et ses ateliers ne sont jamais de la
        // même couleur. Sans ce critère, la somme seule suffisait à désigner un
        // faux parent — « Management d'équipe » (28 h) suivi d'Éloquence (14) et
        // Relation presse (14) totalise aussi 28, alors que ce sont trois
        // modules distincts. Le vrai parent était « Identité d'agence ».
        const teinteEnfants = (s.modules[i + 1] || {})._teinte;
        if (teinteEnfants === undefined || teinteEnfants === parent._teinte) continue;
        let cumul = 0;
        const enfants = [];
        for (let j = i + 1; j < s.modules.length; j++) {
          const c = s.modules[j];
          if (!c.volume || c.sous_modules.length || c._teinte !== teinteEnfants) break;
          cumul += c.volume;
          enfants.push(c);
          if (Math.abs(cumul - parent.volume) < 0.01) break;
        }
        // Au moins deux enfants : un module dont le volume égale celui du
        // suivant n'est pas un parent, c'est une coïncidence. Sans ce seuil,
        // deux modules de 10,5 h consécutifs se rattachaient l'un à l'autre.
        if (enfants.length < 2 || Math.abs(cumul - parent.volume) > 0.01) continue;
        if (somme() - cumul < s.volume_annonce - 0.01) continue;
        parent.sous_modules = enfants.map(c => ({ titre: c.titre, volume: c.volume, competences_liees: c.competences_liees }));
        s.modules.splice(i + 1, enfants.length);
        rattache = true;
        break;
      }
      if (!rattache) break;
    }
  }

  // ── Parcours au choix décrits sous le tableau ──────────────────────────────
  // Le Bachelor détaille ses trois options intensives dans un second tableau,
  // sous le principal. Ce ne sont pas des blocs : ce sont trois contenus
  // possibles d'un même module, dont un seul est suivi.
  const options = [];
  if (cfg.section_options) {
    const reOpt = new RegExp(cfg.section_options, 'i');
    const reNom = new RegExp(cfg.motif_option || '^option\\b', 'i');
    let dedans = false;
    for (let r = debut; r < f.nbLignes; r++) {
      const t = val(r, col.titre);
      if (!t) continue;
      if (!dedans) { if (reOpt.test(t)) dedans = true; continue; }
      if (reNom.test(t)) { options.push({ titre: t, semaines: [] }); continue; }
      if (!options.length) continue;
      for (const c of [col.titre, col.volume]) {
        const contenu = valM(r, c);
        if (contenu && contenu !== t) options[options.length - 1].semaines.push(contenu);
        else if (contenu === t && c === col.titre) options[options.length - 1].semaines.push(contenu);
      }
    }
    const porteur = blocs.flatMap(b => b.modules).find(m => new RegExp(cfg.module_options || "intensives?\\s+d'option", 'i').test(m.titre));
    if (porteur && options.length) {
      porteur.nature = 'option';
      porteur.option_groupe = cfg.groupe_options || 'Parcours au choix';
      porteur.parcours = options.map(o => ({
        titre: o.titre,
        semaines: o.semaines.map(x => {
          const l = x.split('\n');
          return { libelle: nettoyer(l[0]).slice(0, 40), detail: nettoyer(l.slice(1).join(' ')) || nettoyer(x) };
        }),
      }));
    }
  }

  // ── Blocs mutuellement exclusifs ───────────────────────────────────────────
  // Deux spécialisations de même volume dont une seule est suivie : le total du
  // plan ne les compte qu'une fois. Déclaré par titre, jamais deviné.
  for (const [nom, ids] of Object.entries(cfg.blocs_exclusifs || {})) {
    for (const b of blocs) {
      if (!ids.includes(b.id)) continue;
      b.nature = 'option';
      b.option_groupe = nom;
    }
  }

  // ── Contrôle arithmétique ──────────────────────────────────────────────────
  const controles = [];
  for (const s of [...blocs, ...sectionsHorsBloc, ...horsPerimetre]) {
    const somme = (s.modules || []).reduce((n, m) => n + (m.volume || 0), 0);
    const ok = s.volume_annonce == null || Math.abs(somme - s.volume_annonce) < 0.01;
    controles.push({ titre: s.titre.slice(0, 60), annonce: s.volume_annonce, calcule: +somme.toFixed(1), ok });
    if (!ok) anomalies.push({ message: `Volume de « ${s.titre.slice(0, 50)} » : ${s.volume_annonce} annoncé, ${somme.toFixed(1)} calculé` });
    delete s.volume_annonce; delete s._filtre;
    for (const m of s.modules || []) delete m._teinte;
  }

  // ── Compétences par bloc ───────────────────────────────────────────────────
  for (const b of blocs) {
    const nommees = new Set(), mentionnees = new Set();
    for (const m of b.modules) {
      for (const c of (m.competences_liees || [])) {
        (m.competences_plage ? mentionnees : nommees).add(c.split('.')[0]);
      }
      for (const sm of (m.sous_modules || [])) {
        for (const c of (sm.competences_liees || [])) nommees.add(c.split('.')[0]);
      }
    }
    const tri = (a, b2) => Number(String(a).slice(1).replace(/\D.*/, '')) - Number(String(b2).slice(1).replace(/\D.*/, ''));
    b.competences = [...nommees].sort(tri);
    b.competences_mentionnees = [...mentionnees].filter(c => !nommees.has(c)).sort(tri);
  }

  return {
    formation: {
      rncp: cfg.rncp, titre: cfg.titre, titre_court: cfg.titreCourt,
      campus: cfg.campus, annee_cycle: cfg.annee_cycle,
      source: chemin.split('/').pop(), feuille: cfg.feuille,
    },
    blocs,
    modules_hors_bloc: sectionsHorsBloc.flatMap(s => s.modules.map(m => ({ ...m, section: s.titre }))),
    hors_bloc_ecartes: sectionsHorsBloc.flatMap(s => s.ecartes || []),
    options_intensives: options.length,
    epreuves_planifiees: epreuvesPlanifiees,
    hors_perimetre: horsPerimetre.filter(s => !s.section_epreuves).map(s => ({ titre: s.titre, modules: s.modules.length })),
    controles,
    anomalies,
  };
}
