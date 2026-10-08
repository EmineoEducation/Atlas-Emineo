// ============================================================
// api/fr.js — Poste de travail Formateur Référent
// ------------------------------------------------------------
// GET  ?formation_id=&periode=&annee_scolaire=
//      -> journal (4 etats) / competences / distorsions / redites / digest
// GET  ?action=cron-digest
//      -> declenche par Vercel Cron (1er lundi du mois, cf vercel.json).
//         Auth: header Authorization: Bearer <CRON_SECRET> (auto Vercel).
//         Genere (sans envoyer) le digest de tous les titres ayant un FR.
// POST ?action=arbitrer      { formation_id, type, cle, empreinte, decision, note?, periode? }
//      -> decision du FR sur un signal : 'classe', 'digest' ou 'annule'.
//         Aucun envoi : le seul canal vers les intervenants est le digest.
// POST ?action=generate      { formation_id, campus, annee_scolaire? }
//      -> (re)genere le digest du mois en cours pour ce titre. Role: dir, fr.
// POST ?action=valider-envoyer  { digest_id, note_fr? }
//      -> le FR relit, ajuste eventuellement la note de coordination,
//         et envoie via Resend en un seul clic. Role: fr (titulaire du titre), dir.
//
// Principe : tout ce qui est chiffre (kpis, % par bloc, tableau des
// intervenants, sequences a venir) est calcule en JS a partir de la base —
// jamais par Claude. Claude ne redige que le titre et une suggestion de note
// de coordination, a partir des faits deja calcules (pas d'invention de
// chiffres). Cf. atlas-ecarts-roadmap-v2-le-mans.md, phase "Stack technique".
// ============================================================

const { getDB } = require('./_lib/db');
const { requireAuth, requireRole } = require('./_lib/auth');

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 2000;

// ── Roles habilites sur le digest ──────────────────────────────────────────
// Corrige le 25/08/2026 (audit Le Mans, bug B01). Le rôle 'rp' etait absent :
// Johnny Nicolas et Etienne Azerad, les deux Responsables Pedagogiques du
// pilote, obtenaient un 403 sur "Generer le digest" et "Valider et envoyer",
// alors que src/App.jsx leur ouvre bien L'Atelier depuis VueRP.
// Le bug etait invisible depuis un compte 'dir', qui lui etait autorise.
const ROLES_DIGEST = ['dir', 'fr', 'rp'];

// Un 'dir' voit tous les titres. Un 'fr' ou un 'rp' doit etre inscrit sur le
// titre — quel que soit le libelle de son inscription ('fr' pour un Formateur
// Referent, 'rp' pour un Responsable Pedagogique, cf api/setup.js).
async function verifierPerimetre(db, user, formationId) {
  if (user.role === 'dir') return { ok: true };
  const insc = await db.execute({
    sql: "SELECT 1 FROM inscription WHERE user_id=? AND formation_id=? AND role IN ('fr','rp')",
    args: [user.id, formationId],
  });
  if (!insc.rows.length) return { ok: false, error: "Ce titre n'est pas dans votre périmètre." };
  return { ok: true };
}

// ── Dates ──────────────────────────────────────────────────────────────────
// Bornes du mois (UTC) contenant `ref`. Remplace bornesSemaine() : la cadence
// est passee d'hebdomadaire a mensuelle (1er lundi du mois, cf PPT v2.0).
function bornesMois(ref) {
  const d = new Date(ref);
  const debut = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
  const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { debut: debut.toISOString(), fin: fin.toISOString() };
}

function bornesMoisSuivant(ref) {
  const d = new Date(ref);
  const suivant = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return bornesMois(suivant);
}

function labelMois(iso) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch (_) { return iso; }
}

// Est-ce le premier lundi du mois (heure UTC) ? Utilise par le cron, qui est
// lui declenche chaque lundi (Vercel Hobby ne sait pas faire "1er lundi du
// mois" directement — cf vercel.json + note dans la roadmap).
function estPremierLundiDuMois(d) {
  return d.getUTCDay() === 1 && d.getUTCDate() <= 7;
}

// ── Mise en forme lisible (destinée aux intervenants) ──────────────────────
//
// Le digest affichait la donnee brute : des dates ISO completes
// ("2026-11-02T09:00:00.000Z"), des intitules de matiere prefixes du code de
// competence tel que la scolarite les saisit dans CESAR ("C11 Management
// interculturel"), des pastilles portant toutes les competences du module, et
// une ligne par seance — soit huit lignes pour deux modules repetes sur une
// semaine de hackathon. Ces codes ne veulent rien dire pour un intervenant et
// ne servent pas le propos du mail.
const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet',
                 'août','septembre','octobre','novembre','décembre'];

