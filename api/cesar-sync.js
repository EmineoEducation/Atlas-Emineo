// ============================================================================
// api/cesar-sync.js — Pont CESAR -> Atlas
// ----------------------------------------------------------------------------
// Douzieme et derniere fonction serverless du plan Vercel Hobby. Toute action
// nouvelle passe donc par ?action= dans ce fichier, jamais par un fichier de
// plus.
//
// DEUX VOIES D'ALIMENTATION, UN SEUL CONTRAT
//   1. Import manuel  — un compte `dir` ou `rp` depose un export CESAR converti
//                       en JSON par l'extracteur local (outils/).
//   2. Push DSI       — le meme JSON, sur le meme endpoint, authentifie par la
//                       cle de service CESAR_SYNC_SECRET (en-tete
//                       x-atlas-cesar-key). Aucun compte utilisateur requis.
// Le contrat ecrit pour la voie 1 est donc la specification de la voie 2 :
// quand la DSI branche le flux, rien n'est a reecrire cote Atlas.
//
// DEUX FLUX DISTINCTS, PAS UN SEUL
//   ?action=previsionnel  Progressions des intervenants. One-shot annuel.
//                         -> table previsionnel_seance
//   ?action=realise       Seances emargees + compte rendu de seance.
//                         Incremental, rejouable. -> table declaration
//
// CE QUE CET ENDPOINT NE FAIT PAS
//   Il ne rattache jamais une seance a une competence RNCP. Le compte rendu
//   arrive en prose libre : il est stocke tel quel (declaration.compte_rendu,
//   statut_cr = 'a_mapper') et le rattachement aux competences reste une etape
//   distincte, proposee par Claude et validee par un humain. Meme regle que
//   pour les referentiels : rien n'entre dans le graphe sans arbitrage.
//
// IDEMPOTENCE
//   Chaque seance porte un ref_cesar unique. Reimporter le meme export met a
//   jour, ne duplique pas. Si l'export ne fournit pas d'identifiant, il en est
//   fabrique un deterministe a partir de groupe + date + heure + matiere.
//
// ACTIONS
//   GET  ?action=etat[&annee_scolaire=]        tableau de bord de l'import
//   GET  ?action=groupes[&annee_scolaire=]     groupes planning et rattachement
//   GET  ?action=matieres[&formation_id=][&a_arbitrer=1]   file d'arbitrage
//   GET  ?action=couverture&formation_id=      annonce confrontee au realise
//   POST ?action=groupes        { groupes:[...] }
//   POST ?action=rattacher      { code_cesar, titre_court | formation_id }
//   POST ?action=matiere        { formation_id, libelle_cesar, module_ref }
//   POST ?action=previsionnel   { seances:[...] }   [&dry=1]
//   POST ?action=realise        { seances:[...] }   [&dry=1]
//
// ?dry=1 valide l'export et renvoie exactement ce qui serait ecrit, sans rien
// ecrire. A utiliser systematiquement avant un premier import reel.
// ============================================================================

const crypto = require('crypto');
const { getDB } = require('./_lib/db');
const { requireRole } = require('./_lib/auth');

const ANNEE_DEFAUT = '2026-27';
const MAX_SEANCES = 5000;

// ── Normalisation ───────────────────────────────────────────────────────────

