// ============================================================
// api/inscription.js — Rattachements personne ↔ titre, et groupes d'options
// ------------------------------------------------------------
// Lecture
//   GET  ?formation_id=[&role=][&annee_scolaire=]
//        -> personnes inscrites à un titre, avec leur groupe
//   GET  ?user_id=
//        -> titres auxquels une personne est rattachée
//   GET  ?action=groupes&formation_id=
//        -> groupes du titre, leurs effectifs, les blocs d'option sans groupe,
//           et la liste des étudiants avec leur affectation
//
// Écriture (dir et rp ; un rp est borné à son campus)
//   POST   ?action=sync-groupes  { formation_id }
//   POST   ?action=groupe        { formation_id, nom, bloc_id, option_groupe }
//   PATCH  ?action=groupe        { id, nom }
//   DELETE ?action=groupe&id=
//   POST   ?action=affecter      { inscription_id, groupe_id|null }
//
// Tout passe par ce fichier plutôt que par un endpoint dédié : le plan Vercel
// Hobby plafonne à 12 fonctions et il n'en reste qu'une de libre.
//
// Style aligné repo : CommonJS, getDB(), requireAuth().
// ============================================================

const { getDB } = require('./_lib/db');
const { requireAuth } = require('./_lib/auth');

const ANNEE_DEFAUT = '2026-27';

// Un rp n'agit que sur son campus ; un dir n'est pas borné.
function campusAutorise(user, campus) {
  if (user.role === 'dir') return true;
  if (user.role === 'rp') return String(campus || '') === String(user.campus || '');
  return false;
}

async function chargerFormation(db, id) {
  const r = await db.execute({
    sql: 'SELECT id, campus, titre, titre_court, data_json FROM formations WHERE id = ?',
    args: [id],
  });
  return r.rows.length ? r.rows[0] : null;
}

// Blocs d'option déclarés au référentiel de la formation.
function blocsOption(row) {
  let data = {};
  try { data = JSON.parse(row.data_json || '{}'); } catch (_) { return []; }
  return (data.blocs || [])
    .filter(b => b && b.nature === 'option')
    .map(b => ({
      bloc_id: String(b.id || ''),
      titre: String(b.titre || ''),
      option_groupe: String(b.option_groupe || ''),
      modules: (b.modules || []).length,
    }));
}