function dateCourte(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MOIS_FR[d.getUTCMonth()]}`;
}

// "du 2 au 5 novembre", "le 2 novembre" — une periode se lit mieux qu'une liste.
function periodeCourte(isos) {
  const tries = (isos || []).filter(Boolean).slice().sort();
  if (!tries.length) return '';
  const d1 = new Date(tries[0]), d2 = new Date(tries[tries.length - 1]);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '';
  const a = dateCourte(tries[0]), b = dateCourte(tries[tries.length - 1]);
  if (a === b) return `le ${a}`;
  // Meme mois : "du 2 au 5 novembre" plutot que "du 2 novembre au 5 novembre".
  if (d1.getUTCMonth() === d2.getUTCMonth() && d1.getUTCFullYear() === d2.getUTCFullYear()) {
    return `du ${d1.getUTCDate()} au ${b}`;
  }
  return `du ${a} au ${b}`;
}

// Retire le code de competence que CESAR met en tete d'intitule : "C11 ",
// "C.7 — ", "C7 : ". Le reste de l'intitule est conserve tel quel — c'est le
// nom que les intervenants connaissent.
function titreLisible(t) {
  return String(t || '')
    .replace(/^\s*C\.?\s?\d{1,3}\s*[-–—:.)]?\s+/i, '')
    .trim() || String(t || '').trim();
}

function heures(minutes) {
  return Math.round((Number(minutes || 0) / 60) * 10) / 10;
}

// Intitule de module -> libelle de son bloc, pour situer une seance sans
// afficher un code "B03" qui ne parle qu'a la direction des programmes.
function blocParModule(blocs, horsBloc) {
  const idx = {};
  (blocs || []).forEach(b => (b.modules || []).forEach(m => { idx[String(m.titre)] = b.titre; }));
  (horsBloc || []).forEach(m => { idx[String(m.titre)] = 'Hors bloc'; });
  return idx;
}

function parseJSON(val, fallback) {
  if (val == null) return fallback;
  try { return JSON.parse(val); } catch (_) { return fallback; }
}

// Normalise un code competence pour comparaison tolerante entre formats
// heterogenes ("C.1", "C1", "BC11" ...) rencontres selon les titres.
function normCode(c) {
  return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ── Calcul deterministe (jamais par Claude) ────────────────────────────────
//
// Refonte du 07/10/2026. Toute cette couche comparait auparavant deux champs
// du modele declaratif abandonne : previsionnel_seance.concepts (ce que
// l'intervenant annoncait) et declaration.couvert (ce qu'il declarait avoir
// traite). Le pont CESAR n'alimente ni l'un ni l'autre — un export de
// planning donne une date, une matiere, un intervenant, un groupe, une duree
// et un compte rendu, rien de plus. Les deux tableaux arrivaient vides, donc
// egaux, donc toute seance emargee s'affichait "Conforme au previsionnel" :
// le faux negatif corrige le 25/08 revenait par une autre porte. Et toute
// seance encore a venir, faute de declaration appariee, passait en alerte.
//
// L'unite de jugement change. L'emargement ne sait pas dire si le contenu
// annonce a ete traite — seul le compte rendu le pourrait, et il est en prose
// libre. Il sait dire qu'une seance a eu lieu, quand, par qui, sur quel
// module, donc sur quelles competences. Le verdict se forme desormais au
// niveau du module et de la competence, dans la duree.

// % de couverture par bloc RNCP, a partir de TOUTES les declarations connues
// a date (cumulatif depuis le debut de l'annee, pas seulement la periode).
function calculerAvancementBlocs(blocs, declarationsCumul) {
  const codesDeclares = new Set();
  declarationsCumul.forEach(d => {
    (d.competences || []).forEach(c => codesDeclares.add(normCode(c)));
  });
  return (blocs || []).map(b => {
    const comps = b.competences || [];
    if (!comps.length) return { id: b.id, titre: b.titre, pct: null };
    const couvertes = comps.filter(c => codesDeclares.has(normCode(c.id))).length;
    return { id: b.id, titre: b.titre, pct: Math.round((couvertes / comps.length) * 100) };
  });
}

// Tableau "qui a enseigne quoi" sur la periode — donnees factuelles, pas de
// synthese Claude ici.
//
// Regroupe par module et par intervenant : une ligne par seance produisait des
// repetitions ("C1 Conception de projet / LARNAUDIE" deux fois dans la meme
// semaine) sans rien apprendre de plus. Le volume horaire, lui, dit quelque
// chose — il situe l'enseignement dans la progression du titre.
function calculerQuiAEnseigne(declarationsPeriode, idxBlocs) {
  const par = {};
  declarationsPeriode.forEach(d => {
    const mod = String(d.module_ref || '') || 'Module';
    const who = d.intervenant_nom || '';
    const k = `${mod}|${who}`;
    if (!par[k]) par[k] = { module: titreLisible(mod), bloc: (idxBlocs || {})[mod] || '',
                            intervenant: who, seances: 0, minutes: 0, dates: [] };
    par[k].seances++;
    par[k].minutes += Number(d.duree_minutes || 0);
    if (d.date_seance) par[k].dates.push(String(d.date_seance));
  });
  return Object.values(par)
    .map(e => ({ module: e.module, bloc: e.bloc, intervenant: e.intervenant,
                 seances: e.seances, heures: heures(e.minutes), periode: periodeCourte(e.dates) }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

// ── 1. Journal des seances ─────────────────────────────────────────────────
//
// Quatre etats, tous factuels. Aucun ne porte de jugement sur le contenu :
//   tenue_cr   seance emargee, compte rendu present
//   tenue      seance emargee, sans compte rendu
//   a_venir    seance programmee, date encore devant nous
//   manquante  seance programmee, date passee, aucun emargement
//
// Seul `manquante` est un signal. C'est le seul que l'emargement produise
// honnetement au grain de la seance : soit le cours n'a pas eu lieu, soit il
// n'a pas ete emarge, et dans les deux cas quelqu'un doit le savoir.
//
// Le journal part de l'UNION du programme et du realise, pas du seul
// previsionnel. Une seance emargee sans correspondance au plan — frequente
// tant que l'arbitrage des matieres n'est pas complet — etait auparavant
// purement invisible. Elle apparait desormais, marquee hors previsionnel.
function calculerJournal(prevRows, declRows, arreteAu) {
  const limite = new Date(arreteAu).getTime();
  const jour = v => String(v || '').slice(0, 10);

  const declParPrevId = {};
  declRows.forEach(d => { if (d.previsionnel_id != null) declParPrevId[d.previsionnel_id] = d; });

  // Appariement de repli. L'apparieur de cesar-sync ne relie pas toujours une
  // seance emargee a son creneau du previsionnel — un intitule de matiere
  // arbitre tardivement, un identifiant CESAR absent. Sans ce repli, la MEME
  // seance apparaissait deux fois dans le journal : "manquante" du cote du
  // plan, "tenue hors previsionnel" du cote de l'emargement. On rapproche
  // donc, a defaut d'identifiant, sur le couple module + jour.
  const repliDisponibles = declRows.filter(d => d.previsionnel_id == null || declParPrevId[d.previsionnel_id] !== d);
  const repliParCle = {};
  repliDisponibles.forEach(d => {
    const k = `${d.module_ref || ''}|${jour(d.date_seance)}`;
    (repliParCle[k] = repliParCle[k] || []).push(d);
  });
  const repliUtilises = new Set();

  const journal = prevRows.map(p => {
    let d = declParPrevId[p.id];
    if (!d) {
      const file = repliParCle[`${p.module_ref || ''}|${jour(p.date_prevue)}`] || [];
      d = file.find(x => !repliUtilises.has(x)) || null;
      if (d) repliUtilises.add(d);
    }
    const base = {
      previsionnel_id: p.id, declaration_id: d ? d.id : null,
      module_ref: p.module_ref || '', libelle_cesar: p.libelle_cesar || '',
      intervenant_nom: (d && d.intervenant_nom) || p.intervenant_nom || '—',
      numero: p.numero, titre: p.titre || p.libelle_cesar || 'Séance',
      date_prevue: p.date_prevue, date_seance: d ? d.date_seance : null,
      duree_minutes: (d && d.duree_minutes) || p.duree_minutes || 0,
      hors_previsionnel: false,
    };
    if (d) {
      const cr = String(d.compte_rendu || '').trim();
      return { ...base, etat: cr ? 'tenue_cr' : 'tenue', compte_rendu: cr,
        detail: cr ? 'Séance tenue, compte rendu saisi.' : 'Séance tenue, aucun compte rendu saisi.' };
    }
    const passee = p.date_prevue && new Date(p.date_prevue).getTime() < limite;
    return passee
      ? { ...base, etat: 'manquante', compte_rendu: '',
          detail: 'Séance programmée à une date passée, sans émargement.' }
      : { ...base, etat: 'a_venir', compte_rendu: '', detail: 'Séance programmée, à venir.' };
  });

  declRows.forEach(d => {
    if (d.previsionnel_id != null && declParPrevId[d.previsionnel_id] === d) return;
    if (repliUtilises.has(d)) return;
    const cr = String(d.compte_rendu || '').trim();
    journal.push({
      previsionnel_id: null, declaration_id: d.id,
      module_ref: d.module_ref || '', libelle_cesar: d.libelle_cesar || '',
      intervenant_nom: d.intervenant_nom || '—', numero: d.seance_numero,
      titre: d.libelle_cesar || d.module_ref || 'Séance', date_prevue: null,
      date_seance: d.date_seance, duree_minutes: d.duree_minutes || 0,
      hors_previsionnel: true, etat: cr ? 'tenue_cr' : 'tenue', compte_rendu: cr,
      detail: 'Séance émargée sans correspondance au prévisionnel.',
    });
  });

  return journal.sort((a, b) =>
    String(a.date_seance || a.date_prevue || '').localeCompare(String(b.date_seance || b.date_prevue || '')));
}

// ── 2. Verdict par competence ──────────────────────────────────────────────
//
// Cumule depuis le debut de l'annee scolaire, arrete a la fin du mois
// affiche : une competence couverte en octobre ne doit pas redevenir
// "non couverte" quand on ouvre novembre.
//
//   couverte    au moins une seance tenue sur un module qui la porte
//   programmee  aucune seance tenue, mais au moins une au calendrier
//   absente     ni tenue, ni programmee
//
// `absente` est l'heritiere de l'ancien ecart −. C'est le seul signal qui ne
// se lit nulle part ailleurs dans le systeme d'information, et le seul qui
// engage la certification.
function calculerCompetences(blocs, prevCumul, declCumul) {
  const couverts = new Set();
  declCumul.forEach(d => (d.competences || []).forEach(c => couverts.add(normCode(c))));
  const programmes = new Set();
  prevCumul.forEach(p => (p.competences || []).forEach(c => programmes.add(normCode(c))));

  // Les options intensives sont mutuellement exclusives : un etudiant en suit
  // une seule. Le groupe planning importe porte donc les seances d'UNE option,
  // et l'autre n'a aucun creneau — ce qui est normal, pas un trou du plan.
  // Le 08/10/2026 le M2 MSMC du groupe CREA annoncait ainsi trois competences
  // « sans creneau » sur le bloc Marque & Transformation, que ce groupe ne
  // suit pas. Un bloc d'option entierement vide est donc hors parcours ; a
  // l'interieur d'une option effectivement suivie, une competence sans creneau
  // reste un vrai signal.
  const modulesAvecSeance = new Set();
  prevCumul.forEach(p => { if (p.module_ref) modulesAvecSeance.add(String(p.module_ref)); });
  declCumul.forEach(d => { if (d.module_ref) modulesAvecSeance.add(String(d.module_ref)); });

  const out = [];
  (blocs || []).forEach(b => {
    const option = (b.nature || 'obligatoire') === 'option';
    const blocSuivi = (b.modules || []).some(m => modulesAvecSeance.has(String(m.titre)));
    (b.competences || []).forEach(c => {
      const k = normCode(c.id);
      let etat;
      if (couverts.has(k)) etat = 'couverte';
      else if (programmes.has(k)) etat = 'programmee';
      else if (option && !blocSuivi) etat = 'hors_parcours';
      else etat = 'absente';
      out.push({ bloc_id: b.id, bloc_titre: b.titre, nature: b.nature || 'obligatoire',
        option_groupe: b.option_groupe || '', code: c.id, libelle: c.libelle || '', etat });
    });
  });
  return out;
}

// ── Identite d'un signal ───────────────────────────────────────────────────
//
// `cle` identifie le signal dans la duree ; `empreinte` fige son etat chiffre.
// Un signal classe se tait tant que son empreinte ne bouge pas : ajouter un
// creneau au module, ou un troisieme intervenant sur la meme famille, le fait
// reapparaitre. C'est le serveur qui fabrique les deux — l'interface se
// contente de les renvoyer tels quels, de sorte que l'identite d'un signal ne
// depende jamais de ce qu'un ecran a bien voulu en retenir.
function empreinteDistorsion(d) {
  return [d.etat, d.volume_annonce == null ? '' : d.volume_annonce, d.heures_programmees].join('|');
}
function empreinteRedite(r) {
  return [(r.modules || []).join(','), (r.intervenants || []).join(',')].join('|');
}

// ── 3. Distorsion au grain du module ───────────────────────────────────────
//
// Le plan de formation annonce un volume horaire par module. CESAR dit ce qui
// est au calendrier et ce qui a ete tenu. La comparaison des deux est la
// seule mesure d'ecart que l'emargement autorise — et c'est celle que le
// modele declaratif ne faisait pas.
//
//   jamais_programme  aucun creneau de l'annee ne porte ce module
//   sous_volume       le calendrier promet moins que le plan de formation
//   sur_volume        le calendrier promet sensiblement plus
//
// Seuil a 10 % : en deca, l'ecart releve de l'arrondi de decoupage horaire.
const SEUIL_DISTORSION = 0.10;

function calculerDistorsions(blocs, horsBloc, prevCumul, declCumul) {
  const par = {};
  const vide = () => ({ prog_seances: 0, prog_minutes: 0, faites: 0, minutes_faites: 0, intervenants: new Set() });
  prevCumul.forEach(p => {
    const k = String(p.module_ref || ''); if (!k) return;
    const e = (par[k] = par[k] || vide());
    e.prog_seances++; e.prog_minutes += Number(p.duree_minutes || 0);
    if (p.intervenant_nom) e.intervenants.add(String(p.intervenant_nom));
  });
  declCumul.forEach(d => {
    const k = String(d.module_ref || ''); if (!k) return;
    const e = (par[k] = par[k] || vide());
    e.faites++; e.minutes_faites += Number(d.duree_minutes || 0);
    if (d.intervenant_nom) e.intervenants.add(String(d.intervenant_nom));
  });

  const modules = (blocs || []).flatMap(b => (b.modules || []).map(m => ({ ...m, bloc_id: b.id, bloc_titre: b.titre, nature: b.nature || 'obligatoire' })))
    .concat((horsBloc || []).map(m => ({ ...m, bloc_id: 'HB', bloc_titre: 'Hors bloc', nature: 'hors_bloc' })));

  const out = [];
  modules.forEach(m => {
    const e = par[m.titre] || vide();
    const annonce = m.volume == null ? null : Number(m.volume);
    const hProg = Math.round((e.prog_minutes / 60) * 10) / 10;
    const hFaites = Math.round((e.minutes_faites / 60) * 10) / 10;
    let etat = 'conforme';
    let detail = '';
    if (!e.prog_seances) {
      etat = 'jamais_programme';
      detail = annonce
        ? `${annonce} h au plan de formation, aucun créneau à l'année.`
        : "Aucun créneau à l'année.";
    } else if (annonce) {
      const delta = (hProg - annonce) / annonce;
      if (delta < -SEUIL_DISTORSION) {
        etat = 'sous_volume';
        detail = `${hProg} h programmées pour ${annonce} h annoncées.`;
      } else if (delta > SEUIL_DISTORSION) {
        etat = 'sur_volume';
        detail = `${hProg} h programmées pour ${annonce} h annoncées.`;
      }
    }
    if (etat === 'conforme') return;
    const sig = { module: m.titre, bloc_id: m.bloc_id, bloc_titre: m.bloc_titre, nature: m.nature,
      competences: m.competences_liees || [], volume_annonce: annonce,
      heures_programmees: hProg, heures_faites: hFaites,
      seances_programmees: e.prog_seances, seances_faites: e.faites,
      intervenants: Array.from(e.intervenants).sort(), etat, detail,
      type: 'distorsion', cle: m.titre };
    sig.empreinte = empreinteDistorsion(sig);
    out.push(sig);
  });

  const ordre = { jamais_programme: 0, sous_volume: 1, sur_volume: 2 };
  return out.sort((a, b) => (ordre[a.etat] - ordre[b.etat]) || a.module.localeCompare(b.module));
}