// Cle de comparaison d'un intitule de matiere : insensible a la casse, aux
// accents, a la ponctuation et aux espaces multiples. « Relations Presse  » et
// « relations-presse » donnent la meme cle, « Droit social » et « Droit des
// contrats » restent distincts.
function normaliserCle(valeur) {
  return String(valeur || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Accepte 2026-09-15, 15/09/2026, 15-09-2026 et les formes horodatees.
// Rend le format utilise partout ailleurs dans Atlas : YYYY-MM-DDTHH:MM:00.000Z
function normaliserDate(valeur, heure) {
  const s = String(valeur || '').trim();
  if (!s) return null;
  let y, m, d;
  let mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mt) {
    y = mt[1]; m = mt[2].padStart(2, '0'); d = mt[3].padStart(2, '0');
  } else {
    mt = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
    if (!mt) return null;
    d = mt[1].padStart(2, '0'); m = mt[2].padStart(2, '0'); y = mt[3];
  }
  const sourceHeure = String(heure || '').trim() || s.slice(10);
  const ht = sourceHeure.match(/(\d{1,2})\s*[h:]\s*(\d{2})/);
  const hh = ht ? ht[1].padStart(2, '0') : '00';
  const mi = ht ? ht[2] : '00';
  return `${y}-${m}-${d}T${hh}:${mi}:00.000Z`;
}

function enMinutes(heure) {
  const t = String(heure || '').match(/(\d{1,2})\s*[h:]\s*(\d{2})/);
  if (!t) return null;
  return Number(t[1]) * 60 + Number(t[2]);
}

function calculerDuree(s) {
  if (Number.isFinite(Number(s.duree_minutes)) && Number(s.duree_minutes) > 0) {
    return Math.round(Number(s.duree_minutes));
  }
  const a = enMinutes(s.heure_debut);
  const b = enMinutes(s.heure_fin);
  if (a == null || b == null || b <= a) return null;
  return b - a;
}

// Identifiant de repli quand l'export ne fournit pas d'identifiant de seance.
// Deterministe : le meme export rejoue produit les memes cles, donc une mise a
// jour et non un doublon.
function refAuto(codeGroupe, dateISO, libelleMatiere) {
  const graine = [codeGroupe, dateISO, normaliserCle(libelleMatiere)].join('|');
  return 'AUTO-' + crypto.createHash('sha1').update(graine).digest('hex').slice(0, 16);
}

function tableau(v) { return Array.isArray(v) ? v : []; }

// ── Identification de l'appelant ────────────────────────────────────────────

// Voie machine : cle de service partagee avec la DSI. Comparaison a temps
// constant pour ne pas laisser fuiter la cle octet par octet.
function cleService(req) {
  const attendu = String(process.env.CESAR_SYNC_SECRET || '').trim();
  if (!attendu) return false;
  const recu = String(req.headers['x-atlas-cesar-key'] || '').trim();
  if (!recu || recu.length !== attendu.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
  } catch (_) { return false; }
}

// Perimetre d'ecriture. null = aucune restriction (dir ou voie machine).
// Un RP n'ecrit que sur les titres ou il est inscrit — meme regle que
// verifierPerimetre() dans api/fr.js.
async function perimetreIds(db, user) {
  if (!user || user.role === 'dir') return null;
  const r = await db.execute({
    sql: "SELECT DISTINCT formation_id FROM inscription WHERE user_id = ? AND role IN ('fr','rp')",
    args: [user.id],
  });
  return new Set(r.rows.map(x => Number(x.formation_id)));
}

// ── Resolution groupe planning -> formation ─────────────────────────────────

async function chargerGroupes(db, annee) {
  const r = await db.execute({
    sql: `SELECT code_cesar, libelle, groupe_formation, formation_id, campus, statut
          FROM groupe_planning WHERE annee_scolaire = ?`,
    args: [annee],
  });
  const index = {};
  r.rows.forEach(row => {
    index[String(row.code_cesar)] = {
      code: String(row.code_cesar),
      libelle: String(row.libelle || ''),
      formation_id: row.formation_id == null ? null : Number(row.formation_id),
      campus: String(row.campus || 'Le Mans'),
    };
  });
  return index;
}

// ── Resolution intitule CESAR -> module du plan de formation ────────────────
//
// Trois issues possibles, aucune n'interrompt l'import :
//   - intitule connu et arbitre     -> module_ref du plan de formation
//   - intitule connu, non arbitre   -> '' (reste dans la file)
//   - intitule inconnu              -> '' et entree creee dans la file
// Une seance dont la matiere n'est pas resolue est quand meme importee : elle
// est factuelle. Elle ne contribue simplement pas encore a la couverture.
class ResolveurMatieres {
  constructor(db, annee, ecrire) {
    this.db = db;
    this.annee = annee;
    this.ecrire = ecrire;
    this.cache = {};     // `${formationId}|${cle}` -> module_ref
    this.connus = {};    // formations deja chargees
    this.nouveaux = {};  // cles rencontrees et absentes de la base
  }

  async charger(formationId) {
    if (this.connus[formationId]) return;
    const r = await this.db.execute({
      sql: 'SELECT cle, module_ref FROM matiere_cesar WHERE formation_id = ? AND annee_scolaire = ?',
      args: [formationId, this.annee],
    });
    r.rows.forEach(row => {
      this.cache[`${formationId}|${row.cle}`] = String(row.module_ref || '');
    });
    this.connus[formationId] = true;
  }

  async resoudre(formationId, libelle) {
    const cle = normaliserCle(libelle);
    if (!cle) return { module_ref: '', nouveau: false };
    await this.charger(formationId);
    const k = `${formationId}|${cle}`;

    if (Object.prototype.hasOwnProperty.call(this.cache, k)) {
      if (this.ecrire) {
        await this.db.execute({
          sql: 'UPDATE matiere_cesar SET occurrences = occurrences + 1 WHERE formation_id = ? AND cle = ? AND annee_scolaire = ?',
          args: [formationId, cle, this.annee],
        });
      }
      return { module_ref: this.cache[k], nouveau: false };
    }

    // Intitule jamais rencontre : il entre dans la file d'arbitrage.
    if (this.ecrire) {
      try {
        await this.db.execute({
          sql: `INSERT INTO matiere_cesar (formation_id, libelle_cesar, cle, module_ref, origine, occurrences, annee_scolaire)
                VALUES (?,?,?,'','import',1,?)`,
          args: [formationId, String(libelle || ''), cle, this.annee],
        });
      } catch (_) { /* course entre deux lignes du meme import */ }
    }
    this.cache[k] = '';
    if (!this.nouveaux[k]) this.nouveaux[k] = { formation_id: formationId, libelle: String(libelle || '') };
    return { module_ref: '', nouveau: true };
  }

  listeNouveaux() { return Object.values(this.nouveaux); }
}

// ── Rattachement d'une declaration a sa ligne de previsionnel ───────────────
//
// Point delicat : au premier import, AUCUNE matiere n'est encore arbitree, donc
// module_ref est vide des deux cotes. Apparier sur le seul module_ref ne
// rattacherait donc jamais rien, et le comparateur prevu/realise d'api/fr.js
// resterait vide alors que les deux flux sont charges. L'appariement se fait
// donc d'abord sur l'intitule CESAR normalise, qui lui est toujours disponible.
//
// Regle, pour un meme groupe planning :
//   1. meme module (quand il est arbitre) OU meme intitule CESAR normalise
//   2. parmi ces candidats encore libres : meme JOUR en priorite
//   3. a defaut : le premier libre dans l'ordre chronologique
//   4. a defaut : pas de rattachement. La seance compte dans la couverture,
//      pas dans le comparateur — et le bilan le signale.
//
// Les lignes de previsionnel sont chargees une fois par groupe puis filtrees en
// memoire : SQLite ne sait pas normaliser les accents, et un groupe represente
// au plus quelques centaines de seances sur l'annee.
class ApparieurPrevisionnel {
  constructor(db, annee) {
    this.db = db;
    this.annee = annee;
    this.parGroupe = {};
    this.pris = new Set();
  }

  async charger(codeGroupe) {
    if (this.parGroupe[codeGroupe]) return;
    const r = await this.db.execute({
      sql: `SELECT p.id, p.module_ref, p.libelle_cesar, p.date_prevue, p.numero,
                   (SELECT COUNT(*) FROM declaration d WHERE d.previsionnel_id = p.id) AS lie
            FROM previsionnel_seance p
            WHERE p.annee_scolaire = ? AND p.code_groupe_cesar = ?
            ORDER BY p.date_prevue ASC, p.numero ASC`,
      args: [this.annee, codeGroupe],
    });
    this.parGroupe[codeGroupe] = r.rows.map(row => ({
      id: Number(row.id),
      module_ref: String(row.module_ref || ''),
      cle: normaliserCle(row.libelle_cesar),
      jour: String(row.date_prevue || '').slice(0, 10),
    }));
    r.rows.forEach(row => { if (Number(row.lie) > 0) this.pris.add(Number(row.id)); });
  }

  // `reserve` : identifiant deja rattache a cette seance lors d'un import
  // precedent. On le conserve plutot que de reapparier, sans quoi un rejeu
  // pourrait deplacer un rattachement deja etabli.
  async apparier({ codeGroupe, moduleRef, cleMatiere, dateISO, reserve }) {
    if (reserve) { this.pris.add(reserve); return reserve; }
    await this.charger(codeGroupe);
    const jour = String(dateISO).slice(0, 10);

    const candidats = (this.parGroupe[codeGroupe] || []).filter(p => {
      if (this.pris.has(p.id)) return false;
      if (moduleRef && p.module_ref === moduleRef) return true;
      return !!cleMatiere && p.cle === cleMatiere;
    });
    if (!candidats.length) return null;

    const choisi = candidats.find(p => p.jour === jour) || candidats[0];
    this.pris.add(choisi.id);
    return choisi.id;
  }
}

// Resolution de l'intervenant : par email uniquement. Aucun compte n'est cree
// ici — creer des comptes a l'import ouvrirait la porte a des doublons que
// personne ne verrait passer. Le nom reste stocke en clair dans tous les cas.
async function trouverIntervenant(db, email, cache) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  if (Object.prototype.hasOwnProperty.call(cache, e)) return cache[e];
  const r = await db.execute({ sql: 'SELECT id FROM users WHERE lower(email) = ?', args: [e] });
  cache[e] = r.rows.length ? Number(r.rows[0].id) : null;
  return cache[e];
}