module.exports = async function handler(req, res) {
  const user = await requireAuth(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié.' });

  const action = String(req.query.action || '');
  const annee = req.query.annee_scolaire || (req.body && req.body.annee_scolaire) || ANNEE_DEFAUT;

  try {
    const db = getDB();

    // ─── Groupes d'un titre ─────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'groupes') {
      const { formation_id } = req.query;
      if (!formation_id) return res.status(400).json({ error: 'formation_id requis.' });

      const f = await chargerFormation(db, formation_id);
      if (!f) return res.status(404).json({ error: 'Formation introuvable.' });
      if (!campusAutorise(user, f.campus)) {
        return res.status(403).json({ error: 'Formation hors de votre campus.' });
      }

      const g = await db.execute({
        sql: `SELECT g.id, g.nom, g.bloc_id, g.option_groupe,
                     (SELECT COUNT(*) FROM inscription i
                       WHERE i.groupe_id = g.id AND i.role = 'etudiant') AS effectif
              FROM groupe g
              WHERE g.formation_id = ? AND g.annee_scolaire = ?
              ORDER BY g.option_groupe, g.nom`,
        args: [formation_id, annee],
      });
      const groupes = (g.rows || []).map(r => ({
        id: Number(r.id), nom: String(r.nom), bloc_id: String(r.bloc_id || ''),
        option_groupe: String(r.option_groupe || ''), effectif: Number(r.effectif || 0),
      }));

      // Options du référentiel encore dépourvues de groupe : c'est ce que la
      // synchronisation créera, autant le montrer avant de la déclencher.
      const options = blocsOption(f);
      const couverts = new Set(groupes.map(x => x.bloc_id).filter(Boolean));
      const sansGroupe = options.filter(o => !couverts.has(o.bloc_id));

      const e = await db.execute({
        sql: `SELECT i.id AS inscription_id, i.user_id, i.groupe_id, u.nom, u.prenom, u.email
              FROM inscription i JOIN users u ON u.id = i.user_id
              WHERE i.formation_id = ? AND i.annee_scolaire = ? AND i.role = 'etudiant'
              ORDER BY u.nom, u.prenom`,
        args: [formation_id, annee],
      });

      return res.status(200).json({
        groupes,
        options,
        options_sans_groupe: sansGroupe,
        etudiants: (e.rows || []).map(r => ({
          inscription_id: Number(r.inscription_id),
          user_id: Number(r.user_id),
          groupe_id: r.groupe_id == null ? null : Number(r.groupe_id),
          nom: String(r.nom || ''), prenom: String(r.prenom || ''), email: String(r.email || ''),
        })),
      });
    }

    // ─── Écritures ──────────────────────────────────────────────────────────
    if (req.method !== 'GET') {
      if (!['dir', 'rp'].includes(user.role)) {
        return res.status(403).json({ error: 'Accès réservé à la direction et aux RP.' });
      }
      const body = req.body || {};

      // Crée un groupe par bloc d'option qui n'en a pas encore. Idempotent :
      // relancer la synchronisation n'ajoute rien si tout est déjà en place.
      if (req.method === 'POST' && action === 'sync-groupes') {
        const f = await chargerFormation(db, body.formation_id);
        if (!f) return res.status(404).json({ error: 'Formation introuvable.' });
        if (!campusAutorise(user, f.campus)) return res.status(403).json({ error: 'Formation hors de votre campus.' });

        const existants = await db.execute({
          sql: 'SELECT bloc_id FROM groupe WHERE formation_id = ? AND annee_scolaire = ?',
          args: [f.id, annee],
        });
        const deja = new Set((existants.rows || []).map(r => String(r.bloc_id || '')));

        let crees = 0;
        for (const o of blocsOption(f)) {
          if (deja.has(o.bloc_id)) continue;
          await db.execute({
            sql: `INSERT OR IGNORE INTO groupe (formation_id, bloc_id, option_groupe, nom, campus, annee_scolaire, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            args: [f.id, o.bloc_id, o.option_groupe, o.titre || o.bloc_id, f.campus || '', annee],
          });
          crees++;
        }
        return res.status(200).json({ ok: true, groupes_crees: crees });
      }

      // Groupe supplémentaire pour une même option : effectif trop nombreux,
      // dédoublement en deux sessions, etc.
      if (req.method === 'POST' && action === 'groupe') {
        const f = await chargerFormation(db, body.formation_id);
        if (!f) return res.status(404).json({ error: 'Formation introuvable.' });
        if (!campusAutorise(user, f.campus)) return res.status(403).json({ error: 'Formation hors de votre campus.' });
        const nom = String(body.nom || '').trim();
        if (!nom) return res.status(400).json({ error: 'Nom de groupe requis.' });

        try {
          const r = await db.execute({
            sql: `INSERT INTO groupe (formation_id, bloc_id, option_groupe, nom, campus, annee_scolaire, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            args: [f.id, String(body.bloc_id || ''), String(body.option_groupe || ''), nom, f.campus || '', annee],
          });
          return res.status(201).json({ ok: true, id: Number(r.lastInsertRowid) });
        } catch (_) {
          return res.status(409).json({ error: 'Un groupe porte déjà ce nom pour ce titre.' });
        }
      }

      // Renommage. Les rattachements se font par identifiant : ils survivent.
      if (req.method === 'PATCH' && action === 'groupe') {
        const nom = String(body.nom || '').trim();
        if (!body.id || !nom) return res.status(400).json({ error: 'id et nom requis.' });
        const g = await db.execute({ sql: 'SELECT campus FROM groupe WHERE id = ?', args: [body.id] });
        if (!g.rows.length) return res.status(404).json({ error: 'Groupe introuvable.' });
        if (!campusAutorise(user, g.rows[0].campus)) return res.status(403).json({ error: 'Groupe hors de votre campus.' });
        await db.execute({ sql: 'UPDATE groupe SET nom = ? WHERE id = ?', args: [nom, body.id] });
        return res.status(200).json({ ok: true });
      }

      // Suppression : les étudiants sont détachés, jamais supprimés.
      if (req.method === 'DELETE' && action === 'groupe') {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: 'id requis.' });
        const g = await db.execute({ sql: 'SELECT campus FROM groupe WHERE id = ?', args: [id] });
        if (!g.rows.length) return res.status(404).json({ error: 'Groupe introuvable.' });
        if (!campusAutorise(user, g.rows[0].campus)) return res.status(403).json({ error: 'Groupe hors de votre campus.' });
        const d = await db.execute({ sql: 'UPDATE inscription SET groupe_id = NULL WHERE groupe_id = ?', args: [id] });
        await db.execute({ sql: 'DELETE FROM groupe WHERE id = ?', args: [id] });
        return res.status(200).json({ ok: true, etudiants_detaches: Number(d.rowsAffected || 0) });
      }

      // Affectation d'un étudiant. groupe_id null = retrait du groupe.
      if (req.method === 'POST' && action === 'affecter') {
        const { inscription_id, groupe_id } = body;
        if (!inscription_id) return res.status(400).json({ error: 'inscription_id requis.' });

        const i = await db.execute({
          sql: 'SELECT campus, formation_id FROM inscription WHERE id = ?',
          args: [inscription_id],
        });
        if (!i.rows.length) return res.status(404).json({ error: 'Inscription introuvable.' });
        if (!campusAutorise(user, i.rows[0].campus)) return res.status(403).json({ error: 'Inscription hors de votre campus.' });

        if (groupe_id) {
          // Un groupe d'un autre titre n'a aucun sens ici : le vérifier évite
          // des affectations silencieusement incohérentes.
          const g = await db.execute({ sql: 'SELECT formation_id FROM groupe WHERE id = ?', args: [groupe_id] });
          if (!g.rows.length) return res.status(404).json({ error: 'Groupe introuvable.' });
          if (Number(g.rows[0].formation_id) !== Number(i.rows[0].formation_id)) {
            return res.status(400).json({ error: 'Ce groupe appartient à un autre titre.' });
          }
        }

        await db.execute({
          sql: 'UPDATE inscription SET groupe_id = ? WHERE id = ?',
          args: [groupe_id || null, inscription_id],
        });
        return res.status(200).json({ ok: true });
      }

      res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
      return res.status(400).json({ error: 'Action non reconnue.' });
    }

    // ─── Lectures historiques ───────────────────────────────────────────────
    const { formation_id, user_id, role } = req.query;

    if (user_id) {
      const r = await db.execute({
        sql: `SELECT id, formation_id, campus, role, promo, groupe, groupe_id, annee_scolaire, created_at
              FROM inscription WHERE user_id = ? ORDER BY created_at DESC`,
        args: [user_id],
      });
      return res.status(200).json({ inscriptions: r.rows || [] });
    }

    if (formation_id) {
      const conditions = ['i.formation_id = ?', 'i.annee_scolaire = ?'];
      const args = [formation_id, annee];
      if (user.role === 'rp') { conditions.push('i.campus = ?'); args.push(user.campus || ''); }
      if (role) { conditions.push('i.role = ?'); args.push(role); }

      const r = await db.execute({
        sql: `SELECT i.id, i.user_id, i.formation_id, i.campus, i.role, i.promo, i.groupe, i.groupe_id,
                     g.nom AS groupe_nom, g.bloc_id AS groupe_bloc_id,
                     u.nom, u.prenom, u.email
              FROM inscription i
              JOIN users u ON u.id = i.user_id
              LEFT JOIN groupe g ON g.id = i.groupe_id
              WHERE ${conditions.join(' AND ')}
              ORDER BY i.role, u.nom`,
        args,
      });
      return res.status(200).json({ inscriptions: r.rows || [] });
    }

    return res.status(400).json({ error: 'formation_id, user_id ou action requis.' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