// ── 4. Redites ─────────────────────────────────────────────────────────────
//
// Remplace detecterCoordination(), qui comparait les `competences` des
// declarations. Depuis le pont CESAR ce champ porte TOUTES les competences du
// module : deux modules partageant C7 auraient declenche un signal chaque
// mois, en permanence. Le capteur utile est plus fin — la famille de notions,
// regroupee hors ligne et versionnee dans referentiels/notions/, lue par
// api/_lib/referentiels.js et portee par chaque module.
//
// Une redite, c'est une meme famille traitee dans le meme mois, dans deux
// modules differents, par deux intervenants differents. L'emargement le sait
// desormais : il nomme qui etait devant les etudiants, et quand.
//
// La forme de sortie — { titre, detail } — est inchangee a dessein : elle
// alimente le champ `coordination` du digest, dont l'ecran et le mail sont
// verrouilles.
function detecterRedites(blocs, horsBloc, declarationsPeriode) {
  const famillesParModule = {};
  (blocs || []).forEach(b => (b.modules || []).forEach(m => { famillesParModule[m.titre] = m.familles || []; }));
  (horsBloc || []).forEach(m => { famillesParModule[m.titre] = m.familles || []; });

  const par = {};
  declarationsPeriode.forEach(d => {
    const mod = String(d.module_ref || ''); if (!mod) return;
    (famillesParModule[mod] || []).forEach(f => {
      const e = (par[f] = par[f] || { famille: f, modules: new Set(), intervenants: new Set(), dates: [] });
      e.modules.add(mod);
      if (d.intervenant_nom) e.intervenants.add(String(d.intervenant_nom));
      if (d.date_seance) e.dates.push(String(d.date_seance).slice(0, 10));
    });
  });

  return Object.values(par)
    .filter(e => e.modules.size > 1 && e.intervenants.size > 1)
    .map(e => {
      const dates = e.dates.sort();
      const modules = Array.from(e.modules).sort();
      const intervenants = Array.from(e.intervenants).sort();
      const r = {
        titre: `${e.famille} — reprise par ${intervenants.length} intervenants`,
        detail: `Traitée ce mois-ci dans ${modules.map(titreLisible).join(' et ')}, par ${intervenants.join(', ')}`
          + (dates.length ? ` (${periodeCourte(dates)}).` : '.'),
        famille: e.famille, modules, intervenants,
        type: 'redite',
        // La redite se calcule sur un mois : sa clé le porte, sinon classer la
        // redite d'octobre ferait taire celle de mars.
        cle: `${e.famille}@${String(dates[0] || '').slice(0, 7)}`,
      };
      r.empreinte = empreinteRedite(r);
      return r;
    })
    .sort((a, b) => b.intervenants.length - a.intervenants.length);
}