// ════════════════════════════════════════════════════════════════════════════
// ACTIONS
// ════════════════════════════════════════════════════════════════════════════

// `perimetre` : null = tout voir (dir, voie machine) ; sinon ensemble des
// formation_id autorisees. Un RP ne doit pas decouvrir l'etat de l'autre pole,
// meme en lecture — meme regle que verifierPerimetre() dans api/fr.js.
async function actionEtat(db, annee, perimetre) {
  const groupes = await db.execute({
    sql: `SELECT g.code_cesar, g.libelle, g.groupe_formation, g.formation_id, g.statut,
                 f.titre_court,
                 (SELECT COUNT(*) FROM previsionnel_seance p WHERE p.code_groupe_cesar = g.code_cesar AND p.annee_scolaire = ?) AS prevues,
                 (SELECT COUNT(*) FROM declaration d WHERE d.code_groupe_cesar = g.code_cesar AND d.annee_scolaire = ?) AS realisees
          FROM groupe_planning g
          LEFT JOIN formations f ON f.id = g.formation_id
          WHERE g.annee_scolaire = ?
          ORDER BY f.titre_court, g.libelle`,
    args: [annee, annee, annee],
  });

  const matieres = await db.execute({
    sql: `SELECT COUNT(*) AS total,
                 SUM(CASE WHEN module_ref = '' THEN 1 ELSE 0 END) AS a_arbitrer
          FROM matiere_cesar WHERE annee_scolaire = ?`,
    args: [annee],
  });

  const cr = await db.execute({
    sql: `SELECT COUNT(*) AS total,
                 SUM(CASE WHEN compte_rendu <> '' THEN 1 ELSE 0 END) AS avec_cr,
                 SUM(CASE WHEN statut_cr = 'a_mapper' THEN 1 ELSE 0 END) AS a_mapper,
                 SUM(CASE WHEN previsionnel_id IS NULL THEN 1 ELSE 0 END) AS sans_previsionnel
          FROM declaration WHERE annee_scolaire = ? AND source = 'cesar'`,
    args: [annee],
  });

  return {
    annee_scolaire: annee,
    cle_service_configuree: !!String(process.env.CESAR_SYNC_SECRET || '').trim(),
    groupes_planning: groupes.rows
      // Un groupe non encore rattache reste visible de tous : c'est
      // precisement la liste que quelqu'un doit arbitrer.
      .filter(r => !perimetre || r.formation_id == null || perimetre.has(Number(r.formation_id)))
      .map(r => ({
        code_cesar: String(r.code_cesar),
        libelle: String(r.libelle || ''),
        groupe_formation: String(r.groupe_formation || ''),
        titre: r.titre_court ? String(r.titre_court) : null,
        statut: String(r.statut || ''),
        seances_prevues: Number(r.prevues || 0),
        seances_realisees: Number(r.realisees || 0),
      })),
    matieres: {
      total: Number(matieres.rows[0].total || 0),
      a_arbitrer: Number(matieres.rows[0].a_arbitrer || 0),
    },
    realise: {
      seances_importees: Number(cr.rows[0].total || 0),
      avec_compte_rendu: Number(cr.rows[0].avec_cr || 0),
      comptes_rendus_a_mapper: Number(cr.rows[0].a_mapper || 0),
      sans_previsionnel: Number(cr.rows[0].sans_previsionnel || 0),
    },
  };
}

async function actionListerGroupes(db, annee) {
  const r = await db.execute({
    sql: `SELECT g.*, f.titre_court FROM groupe_planning g
          LEFT JOIN formations f ON f.id = g.formation_id
          WHERE g.annee_scolaire = ? ORDER BY g.groupe_formation, g.libelle`,
    args: [annee],
  });
  return { groupes: r.rows };
}

// Upsert des groupes planning. `titre_court` est optionnel : s'il est fourni et
// qu'il correspond a une formation du pilote, le rattachement est fait tout de
// suite ; sinon le groupe entre en statut 'a_rattacher' et attend un arbitrage.
async function actionUpsertGroupes(db, annee, groupes, ecrire) {
  const formations = await db.execute('SELECT id, titre_court, campus FROM formations');
  const parTitre = {};
  formations.rows.forEach(f => { parTitre[normaliserCle(f.titre_court)] = Number(f.id); });

  const resultat = { crees: 0, mis_a_jour: 0, rattaches: 0, a_rattacher: [], rejets: [] };

  for (const g of tableau(groupes)) {
    const code = String(g.code_cesar || g.code || '').trim();
    if (!code) { resultat.rejets.push({ groupe: g, motif: 'code_cesar manquant' }); continue; }

    const titre = String(g.titre_court || '').trim();
    const fid = titre ? (parTitre[normaliserCle(titre)] || null) : null;
    if (titre && !fid) {
      resultat.rejets.push({ code_cesar: code, motif: `titre_court inconnu : ${titre}` });
    }
    const statut = fid ? 'rattache' : 'a_rattacher';
    if (!fid) resultat.a_rattacher.push({ code_cesar: code, libelle: String(g.libelle || '') });
    else resultat.rattaches++;

    if (!ecrire) { resultat.crees++; continue; }

    const ex = await db.execute({
      sql: 'SELECT id, formation_id FROM groupe_planning WHERE code_cesar = ? AND annee_scolaire = ?',
      args: [code, annee],
    });
    if (ex.rows.length) {
      // Un rattachement deja etabli n'est jamais efface par un reimport qui ne
      // porte pas de titre : on ne perd pas un arbitrage en rechargeant la
      // liste des groupes.
      const ancien = ex.rows[0].formation_id == null ? null : Number(ex.rows[0].formation_id);
      const retenu = fid || ancien;
      await db.execute({
        sql: `UPDATE groupe_planning SET libelle = ?, groupe_formation = ?, campus = ?,
                     effectif = ?, formation_id = ?, statut = ?, updated_at = datetime('now')
              WHERE id = ?`,
        args: [
          String(g.libelle || ''), String(g.groupe_formation || ''),
          String(g.campus || 'Le Mans'),
          Number.isFinite(Number(g.effectif)) ? Number(g.effectif) : null,
          retenu, retenu ? 'rattache' : 'a_rattacher', ex.rows[0].id,
        ],
      });
      resultat.mis_a_jour++;
    } else {
      await db.execute({
        sql: `INSERT INTO groupe_planning (code_cesar, libelle, groupe_formation, formation_id,
                campus, effectif, statut, annee_scolaire)
              VALUES (?,?,?,?,?,?,?,?)`,
        args: [
          code, String(g.libelle || ''), String(g.groupe_formation || ''), fid,
          String(g.campus || 'Le Mans'),
          Number.isFinite(Number(g.effectif)) ? Number(g.effectif) : null,
          statut, annee,
        ],
      });
      resultat.crees++;
    }
  }
  return resultat;
}

async function actionRattacher(db, annee, body) {
  const code = String(body.code_cesar || '').trim();
  if (!code) return { error: 'code_cesar requis.' };

  let fid = Number(body.formation_id) || null;
  if (!fid && body.titre_court) {
    const r = await db.execute({
      sql: 'SELECT id FROM formations WHERE titre_court = ?',
      args: [String(body.titre_court).trim()],
    });
    if (!r.rows.length) return { error: `titre_court inconnu : ${body.titre_court}` };
    fid = Number(r.rows[0].id);
  }
  if (!fid) return { error: 'formation_id ou titre_court requis.' };

  const up = await db.execute({
    sql: `UPDATE groupe_planning SET formation_id = ?, statut = 'rattache', updated_at = datetime('now')
          WHERE code_cesar = ? AND annee_scolaire = ?`,
    args: [fid, code, annee],
  });
  if (!Number(up.rowsAffected || 0)) return { error: `Groupe planning inconnu : ${code}` };

  // Les seances deja importees sous ce groupe heritent du rattachement : sans
  // cela, un groupe rattache apres coup laisserait ses seances orphelines.
  let reaffectees = 0;
  for (const t of ['previsionnel_seance', 'declaration']) {
    const r = await db.execute({
      sql: `UPDATE ${t} SET formation_id = ? WHERE code_groupe_cesar = ? AND annee_scolaire = ?`,
      args: [fid, code, annee],
    });
    reaffectees += Number(r.rowsAffected || 0);
  }
  return { ok: true, code_cesar: code, formation_id: fid, seances_reaffectees: reaffectees };
}