// ── Application des arbitrages ─────────────────────────────────────────────
//
// Un signal porte sa decision s'il en a une ET si son empreinte n'a pas bouge
// depuis. Sinon il redevient un signal neuf : `arbitrage` reste nul et
// `rouvert` dit pourquoi, pour que le FR comprenne qu'il l'avait deja vu.
function appliquerArbitrages(signaux, lignes) {
  const par = {};
  (lignes || []).forEach(a => { par[`${a.type}|${a.cle}`] = a; });
  return (signaux || []).map(sig => {
    const a = par[`${sig.type}|${sig.cle}`];
    if (!a) return { ...sig, arbitrage: null, rouvert: false };
    if (String(a.empreinte || '') !== String(sig.empreinte || '')) {
      return { ...sig, arbitrage: null, rouvert: true,
               rouvert_detail: 'Les chiffres ont changé depuis votre arbitrage.' };
    }
    return { ...sig, rouvert: false,
             arbitrage: { decision: a.decision, note: a.note || '', decide_at: a.decide_at } };
  });
}

// ── Lectures tolerantes ────────────────────────────────────────────────────
//
// Le 08/10/2026, L'Atelier est tombe en entier sur « no such table: arbitrage »
// parce que /api/setup n'avait pas encore ete rejoue apres le deploiement. Un
// ecran complet perdu pour une table optionnelle absente, c'est une fragilite
// qu'on ne peut pas garder : la DSI va rejouer cette sequence sur ses propres
// serveurs, et le decalage entre le code deploye et le schema en base se
// reproduira.
//
// `tolerer` n'avale QUE le schema manquant — table ou colonne. Toute autre
// erreur (connexion, syntaxe, contrainte) remonte normalement : masquer une
// panne reelle serait pire que l'ecran blanc.
function schemaManquant(e) {
  const m = String((e && e.message) || e).toLowerCase();
  return m.includes('no such table') || m.includes('no such column');
}

async function tolerer(promesse, repli, degradations, quoi) {
  try { return await promesse; }
  catch (e) {
    if (!schemaManquant(e)) throw e;
    if (degradations) degradations.push({ quoi, raison: String((e && e.message) || e) });
    return repli;
  }
}

async function lireArbitrages(db, formationId, anneeScolaire, degradations) {
  const r = await tolerer(db.execute({
    sql: `SELECT type, cle, decision, empreinte, note, periode, decide_at
          FROM arbitrage WHERE formation_id = ? AND annee_scolaire = ?`,
    args: [formationId, anneeScolaire],
  }), { rows: [] }, degradations, 'arbitrage');
  return r.rows;
}

// ── Compatibilite ascendante ───────────────────────────────────────────────
// src/App.jsx lit encore `ecarts` dans l'ancienne forme. Tant que le Bloc 2
// n'est pas commite, on la fabrique depuis le journal : seul l'etat
// `manquante` y devient une alerte, ce qui suffit a faire disparaitre les
// deux faux signaux symetriques decrits en tete de section.
function ecartsRetrocompatibles(journal) {
  return journal.filter(j => !j.hors_previsionnel).map(j => ({
    previsionnel_id: j.previsionnel_id, module_ref: j.module_ref,
    intervenant_nom: j.intervenant_nom, numero: j.numero, titre: j.titre,
    date_prevue: j.date_prevue,
    etat: j.etat === 'manquante' ? 'alerte' : 'nominal',
    detail: j.detail,
  }));
}

// Destinataires du digest : intervenants inscrits sur ce titre.
async function getDestinataires(db, formationId, anneeScolaire) {
  const r = await db.execute({
    sql: `SELECT DISTINCT u.email, u.nom, u.prenom
          FROM inscription i JOIN users u ON u.id = i.user_id
          WHERE i.formation_id = ? AND i.role = 'intervenant' AND i.annee_scolaire = ?
            AND u.email IS NOT NULL AND u.email != ''`,
    args: [formationId, anneeScolaire],
  });
  return r.rows.map(row => ({ email: row.email, nom: `${row.prenom || ''} ${row.nom || ''}`.trim() }));
}

// ── Appel Claude : uniquement le titre + une suggestion de note FR ─────────
async function suggererTitreEtNote(apiKey, faits) {
  const schema = {
    type: 'object',
    properties: {
      titre: { type: 'string' },
      note_fr_suggestion: { type: 'string' },
    },
    required: ['titre', 'note_fr_suggestion'],
    additionalProperties: false,
  };

  const prompt =
    'Tu rediges 2 elements courts pour un digest mensuel envoye a des intervenants d\'un titre RNCP. ' +
    'Utilise UNIQUEMENT les faits fournis ci-dessous — n\'invente aucun chiffre, aucun nom absent des faits.\n\n' +
    'FAITS :\n' + JSON.stringify(faits, null, 2) + '\n\n' +
    'titre : 4-8 mots, ton factuel, ex "Ce que la promo a traverse en <mois>".\n' +
    'note_fr_suggestion : 1-2 phrases, ton positif et factuel (jamais culpabilisant), ' +
    'signalant si besoin un point de coordination a venir entre 2 intervenants nommes dans les faits. ' +
    'Si aucun point de coordination notable, propose une phrase neutre de synthese. ' +
    'Cette note sera relue et modifiable par le Formateur Referent avant envoi.';

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: { type: 'json_schema', schema } },
    }),
  });
  const raw = await r.json();
  if (!r.ok) throw new Error((raw && raw.error && raw.error.message) || ('Claude HTTP ' + r.status));
  const text = (raw.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try { return JSON.parse(text); }
  catch (_) { return { titre: `Digest — ${labelMois(new Date().toISOString())}`, note_fr_suggestion: '' }; }
}