async function actionListerMatieres(db, annee, formationId, seulementAArbitrer) {
  const cond = ['annee_scolaire = ?'];
  const args = [annee];
  if (formationId) { cond.push('formation_id = ?'); args.push(formationId); }
  if (seulementAArbitrer) cond.push("module_ref = ''");
  const r = await db.execute({
    sql: `SELECT id, formation_id, libelle_cesar, module_ref, origine, confiance, occurrences
          FROM matiere_cesar WHERE ${cond.join(' AND ')}
          ORDER BY occurrences DESC, libelle_cesar ASC`,
    args,
  });
  return { matieres: r.rows };
}

// Couverture d'une promotion : l'annonce du plan de formation confrontee au
// realise de l'emargement, module par module.
//
// L'annonce vient de formations.data_json — blocs, modules, volume prevu,
// notions du syllabus. Le realise vient de previsionnel_seance (ce qui est
// programme dans CESAR, y compris a venir) et de declaration (ce qui a eu
// lieu). Le rapprochement se fait sur module_ref, c'est-a-dire l'intitule du
// module du plan, pose par l'arbitrage des matieres.
//
// Un module sans aucune seance programmee n'est pas une anomalie de lecture :
// c'est un module annonce que ce groupe ne suivra jamais. C'est precisement ce
// qu'aucun outil ne savait dire avant.
async function actionCouverture(db, annee, formationId, aujourdhui) {
  if (!formationId) return { error: 'formation_id requis.' };

  const [fRow, prev, decl] = await Promise.all([
    db.execute({ sql: 'SELECT id, titre, titre_court, data_json FROM formations WHERE id = ?', args: [formationId] }),
    db.execute({
      sql: `SELECT module_ref, libelle_cesar, date_prevue, duree_minutes, intervenant_nom, code_groupe_cesar
            FROM previsionnel_seance WHERE formation_id = ? AND annee_scolaire = ?`,
      args: [formationId, annee],
    }),
    db.execute({
      sql: `SELECT module_ref, date_seance, duree_minutes, intervenant_nom, compte_rendu
            FROM declaration WHERE formation_id = ? AND annee_scolaire = ?`,
      args: [formationId, annee],
    }),
  ]);
  if (!fRow.rows.length) return { error: 'formation inconnue.' };

  let data = {};
  try { data = JSON.parse(String(fRow.rows[0].data_json || '{}')); } catch (e) { data = {}; }

  const vide = () => ({ seances: 0, minutes: 0, intervenants: new Set(), dates: [], comptes_rendus: [] });
  const programme = {}, realise = {};
  for (const r of prev.rows) {
    const k = String(r.module_ref || '');
    if (!k) continue;
    const e = (programme[k] = programme[k] || vide());
    e.seances++; e.minutes += Number(r.duree_minutes || 0);
    if (r.intervenant_nom) e.intervenants.add(String(r.intervenant_nom));
    if (r.date_prevue) e.dates.push(String(r.date_prevue).slice(0, 10));
  }
  for (const r of decl.rows) {
    const k = String(r.module_ref || '');
    if (!k) continue;
    const e = (realise[k] = realise[k] || vide());
    e.seances++; e.minutes += Number(r.duree_minutes || 0);
    if (r.intervenant_nom) e.intervenants.add(String(r.intervenant_nom));
    if (r.date_seance) e.dates.push(String(r.date_seance).slice(0, 10));
    const cr = String(r.compte_rendu || '').trim();
    if (cr) e.comptes_rendus.push({ date: String(r.date_seance || '').slice(0, 10), intervenant: String(r.intervenant_nom || ''), texte: cr });
  }

  const h = m => Math.round((m / 60) * 10) / 10;
  const decrire = (titre) => {
    const p = programme[titre], r = realise[titre];
    return {
      programme: !!p,
      seances_programmees: p ? p.seances : 0,
      seances_faites: r ? r.seances : 0,
      heures_programmees: p ? h(p.minutes) : 0,
      heures_faites: r ? h(r.minutes) : 0,
      intervenants: p ? [...p.intervenants].sort() : [],
      premiere: p && p.dates.length ? p.dates.slice().sort()[0] : '',
      derniere: p && p.dates.length ? p.dates.slice().sort().slice(-1)[0] : '',
      comptes_rendus: r ? r.comptes_rendus : [],
    };
  };

  const blocs = (data.blocs || []).map(b => ({
    id: b.id, titre: b.titre, nature: b.nature || 'obligatoire',
    modules: (b.modules || []).map(m => ({
      titre: m.titre, volume_annonce: m.volume == null ? null : m.volume,
      notions: m.notions_cles || [], familles: m.familles || [],
      competences: m.competences_liees || [], ...decrire(m.titre),
    })),
  }));
  const horsBloc = (data.modules_hors_bloc || []).map(m => ({
    titre: m.titre, volume_annonce: m.volume == null ? null : m.volume,
    notions: m.notions_cles || [], familles: m.familles || [],
    competences: m.competences_liees || [], ...decrire(m.titre),
  }));

  // Familles portees par plusieurs intervenants : le niveau 2, enfin
  // calculable, parce que l'emargement nomme qui etait devant les etudiants.
  const parFamille = {};
  for (const m of blocs.flatMap(b => b.modules).concat(horsBloc)) {
    for (const f of m.familles || []) {
      const e = (parFamille[f] = parFamille[f] || { famille: f, intervenants: new Set(), modules: [], dates: [] });
      m.intervenants.forEach(i => e.intervenants.add(i));
      if (m.programme) e.modules.push(m.titre);
      if (m.premiere) e.dates.push(m.premiere);
      if (m.derniere) e.dates.push(m.derniere);
    }
  }
  const croisements = Object.values(parFamille)
    .filter(e => e.intervenants.size > 1 && e.modules.length > 1)
    .map(e => ({ famille: e.famille, intervenants: [...e.intervenants].sort(), modules: e.modules,
                 debut: e.dates.sort()[0] || '', fin: e.dates.slice(-1)[0] || '' }))
    .sort((a, b) => b.intervenants.length - a.intervenants.length);

  const tous = blocs.flatMap(b => b.modules).concat(horsBloc);
  return {
    formation: { id: Number(fRow.rows[0].id), titre: String(fRow.rows[0].titre || ''), titre_court: String(fRow.rows[0].titre_court || '') },
    annee_scolaire: annee, arrete_au: aujourdhui,
    resume: {
      modules_plan: tous.length,
      modules_programmes: tous.filter(m => m.programme).length,
      modules_demarres: tous.filter(m => m.seances_faites > 0).length,
      modules_termines: tous.filter(m => m.seances_faites > 0 && m.seances_faites >= m.seances_programmees).length,
      jamais_programmes: tous.filter(m => !m.programme).length,
      heures_programmees: Math.round(tous.reduce((n, m) => n + m.heures_programmees, 0) * 10) / 10,
      heures_faites: Math.round(tous.reduce((n, m) => n + m.heures_faites, 0) * 10) / 10,
      intervenants: new Set(tous.flatMap(m => m.intervenants)).size,
      comptes_rendus: tous.reduce((n, m) => n + m.comptes_rendus.length, 0),
    },
    blocs, modules_hors_bloc: horsBloc, croisements,
  };
}