// ── Generation complete du contenu d'un digest pour un titre + periode ────
async function genererContenuDigest(db, apiKey, formationId, campus, anneeScolaire, periodeRef) {
  const { debut, fin } = bornesMois(periodeRef);
  const { debut: debutSuivant, fin: finSuivant } = bornesMoisSuivant(periodeRef);

  const formationRow = await db.execute({ sql: 'SELECT titre, data_json FROM formations WHERE id = ?', args: [formationId] });
  if (!formationRow.rows.length) throw new Error('Formation introuvable.');
  const formationData = parseJSON(formationRow.rows[0].data_json, {});
  const blocs = formationData.blocs || [];
  const titreFormation = formationRow.rows[0].titre || formationData.formation && formationData.formation.titre || 'Formation';

  const [prevPeriode, declPeriode, declCumul, prevSuivant] = await Promise.all([
    db.execute({ sql: `SELECT id, module_ref, titre, intervenant_nom, numero, date_prevue, modalite, concepts
                        FROM previsionnel_seance WHERE formation_id=? AND annee_scolaire=? AND date_prevue>=? AND date_prevue<=?`,
      args: [formationId, anneeScolaire, debut, fin] }),
    db.execute({ sql: `SELECT id, previsionnel_id, module_ref, intervenant_nom, date_seance, duree_minutes, competences
                        FROM declaration WHERE formation_id=? AND annee_scolaire=? AND date_seance>=? AND date_seance<=?`,
      args: [formationId, anneeScolaire, debut, fin] }),
    db.execute({ sql: `SELECT competences FROM declaration WHERE formation_id=? AND annee_scolaire=?`,
      args: [formationId, anneeScolaire] }),
    db.execute({ sql: `SELECT module_ref, titre, intervenant_nom, date_prevue, duree_minutes
                        FROM previsionnel_seance WHERE formation_id=? AND annee_scolaire=? AND date_prevue>=? AND date_prevue<=?
                        ORDER BY date_prevue ASC`,
      args: [formationId, anneeScolaire, debutSuivant, finSuivant] }),
  ]);

  const declarationsPeriode = declPeriode.rows.map(r => ({ ...r, competences: parseJSON(r.competences, []) }));
  const declarationsCumul = declCumul.rows.map(r => ({ competences: parseJSON(r.competences, []) }));
  const previsionnelParId = {};
  prevPeriode.rows.forEach(p => { previsionnelParId[p.id] = { ...p, concepts: parseJSON(p.concepts, []) }; });

  const horsBloc = formationData.modules_hors_bloc || [];
  const idxBlocs = blocParModule(blocs, horsBloc);

  const avancementBlocs = calculerAvancementBlocs(blocs, declarationsCumul);
  const quiAEnseigne = calculerQuiAEnseigne(declarationsPeriode, idxBlocs);
  // Le point de coordination n'est plus un doublon de competence mais une
  // redite de famille de notions (cf. detecterRedites). Le point du mois : les redites que le FR n'a pas classées,
  // plus les écarts de volume qu'il a explicitement portés au digest.
  const lignesArb = await lireArbitrages(db, formationId, anneeScolaire, null);
  const redites = appliquerArbitrages(detecterRedites(blocs, horsBloc, declarationsPeriode), lignesArb);
  const [prevAnnee, declAnnee] = await Promise.all([
    db.execute({ sql: `SELECT module_ref, intervenant_nom, duree_minutes FROM previsionnel_seance
                       WHERE formation_id=? AND annee_scolaire=?`, args: [formationId, anneeScolaire] }),
    db.execute({ sql: `SELECT module_ref, intervenant_nom, duree_minutes FROM declaration
                       WHERE formation_id=? AND annee_scolaire=?`, args: [formationId, anneeScolaire] }),
  ]);
  const distorsions = appliquerArbitrages(
    calculerDistorsions(blocs, horsBloc, prevAnnee.rows, declAnnee.rows), lignesArb);

  const coordination = [
    ...redites.filter(r => !r.arbitrage || r.arbitrage.decision === 'digest'),
    ...distorsions.filter(d => d.arbitrage && d.arbitrage.decision === 'digest')
      .map(d => ({ titre: `${titreLisible(d.module)} — point de volume`,
                   detail: (d.arbitrage.note || d.detail || '') })),
  ].map(x => ({ titre: x.titre, detail: x.detail }));

  // Le mois prochain : une ligne par module, avec sa periode, et non une ligne
  // par creneau. Une semaine de hackathon produisait dix lignes identiques.
  const aVenir = {};
  prevSuivant.rows.forEach(p => {
    const mod = String(p.module_ref || p.titre || '') || 'Module';
    const who = p.intervenant_nom && p.intervenant_nom !== '—' ? p.intervenant_nom : '';
    const k = `${mod}|${who}`;
    if (!aVenir[k]) aVenir[k] = { module: titreLisible(mod), bloc: idxBlocs[mod] || '',
                                  intervenant: who, seances: 0, dates: [] };
    aVenir[k].seances++;
    if (p.date_prevue) aVenir[k].dates.push(String(p.date_prevue));
  });
  const sequencesAVenir = Object.values(aVenir)
    .map(e => ({ module: e.module, bloc: e.bloc, intervenant: e.intervenant,
                 seances: e.seances, periode: periodeCourte(e.dates), debut: e.dates.slice().sort()[0] || '' }))
    .sort((a, b) => String(a.debut).localeCompare(String(b.debut)))
    .slice(0, 10);

  const kpis = {
    intervenants: new Set(declarationsPeriode.map(d => d.intervenant_nom).filter(Boolean)).size,
    seances: declarationsPeriode.length,
    heures: heures(declarationsPeriode.reduce((n, d) => n + Number(d.duree_minutes || 0), 0)),
    coordination: coordination.length,
  };

  let redaction = { titre: `Digest — ${labelMois(debut)}`, note_fr_suggestion: '' };
  if (apiKey) {
    try {
      redaction = await suggererTitreEtNote(apiKey, {
        titre_formation: titreFormation, mois: labelMois(debut), kpis, coordination, avancement_blocs: avancementBlocs,
      });
    } catch (_) { /* on garde le fallback deterministe si Claude echoue */ }
  }

  const destinataires = await getDestinataires(db, formationId, anneeScolaire);

  return {
    contenu: {
      titre: redaction.titre,
      periode: { debut, fin, label: labelMois(debut) },
      kpis,
      avancement_blocs: avancementBlocs,
      qui_a_enseigne: quiAEnseigne,
      coordination,
      note_fr_suggestion: redaction.note_fr_suggestion,
      note_fr: redaction.note_fr_suggestion,
      sequences_a_venir: sequencesAVenir,
    },
    destinataires,
    debut,
    fin,
  };
}

async function upsertDigest(db, { formationId, campus, anneeScolaire, debut, fin, contenu, destinataires }) {
  const existing = await db.execute({
    sql: `SELECT id, statut FROM digest_fr WHERE formation_id=? AND campus=? AND semaine_debut=?`,
    args: [formationId, campus, debut],
  });
  if (existing.rows.length) {
    const row = existing.rows[0];
    if (row.statut === 'envoye') {
      return { id: row.id, statut: 'envoye', regenere: false };
    }
    await db.execute({
      sql: `UPDATE digest_fr SET contenu_genere=?, destinataires=?, statut='genere' WHERE id=?`,
      args: [JSON.stringify(contenu), JSON.stringify(destinataires), row.id],
    });
    return { id: row.id, statut: 'genere', regenere: true };
  }
  const ins = await db.execute({
    sql: `INSERT INTO digest_fr (formation_id, campus, semaine_debut, semaine_fin, contenu_genere, statut, destinataires, annee_scolaire)
          VALUES (?,?,?,?,?,'genere',?,?)`,
    args: [formationId, campus, debut, fin, JSON.stringify(contenu), JSON.stringify(destinataires), anneeScolaire],
  });
  return { id: Number(ins.lastInsertRowid), statut: 'genere', regenere: false };
}

// ── Envoi Resend ───────────────────────────────────────────────────────────
// ── Rendu HTML du digest ───────────────────────────────────────────────────
// Reecrit le 25/08/2026. Trois defauts corriges :
//  1. La section "Avancement RNCP par bloc" ecrivait en color:#fff sur un
//     conteneur sans fond — blanc sur blanc, illisible. Invisible depuis
//     l'apercu in-app, qui a son propre fond sombre.
//  2. Le bandeau de KPI (intervenants / seances / coordination) et les barres
//     de progression, presents dans l'apercu, etaient absents du mail : les
//     deux ne montraient pas la meme chose, alors que l'ecran promet
//     "tel que les intervenants le recevront".
//  3. Aucun echappement HTML sur les noms, libelles et note du FR.
//
// Structure en tables avec bgcolor explicite sur chaque cellule : c'est la
// seule mise en forme fiable dans Outlook, qui rend le HTML avec le moteur de
// Word et ignore les fonds poses sur des <div>. Aucune couleur en rgba() pour
// la meme raison — uniquement des hex opaques.
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Palette Eminéo, en hex opaques (pas de rgba : Outlook ne la supporte pas).
const C = {
  abysse: '#0B2B2D', petrole: '#134547', menthe: '#5DE298', givre: '#E3FFF0',
  saumon: '#E89B77', rail: '#17383A', ligne: '#1C4143',
  texte: '#FFFFFF', texteAtt: '#9FB8B5', label: '#7FA09C',
};

function renderDigestHTML(c, titreFormation, campus, frNom) {
  const kpis = c.kpis || { intervenants: 0, seances: 0, coordination: 0 };

  const kpi = (val, lib, couleur) =>
    `<td width="33%" valign="top" style="padding:0 8px 0 0;font-family:Arial,Helvetica,sans-serif">
       <div style="font-size:26px;font-weight:700;color:${couleur};line-height:1">${esc(val)}</div>
       <div style="font-size:11px;color:${C.texteAtt};padding-top:4px">${esc(lib)}</div>
     </td>`;

  // Barre de progression en table : une cellule remplie a X %, une cellule
  // vide pour le reste. Fonctionne partout, y compris Outlook.
  const barre = (pct) => {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    const rempli = p > 0
      ? `<td width="${p}%" bgcolor="${C.menthe}" style="height:4px;line-height:4px;font-size:1px">&nbsp;</td>`
      : '';
    const vide = p < 100
      ? `<td width="${100 - p}%" bgcolor="${C.rail}" style="height:4px;line-height:4px;font-size:1px">&nbsp;</td>`
      : '';
    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>${rempli}${vide}</tr></table>`;
  };

  const blocs = (c.avancement_blocs || []).map(b => `
    <tr><td style="padding:0 0 12px 0;font-family:Arial,Helvetica,sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-size:12px;color:${C.texte};padding-bottom:5px">${esc(b.titre)}</td>
        <td align="right" style="font-size:12px;font-weight:700;color:${C.menthe};padding-bottom:5px">${b.pct == null ? '—' : b.pct + '%'}</td>
      </tr></table>
      ${barre(b.pct)}
    </td></tr>`).join('');

  const qui = (c.qui_a_enseigne || []).map(q => {
    const bas = [q.intervenant, q.seances ? `${q.seances} séance${q.seances > 1 ? 's' : ''}` : '',
                 q.heures ? `${q.heures} h` : ''].filter(Boolean).join(' · ');
    return `
    <tr><td style="padding:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;border-bottom:1px solid ${C.ligne}">
      ${q.bloc ? `<div style="font-size:10px;color:${C.label};text-transform:uppercase;letter-spacing:.08em;padding-bottom:3px">${esc(q.bloc)}</div>` : ''}
      <div style="font-size:13px;color:${C.texte};line-height:1.4;padding-bottom:3px">${esc(q.module)}</div>
      <div style="font-size:11px;color:${C.texteAtt}">${esc(bas)}</div>
    </td></tr>`;
  }).join('');

  const coord = (c.coordination || []).map(co => `
    <tr><td style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif">
      <div style="font-size:12px;color:${C.saumon};font-weight:600">${esc(co.titre)}</div>
      <div style="font-size:11px;color:${C.texteAtt};line-height:1.5">${esc(co.detail)}</div>
    </td></tr>`).join('');

  const suite = (c.sequences_a_venir || []).map(s => {
    const bas = [s.periode, s.intervenant,
                 s.seances > 1 ? `${s.seances} séances` : ''].filter(Boolean).join(' · ');
    return `
    <tr><td style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif">
      <div style="font-size:12.5px;color:${C.texte};line-height:1.4">${esc(s.module)}</div>
      <div style="font-size:11px;color:${C.texteAtt}">${esc(bas)}</div>
    </td></tr>`;
  }).join('');

  const section = (label, contenu) => `
    <tr><td bgcolor="${C.abysse}" style="padding:20px 26px;border-bottom:1px solid ${C.ligne}">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.label};padding-bottom:14px">${esc(label)}</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">${contenu}</table>
    </td></tr>`;

  const vide = (msg) => `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${C.texteAtt}">${esc(msg)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(c.titre || 'Atlas — Éminéo')}</title></head>
<body style="margin:0;padding:0;background:${C.abysse}">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.abysse}" style="background:${C.abysse}">
<tr><td align="center" style="padding:24px 12px">

<table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;border-collapse:collapse;border-radius:14px;overflow:hidden">

  <tr><td bgcolor="${C.petrole}" style="padding:14px 26px;font-family:Arial,Helvetica,sans-serif">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-size:15px;font-weight:700;color:${C.menthe}">Atlas · Éminéo</td>
      <td align="right" style="font-size:11px;color:${C.texteAtt}">${esc(titreFormation)}${campus ? ' · ' + esc(campus) : ''}</td>
    </tr></table>
  </td></tr>

  <tr><td bgcolor="${C.abysse}" style="padding:28px 26px;font-family:Arial,Helvetica,sans-serif">
    <div style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.menthe};padding-bottom:8px">Synthèse · Formateur Référent ${esc(frNom)}</div>
    <div style="font-size:23px;font-weight:700;color:${C.texte};line-height:1.25;padding-bottom:8px">${esc(c.titre)}</div>
    <div style="font-size:12px;color:${C.texteAtt};line-height:1.5">Généré par Atlas · Validé avant envoi · Répondez à ce mail pour contacter ${esc(frNom || 'le Formateur Référent')}</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid ${C.ligne}">
      <tr><td style="padding-top:18px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          ${kpi(kpis.intervenants, 'Intervenants', C.menthe)}
          ${kpi(kpis.seances, 'Séances tenues', C.menthe)}
          ${kpi((kpis.heures != null ? kpis.heures + ' h' : '—'), 'Heures de cours', C.menthe)}
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  ${section('Avancement RNCP par bloc', blocs || vide('Aucun bloc de compétences sur ce titre.'))}
  ${section('Qui a enseigné quoi ce mois-ci', qui || vide('Aucune séance déclarée sur la période.'))}

  <tr><td bgcolor="${C.abysse}" style="padding:20px 26px;border-bottom:1px solid ${C.ligne}">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.label};padding-bottom:14px">Point de coordination — ${esc(frNom || 'FR')}</div>
    ${c.note_fr ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:${coord ? '14px' : '0'}">
      <tr><td bgcolor="#2A2320" style="padding:14px 16px;border-left:3px solid ${C.saumon};font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:${C.givre};line-height:1.65">${esc(c.note_fr)}</td></tr>
    </table>` : ''}
    ${coord ? `<table width="100%" cellpadding="0" cellspacing="0" border="0">${coord}</table>` : (c.note_fr ? '' : vide('Aucun point de coordination ce mois-ci.'))}
  </td></tr>

  ${suite ? section('Ce qui arrive le mois prochain', suite) : ''}

  <tr><td bgcolor="${C.petrole}" style="padding:18px 26px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${C.texteAtt};line-height:1.6">
    Répondre à ce mail = contacter ${esc(frNom || 'le Formateur Référent')} directement.<br>
    Atlas des compétences · Éminéo · ${esc(titreFormation)}
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// Expediteur. Par defaut l'adresse de marque — mais elle exige que le domaine
// emineo-education.fr soit verifie dans Resend (enregistrements SPF/DKIM a
// poser dans la zone DNS, demande DSI). Tant que ce n'est pas fait, Resend
// renvoie 403 "domain is not verified".
// Contournement : ATLAS_MAIL_FROM = "Atlas <onboarding@resend.dev>", le
// bac a sable Resend, qui n'exige aucune verification mais ne delivre QUE
// vers l'adresse du compte Resend — d'ou l'obligation d'avoir en meme temps
// ATLAS_MAIL_REDIRECT pointant sur cette meme adresse.
const MAIL_FROM_DEFAUT = 'Atlas <atlas@emineo-education.fr>';

async function envoyerResend(apiKey, { to, subject, html }) {
  const from = (process.env.ATLAS_MAIL_FROM || '').trim() || MAIL_FROM_DEFAUT;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = (data && (data.message || data.error)) || ('Resend HTTP ' + r.status);
    // Message explicite : l'erreur brute de Resend ne dit pas quoi faire.
    if (String(msg).includes('not verified')) {
      throw new Error(
        `${msg} — Renseigner ATLAS_MAIL_FROM = "Atlas <onboarding@resend.dev>" dans Vercel ` +
        `(mode bac a sable, envoi possible uniquement vers l'adresse du compte Resend), ` +
        `ou faire verifier le domaine emineo-education.fr sur resend.com/domains.`
      );
    }
    throw new Error(msg);
  }
  return data;
}