// Arbitrage d'un intitule. C'est la seule porte par laquelle une correspondance
// entre un libelle CESAR et un module du plan de formation devient effective.
async function actionArbitrerMatiere(db, annee, body, user) {
  const fid = Number(body.formation_id);
  const libelle = String(body.libelle_cesar || '').trim();
  if (!fid || !libelle) return { error: 'formation_id et libelle_cesar requis.' };

  const cle = normaliserCle(libelle);
  const moduleRef = String(body.module_ref || '').trim();
  const origine = ['import', 'sequencage', 'manuel'].includes(body.origine) ? body.origine : 'manuel';

  const ex = await db.execute({
    sql: 'SELECT id FROM matiere_cesar WHERE formation_id = ? AND cle = ? AND annee_scolaire = ?',
    args: [fid, cle, annee],
  });
  if (ex.rows.length) {
    await db.execute({
      sql: `UPDATE matiere_cesar SET module_ref = ?, origine = ?, confiance = ?,
                   valide_par = ?, valide_at = datetime('now') WHERE id = ?`,
      args: [moduleRef, origine, Number(body.confiance) || 100, user ? user.id : null, ex.rows[0].id],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO matiere_cesar (formation_id, libelle_cesar, cle, module_ref, origine,
              confiance, occurrences, valide_par, valide_at, annee_scolaire)
            VALUES (?,?,?,?,?,?,0,?,datetime('now'),?)`,
      args: [fid, libelle, cle, moduleRef, origine, Number(body.confiance) || 100,
        user ? user.id : null, annee],
    });
  }

  // Les seances deja importees sous cet intitule recoivent le module : un
  // arbitrage tardif ne doit pas obliger a reimporter l'export.
  //
  // Le filtrage se fait en memoire et non en SQL : SQLite ne sait pas
  // normaliser les accents, et un LIKE sur le libelle brut rattraperait des
  // lignes qui ne correspondent pas. On ne touche que les lignes dont la cle
  // normalisee est exactement celle qui vient d'etre arbitree.
  let rattrapees = 0;
  if (moduleRef) {
    const candidates = await db.execute({
      sql: `SELECT id, libelle_cesar FROM declaration
            WHERE formation_id = ? AND annee_scolaire = ? AND module_ref = ''`,
      args: [fid, annee],
    });
    for (const row of candidates.rows) {
      if (normaliserCle(row.libelle_cesar) !== cle) continue;
      await db.execute({ sql: 'UPDATE declaration SET module_ref = ? WHERE id = ?', args: [moduleRef, row.id] });
      rattrapees++;
    }
  }
  return { ok: true, libelle_cesar: libelle, module_ref: moduleRef, seances_rattrapees: rattrapees };
}

// ── Import des seances ──────────────────────────────────────────────────────

async function importerSeances(db, { annee, seances, flux, ecrire, perimetre }) {
  const groupes = await chargerGroupes(db, annee);
  const resolveur = new ResolveurMatieres(db, annee, ecrire);
  const apparieur = new ApparieurPrevisionnel(db, annee);
  const cacheIntervenants = {};

  const bilan = {
    flux,
    annee_scolaire: annee,
    lues: seances.length,
    creees: 0,
    mises_a_jour: 0,
    rejetees: 0,
    sans_previsionnel: 0,
    avec_compte_rendu: 0,
    rejets: [],
    nouveaux_intitules: [],
    groupes_inconnus: [],
  };

  // Numerotation du previsionnel : les seances d'un meme module dans un meme
  // groupe sont numerotees dans l'ordre chronologique du lot. Le previsionnel
  // etant un one-shot annuel, le lot fait foi.
  const compteurs = {};
  const triees = seances
    .map((s, i) => ({ s, i, d: normaliserDate(s.date, s.heure_debut) }))
    .sort((a, b) => (a.d || '').localeCompare(b.d || '') || a.i - b.i);

  for (const item of triees) {
    const s = item.s;
    const ligne = item.i + 1;

    const codeGroupe = String(s.code_groupe_cesar || s.groupe_planning || '').trim();
    if (!codeGroupe) {
      bilan.rejets.push({ ligne, motif: 'code_groupe_cesar manquant' });
      bilan.rejetees++; continue;
    }
    const groupe = groupes[codeGroupe];
    if (!groupe) {
      if (!bilan.groupes_inconnus.includes(codeGroupe)) bilan.groupes_inconnus.push(codeGroupe);
      bilan.rejets.push({ ligne, motif: `groupe planning inconnu : ${codeGroupe}` });
      bilan.rejetees++; continue;
    }
    if (!groupe.formation_id) {
      bilan.rejets.push({ ligne, motif: `groupe planning non rattache a un titre : ${codeGroupe}` });
      bilan.rejetees++; continue;
    }
    if (perimetre && !perimetre.has(groupe.formation_id)) {
      bilan.rejets.push({ ligne, motif: `hors de votre perimetre : ${codeGroupe}` });
      bilan.rejetees++; continue;
    }

    const dateISO = item.d;
    if (!dateISO) {
      bilan.rejets.push({ ligne, motif: `date illisible : ${s.date}` });
      bilan.rejetees++; continue;
    }

    const formationId = groupe.formation_id;
    const libelleMatiere = String(s.matiere || s.libelle || '').trim();
    const r = await resolveur.resoudre(formationId, libelleMatiere);
    const moduleRef = r.module_ref;

    const ref = String(s.ref_cesar || '').trim() || refAuto(codeGroupe, dateISO, libelleMatiere);
    const nom = String(s.intervenant_nom || '').trim();
    const intervenantId = await trouverIntervenant(db, s.intervenant_email, cacheIntervenants);
    const duree = calculerDuree(s);

    if (flux === 'previsionnel') {
      const cle = `${codeGroupe}|${moduleRef || normaliserCle(libelleMatiere)}`;
      compteurs[cle] = (compteurs[cle] || 0) + 1;
      const numero = Number.isInteger(s.numero) ? s.numero : compteurs[cle];

      if (!ecrire) { bilan.creees++; continue; }

      const ex = await db.execute({ sql: 'SELECT id FROM previsionnel_seance WHERE ref_cesar = ?', args: [ref] });
      const args = [
        formationId, moduleRef, groupe.campus, intervenantId, nom || '—', numero,
        String(s.titre || libelleMatiere || `Séance ${numero}`), dateISO,
        s.modalite === 'D' ? 'D' : 'P', String(s.contenu || ''),
        JSON.stringify(tableau(s.concepts)), JSON.stringify(tableau(s.competences)),
        duree, codeGroupe, libelleMatiere, ref, annee,
      ];
      if (ex.rows.length) {
        await db.execute({
          sql: `UPDATE previsionnel_seance SET formation_id=?, module_ref=?, campus=?,
                  intervenant_id=?, intervenant_nom=?, numero=?, titre=?, date_prevue=?,
                  modalite=?, contenu=?, concepts=?, competences=?, duree_minutes=?,
                  code_groupe_cesar=?, libelle_cesar=?, ref_cesar=?, annee_scolaire=?,
                  updated_at=datetime('now')
                WHERE id=?`,
          args: args.concat([ex.rows[0].id]),
        });
        bilan.mises_a_jour++;
      } else {
        await db.execute({
          sql: `INSERT INTO previsionnel_seance (formation_id, module_ref, campus, intervenant_id,
                  intervenant_nom, numero, titre, date_prevue, modalite, contenu, concepts,
                  competences, duree_minutes, code_groupe_cesar, libelle_cesar, ref_cesar,
                  annee_scolaire)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args,
        });
        bilan.creees++;
      }
      continue;
    }

    // ── flux realise ────────────────────────────────────────────────────────
    const compteRendu = String(s.compte_rendu || '').trim();
    if (compteRendu) bilan.avec_compte_rendu++;
    // Le compte rendu arrive en prose libre. Il est stocke tel quel et attend
    // son rattachement aux competences : competences reste vide a l'import.
    const statutCR = compteRendu ? 'a_mapper' : 'sans_cr';

    // L'existant est lu AVANT l'appariement : un rejeu doit conserver le
    // rattachement deja etabli, pas en chercher un nouveau.
    const ex = await db.execute({
      sql: 'SELECT id, previsionnel_id FROM declaration WHERE ref_cesar = ?',
      args: [ref],
    });
    const reserve = ex.rows.length && ex.rows[0].previsionnel_id != null
      ? Number(ex.rows[0].previsionnel_id) : null;

    const prevId = await apparieur.apparier({
      codeGroupe, moduleRef, cleMatiere: normaliserCle(libelleMatiere), dateISO, reserve,
    });
    if (!prevId) bilan.sans_previsionnel++;

    if (!ecrire) { bilan.creees++; continue; }

    const args = [
      formationId, moduleRef, prevId, groupe.campus, intervenantId, nom,
      Number.isInteger(s.numero) ? s.numero : null, dateISO, 'cesar',
      JSON.stringify(tableau(s.couvert)), JSON.stringify([]),
      compteRendu, statutCR, duree, codeGroupe, libelleMatiere, ref, annee,
    ];
    if (ex.rows.length) {
      await db.execute({
        sql: `UPDATE declaration SET formation_id=?, module_ref=?, previsionnel_id=?, campus=?,
                intervenant_id=?, intervenant_nom=?, seance_numero=?, date_seance=?, source=?,
                couvert=?, competences=?, compte_rendu=?, statut_cr=?, duree_minutes=?,
                code_groupe_cesar=?, libelle_cesar=?, ref_cesar=?, annee_scolaire=?
              WHERE id=?`,
        args: args.concat([ex.rows[0].id]),
      });
      bilan.mises_a_jour++;
    } else {
      await db.execute({
        sql: `INSERT INTO declaration (formation_id, module_ref, previsionnel_id, campus,
                intervenant_id, intervenant_nom, seance_numero, date_seance, source, couvert,
                competences, compte_rendu, statut_cr, duree_minutes, code_groupe_cesar,
                libelle_cesar, ref_cesar, annee_scolaire)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args,
      });
      bilan.creees++;
    }
  }

  bilan.nouveaux_intitules = resolveur.listeNouveaux();
  // Les rejets sont tronques : 50 suffisent a comprendre un probleme
  // systematique, et une reponse de 3000 lignes serait illisible.
  if (bilan.rejets.length > 50) {
    bilan.rejets_total = bilan.rejets.length;
    bilan.rejets = bilan.rejets.slice(0, 50);
  }
  return bilan;
}

// ════════════════════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════════════════════

module.exports = async function handler(req, res) {
  const action = String((req.query && req.query.action) || '');
  const annee = String((req.query && req.query.annee_scolaire) || ANNEE_DEFAUT);
  // ?dry=1 : tout est calcule, rien n'est ecrit.
  const simulation = !!(req.query && (req.query.dry === '1' || req.query.dry === 'true'));

  // ── Authentification : voie machine OU compte dir/rp ──────────────────────
  const machine = cleService(req);
  let user = null;
  if (!machine) {
    user = await requireRole(req, ['dir', 'rp']);
    if (!user) {
      return res.status(401).json({
        error: 'Accès réservé. Compte direction ou responsable pédagogique, ou clé de service CESAR.',
      });
    }
  }

  try {
    const db = getDB();
    const perimetre = await perimetreIds(db, user);

    // ── Lectures ────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      if (action === 'etat' || action === '') {
        return res.status(200).json(await actionEtat(db, annee, perimetre));
      }
      if (action === 'groupes') {
        return res.status(200).json(await actionListerGroupes(db, annee));
      }
      if (action === 'couverture') {
        const out = await actionCouverture(db, annee, Number(req.query.formation_id), new Date().toISOString().slice(0, 10));
        return res.status(out.error ? 400 : 200).json(out);
      }

      if (action === 'matieres') {
        const fid = Number(req.query.formation_id) || null;
        const seulement = req.query.a_arbitrer === '1' || req.query.a_arbitrer === 'true';
        return res.status(200).json(await actionListerMatieres(db, annee, fid, seulement));
      }
      return res.status(400).json({ error: 'Action de lecture inconnue : ' + action });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Méthode non supportée.' });
    }

    const body = req.body || {};

    // ── Ecritures de referentiel ────────────────────────────────────────────
    if (action === 'groupes') {
      const out = await actionUpsertGroupes(db, annee, body.groupes, !simulation);
      return res.status(200).json({ ok: true, simulation, ...out });
    }

    if (action === 'rattacher') {
      const out = await actionRattacher(db, annee, body);
      return res.status(out.error ? 400 : 200).json(out);
    }

    if (action === 'matiere') {
      const out = await actionArbitrerMatiere(db, annee, body, user);
      return res.status(out.error ? 400 : 200).json(out);
    }

    // ── Import de seances ───────────────────────────────────────────────────
    if (action === 'previsionnel' || action === 'realise') {
      const seances = tableau(body.seances);
      if (!seances.length) {
        return res.status(400).json({ error: 'Aucune séance dans la charge utile (champ "seances").' });
      }
      if (seances.length > MAX_SEANCES) {
        return res.status(413).json({
          error: `${seances.length} séances reçues, maximum ${MAX_SEANCES} par appel.`,
          conseil: 'Découper l\'export par titre ou par période.',
        });
      }
      const bilan = await importerSeances(db, {
        annee, seances, flux: action, ecrire: !simulation, perimetre,
      });
      return res.status(200).json({ ok: true, simulation, bilan });
    }

    return res.status(400).json({ error: 'Action inconnue : ' + action });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