// ============================================================
// HANDLER
// ============================================================
module.exports = async function handler(req, res) {
  const action = (req.query && req.query.action) || '';

  try {
    const db = getDB();

    // ── Cron mensuel (Vercel Cron → header Authorization: Bearer CRON_SECRET) ──
    if (req.method === 'GET' && action === 'cron-digest') {
      const auth = req.headers.authorization || '';
      const secret = process.env.CRON_SECRET || '';
      if (!secret || auth !== `Bearer ${secret}`) {
        return res.status(401).json({ error: 'Non autorisé.' });
      }
      const now = new Date();
      if (!estPremierLundiDuMois(now)) {
        return res.status(200).json({ ok: true, skip: 'Pas le premier lundi du mois.' });
      }
      const apiKey = process.env.ANTHROPIC_API_KEY;
      const titres = await db.execute({
        sql: `SELECT DISTINCT i.formation_id, i.campus FROM inscription i WHERE i.role = 'fr'`,
      });
      const resultats = [];
      for (const t of titres.rows) {
        try {
          const { contenu, destinataires, debut, fin } = await genererContenuDigest(
            db, apiKey, t.formation_id, t.campus, '2026-27', now.toISOString()
          );
          const up = await upsertDigest(db, {
            formationId: t.formation_id, campus: t.campus, anneeScolaire: '2026-27',
            debut, fin, contenu, destinataires,
          });
          resultats.push({ formation_id: t.formation_id, ...up });
        } catch (e) {
          resultats.push({ formation_id: t.formation_id, error: e.message });
        }
      }
      return res.status(200).json({ ok: true, generes: resultats.length, resultats });
    }

    // ── POST ?action=generate — (re)génère le digest du mois en cours ──────
    if (req.method === 'POST' && action === 'generate') {
      const user = await requireRole(req, ROLES_DIGEST);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });
      const { formation_id, campus, annee_scolaire, periode } = req.body || {};
      if (!formation_id || !campus) return res.status(400).json({ error: 'formation_id et campus requis.' });

      const perim = await verifierPerimetre(db, user, formation_id);
      if (!perim.ok) return res.status(403).json({ error: perim.error });

      const apiKey = process.env.ANTHROPIC_API_KEY;
      const annee = annee_scolaire || '2026-27';
      const ref = periode || new Date().toISOString();
      const { contenu, destinataires, debut, fin } = await genererContenuDigest(db, apiKey, formation_id, campus, annee, ref);
      const up = await upsertDigest(db, { formationId: formation_id, campus, anneeScolaire: annee, debut, fin, contenu, destinataires });
      return res.status(200).json({ ok: true, digest_id: up.id, statut: up.statut, contenu_genere: contenu, destinataires });
    }

    // ── POST ?action=arbitrer — décision du FR sur un signal ──────────────
    // Deux décisions, et aucune n'envoie de mail : le seul canal vers les
    // intervenants reste le digest mensuel. 'annule' revient en arrière.
    if (req.method === 'POST' && action === 'arbitrer') {
      const user = await requireRole(req, ROLES_DIGEST);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });
      const { formation_id, type, cle, empreinte, decision, note, periode, annee_scolaire } = req.body || {};
      if (!formation_id || !type || !cle) {
        return res.status(400).json({ error: 'formation_id, type et cle requis.' });
      }
      if (!['distorsion', 'redite'].includes(String(type))) {
        return res.status(400).json({ error: 'Type de signal inconnu.' });
      }
      if (!['classe', 'digest', 'annule'].includes(String(decision))) {
        return res.status(400).json({ error: "Décision attendue : 'classe', 'digest' ou 'annule'." });
      }
      const perim = await verifierPerimetre(db, user, formation_id);
      if (!perim.ok) return res.status(403).json({ error: perim.error });

      const annee = annee_scolaire || '2026-27';
      if (decision === 'annule') {
        await tolerer(db.execute({
          sql: `DELETE FROM arbitrage WHERE formation_id=? AND annee_scolaire=? AND type=? AND cle=?`,
          args: [formation_id, annee, type, cle],
        }), null, null, 'arbitrage');
        return res.status(200).json({ ok: true, decision: null });
      }

      // Un nouvel arbitrage remplace le precedent : le FR peut passer de
      // 'classe' a 'digest' sans avoir a annuler d'abord.
      try {
      await db.execute({
        sql: `INSERT INTO arbitrage (formation_id, annee_scolaire, type, cle, decision,
                empreinte, note, periode, decide_par, decide_at)
              VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
              ON CONFLICT(formation_id, annee_scolaire, type, cle) DO UPDATE SET
                decision=excluded.decision, empreinte=excluded.empreinte, note=excluded.note,
                periode=excluded.periode, decide_par=excluded.decide_par, decide_at=datetime('now')`,
        args: [formation_id, annee, type, cle, decision, String(empreinte || ''),
               String(note || ''), periode ? bornesMois(periode).debut : null, user.id],
      });
      } catch (e) {
        if (!schemaManquant(e)) throw e;
        return res.status(503).json({ error:
          "La table des arbitrages n'existe pas encore en base. Un compte direction doit rejouer /api/setup (POST) ; aucune donnée existante n'est touchée." });
      }
      return res.status(200).json({ ok: true, decision });
    }

    // ── POST ?action=valider-envoyer — 1 clic : note FR + envoi Resend ─────
    if (req.method === 'POST' && action === 'valider-envoyer') {
      const user = await requireRole(req, ROLES_DIGEST);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });
      const { digest_id, note_fr } = req.body || {};
      if (!digest_id) return res.status(400).json({ error: 'digest_id requis.' });

      const row = await db.execute({
        sql: `SELECT id, formation_id, campus, contenu_genere, destinataires, statut, annee_scolaire
              FROM digest_fr WHERE id = ?`,
        args: [digest_id],
      });
      if (!row.rows.length) return res.status(404).json({ error: 'Digest introuvable.' });
      const digest = row.rows[0];
      if (digest.statut === 'envoye') return res.status(409).json({ error: 'Ce digest a déjà été envoyé.' });

      const perim = await verifierPerimetre(db, user, digest.formation_id);
      if (!perim.ok) return res.status(403).json({ error: perim.error });

      const contenu = parseJSON(digest.contenu_genere, {});
      if (typeof note_fr === 'string') contenu.note_fr = note_fr;
      const destinataires = parseJSON(digest.destinataires, []);
      if (!destinataires.length) return res.status(422).json({ error: 'Aucun destinataire (aucun intervenant inscrit sur ce titre).' });

      const formationRow = await db.execute({ sql: 'SELECT titre FROM formations WHERE id = ?', args: [digest.formation_id] });
      const titreFormation = (formationRow.rows[0] && formationRow.rows[0].titre) || '';
      const frNom = `${user.prenom || ''} ${user.nom || ''}`.trim();

      // ── Garde-fou d'envoi (audit Le Mans, bug B03) ────────────────────────
      // Tant que ATLAS_MAIL_REDIRECT est renseignee dans Vercel, AUCUN mail ne
      // part vers les intervenants : tout est redirige vers cette adresse et le
      // sujet est prefixe [TEST]. Retirer la variable = passage en envoi reel.
      // A conserver renseignee pendant toute la phase de demonstration.
      const redirect = (process.env.ATLAS_MAIL_REDIRECT || '').trim();
      const modeTest = !!redirect;
      const emails = destinataires.map(d => d.email);
      const sujet = contenu.titre || `Atlas — ${titreFormation}`;

      const resendKey = process.env.RESEND_API_KEY;
      let resendId = null;
      if (resendKey) {
        let html = renderDigestHTML(contenu, titreFormation, digest.campus, frNom);
        if (modeTest) {
          // Le rendu est desormais un document HTML complet : le bandeau doit
          // etre insere AVANT </body>, pas concatene apres.
          const bandeau =
            `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.abysse}"><tr><td align="center" style="padding:0 12px 24px">
               <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%">
                 <tr><td bgcolor="#3A2A22" style="padding:14px 18px;border:1px solid ${C.saumon};border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${C.saumon};line-height:1.6">
                   <strong>Mode test.</strong> Ce message aurait été envoyé à ${emails.length} destinataire(s) :<br>${esc(emails.join(', '))}
                 </td></tr>
               </table>
             </td></tr></table>`;
          html = html.replace('</body>', bandeau + '</body>');
        }
        const sent = await envoyerResend(resendKey, {
          to: modeTest ? [redirect] : emails,
          subject: modeTest ? `[TEST] ${sujet}` : sujet,
          html,
        });
        resendId = sent && sent.id;
      }

      await db.execute({
        sql: `UPDATE digest_fr SET statut='envoye', valide_par=?, valide_at=datetime('now'), envoye_at=datetime('now'), resend_id=?, contenu_genere=? WHERE id=?`,
        args: [user.id, resendId, JSON.stringify(contenu), digest_id],
      });

      return res.status(200).json({ ok: true, statut: 'envoye', resend_id: resendId, destinataires: destinataires.length,
        resend_configure: !!resendKey, mode_test: modeTest, redirige_vers: modeTest ? redirect : null });
    }

    // ── GET — lecture (prévu / réalisé / écarts 3 états / digest) ──────────
    if (req.method === 'GET') {
      const user = await requireAuth(req);
      if (!user) return res.status(401).json({ error: 'Non authentifié.' });

      const { formation_id, periode, annee_scolaire } = req.query;
      if (!formation_id) return res.status(400).json({ error: 'formation_id requis.' });

      const annee = annee_scolaire || '2026-27';
      const ref = periode || new Date().toISOString();
      const { debut, fin } = bornesMois(ref);
      const mine = user.role === 'intervenant';
      // Un intervenant ne voit que ses propres séances (prévu ET réalisé) ;
      // RP/FR/dir voient tout le titre.
      const scopeSql = mine ? ' AND (intervenant_id = ? OR intervenant_nom = ?)' : '';
      const scopeArgs = mine ? [user.id, `${user.prenom || ''} ${user.nom || ''}`.trim()] : [];

      const prevu = await db.execute({
        sql: `SELECT id, module_ref, campus, intervenant_id, intervenant_nom,
                     numero, titre, date_prevue, modalite, contenu, concepts, competences,
                     duree_minutes, libelle_cesar
              FROM previsionnel_seance
              WHERE formation_id = ? AND annee_scolaire = ?
                AND date_prevue >= ? AND date_prevue <= ?${scopeSql}
              ORDER BY date_prevue ASC`,
        args: [formation_id, annee, debut, fin, ...scopeArgs],
      });

      const realise = await db.execute({
        sql: `SELECT id, module_ref, previsionnel_id, campus, intervenant_id, intervenant_nom,
                     seance_numero, date_seance, source, couvert, competences,
                     compte_rendu, statut_cr, ecart, signal, declared_at,
                     duree_minutes, libelle_cesar
              FROM declaration
              WHERE formation_id = ? AND annee_scolaire = ?
                AND date_seance >= ? AND date_seance <= ?${scopeSql}
              ORDER BY date_seance ASC`,
        args: [formation_id, annee, debut, fin, ...scopeArgs],
      });

      const prevRows = prevu.rows.map(r => ({ ...r, concepts: parseJSON(r.concepts, []), competences: parseJSON(r.competences, []) }));
      const declRows = realise.rows.map(r => ({ ...r, couvert: parseJSON(r.couvert, []), competences: parseJSON(r.competences, []) }));
      // Journal des séances de la période : union du programmé et de l'émargé.
      const journal = calculerJournal(prevRows, declRows, new Date().toISOString());
      const ecarts = ecartsRetrocompatibles(journal);

      // Cumul depuis le début de l'année scolaire, arrêté à la FIN du mois
      // affiché : une compétence couverte en octobre ne doit pas redevenir
      // « non couverte » quand on ouvre novembre.
      const [formationRow, declCumulRows, prevCumulRows] = await Promise.all([
        db.execute({ sql: 'SELECT data_json FROM formations WHERE id = ?', args: [formation_id] }),
        db.execute({
          sql: `SELECT module_ref, intervenant_nom, date_seance, duree_minutes, competences
                FROM declaration
                WHERE formation_id = ? AND annee_scolaire = ? AND date_seance <= ?${scopeSql}`,
          args: [formation_id, annee, fin, ...scopeArgs],
        }),
        db.execute({
          sql: `SELECT module_ref, intervenant_nom, date_prevue, duree_minutes, competences
                FROM previsionnel_seance
                WHERE formation_id = ? AND annee_scolaire = ?${scopeSql}`,
          args: [formation_id, annee, ...scopeArgs],
        }),
      ]);
      const formationData = parseJSON(formationRow.rows[0]?.data_json, {});
      const blocs = formationData.blocs || [];
      const horsBloc = formationData.modules_hors_bloc || [];
      const declarationsCumul = declCumulRows.rows.map(r => ({ ...r, competences: parseJSON(r.competences, []) }));
      const previsionnelCumul = prevCumulRows.rows.map(r => ({ ...r, competences: parseJSON(r.competences, []) }));

      const avancementBlocs = calculerAvancementBlocs(blocs, declarationsCumul);
      const competences = calculerCompetences(blocs, previsionnelCumul, declarationsCumul);
      const degradations = [];
      const lignesArb = await lireArbitrages(db, formation_id, annee, degradations);
      const distorsions = appliquerArbitrages(
        calculerDistorsions(blocs, horsBloc, previsionnelCumul, declarationsCumul), lignesArb);
      const redites = appliquerArbitrages(
        detecterRedites(blocs, horsBloc, declRows), lignesArb);

      // Pour l'arborescence intervenant : quelles compétences (parmi les
      // siennes) ont déjà été déclarées couvertes, tous mois confondus.
      let mesCompetencesCouvertes = null;
      if (mine) {
        const set = new Set();
        declarationsCumul.forEach(d => (d.competences || []).forEach(c => set.add(normCode(c))));
        mesCompetencesCouvertes = Array.from(set);
      }

      const digest = await tolerer(db.execute({
        sql: `SELECT id, semaine_debut, semaine_fin, contenu_genere, statut,
                     valide_at, envoye_at, destinataires, created_at
              FROM digest_fr
              WHERE formation_id = ? AND annee_scolaire = ? AND semaine_debut = ?
              ORDER BY created_at DESC
              LIMIT 1`,
        args: [formation_id, annee, debut],
      }), { rows: [] }, degradations, 'digest_fr');
      const digestRow = digest.rows[0] || null;

      return res.status(200).json({
        periode: { debut, fin, label: labelMois(debut) },
        // Non vide = l'écran s'affiche mais amputé d'une fonction, faute d'une
        // table absente en base. /api/setup la crée.
        degradations,
        seances_prevues: prevRows,
        seances_realisees: declRows,
        journal,
        competences,
        distorsions,
        redites,
        ecarts,
        avancement_blocs: avancementBlocs,
        mes_competences_couvertes: mesCompetencesCouvertes,
        digest: digestRow
          ? { ...digestRow, contenu_genere: parseJSON(digestRow.contenu_genere, {}), destinataires: parseJSON(digestRow.destinataires, []) }
          : null,
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Méthode ou action non supportée.' });
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
};
