const { getDB } = require('./_lib/db');
const { requireAuth, requireRole } = require('./_lib/auth');

// Normaliser campus : string ou JSON array -> string normalisée pour filtre
function normCampus(c) { return (c || '').toLowerCase().trim(); }
function campusMatch(stored, userCampus) {
  if (!userCampus) return true;
  const norm = normCampus(userCampus);
  if (!stored) return false;
  try {
    const arr = JSON.parse(stored);
    if (Array.isArray(arr)) return arr.some(x => normCampus(x) === norm);
  } catch (_) {}
  return stored.split(',').map(normCampus).includes(norm);
}

function parseDataJson(raw) {
  let data = {};
  try { data = JSON.parse(raw || '{}'); } catch (_) {}
  if (!data.formation) data.formation = { titre: 'Formation importée', annee: '' };
  if (!data.blocs) data.blocs = [];
  if (!data.alertes_detectees) data.alertes_detectees = [];
  if (!data.intervenants) data.intervenants = [];
  return data;
}

module.exports = async function handler(req, res) {
  try {
    const db = getDB();

    // ─── GET : liste des formations ────────────────────────────────────────────
    if (req.method === 'GET') {
      const user = await requireAuth(req);
      if (!user) return res.status(401).json({ error: 'Non authentifié.' });

      const result = await db.execute(
        'SELECT id, campus, titre, rncp, niveau, titre_court, certificateur, data_json, created_at FROM formations ORDER BY niveau ASC, titre ASC'
      );
      const rows = result.rows || [];

      let formations = rows.map(r => {
        const data = parseDataJson(r.data_json);
        return {
          _id: r.id,
          _campus: r.campus || '',
          _rncp: r.rncp || '',
          _niveau: r.niveau || '',
          _titre_court: r.titre_court || '',
          _certificateur: r.certificateur || '',
          ...data,
        };
      });

      if (user.role === 'dir') {
        // Direction voit tout
      } else if (user.role === 'rp') {
        // Priorité : périmètre par inscription (multi-RP même campus)
        const insc = await db.execute({
          sql: "SELECT formation_id FROM inscription WHERE user_id = ? AND role = 'rp'",
          args: [user.id],
        });
        if (insc.rows && insc.rows.length > 0) {
          const ids = new Set(insc.rows.map(r => Number(r.formation_id)));
          formations = formations.filter(f => ids.has(f._id));
        } else {
          // Fallback ancien système : filtre par campus string
          formations = formations.filter(f => campusMatch(f._campus, user.campus));
        }
      } else if (user.role === 'fr') {
        // FR : uniquement le(s) titre(s) dont il est titulaire (table inscription)
        const insc = await db.execute({
          sql: "SELECT formation_id FROM inscription WHERE user_id = ? AND role = 'fr'",
          args: [user.id],
        });
        const ids = new Set((insc.rows || []).map(r => Number(r.formation_id)));
        formations = formations.filter(f => ids.has(f._id));
      } else {
        // Intervenant, étudiant : formations de son campus uniquement
        formations = formations.filter(f => campusMatch(f._campus, user.campus));
      }

      return res.status(200).json({ formations });
    }

    // ─── POST : alimenter une ou plusieurs promotions ──────────────────────────
    // Trois usages, dans l'ordre du parcours pedagogique arrete le 03/09/2026 :
    //
    //   1. VENTILATION (couche 'pf', plusieurs cibles)
    //      Un plan de formation couvre les deux annees d'un Mastere. Une seule
    //      ingestion alimente donc M1 et M2 : les modules sont repartis selon
    //      leur annee_cycle. Les modules sans annee ne sont affectes nulle part
    //      et sont remontes a l'appelant — invisibles vaut mieux que mal ranges.
    //
    //   2. ALIMENTATION (couche 'pf', cible unique)
    //      Cas du Bachelor, mono-annee. Remplace la structure de la promotion.
    //
    //   3. ENRICHISSEMENT (couche 'syllabus' ou 'race', cible unique)
    //      N'ecrase jamais la structure issue du PF. Rapproche chaque module
    //      entrant d'un module existant par son titre, et complete ce dernier :
    //      competences rattachees, notions, seances. Sans ce garde-fou, deposer
    //      un syllabus apres un PF effacait le PF.
    //
    // Sans cible, on retombe sur la creation d'une formation autonome (heritage).
    if (req.method === 'POST') {
      const user = await requireRole(req, ['dir', 'rp']);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });

      const { campus, data, rncp, niveau, titre_court, certificateur, cible_id, cibles, couche } = req.body || {};
      if (!data) return res.status(400).json({ error: 'data requis.' });

      const COUCHES = ['pf', 'syllabus', 'race'];
      const layer = COUCHES.includes(String(couche || '').toLowerCase())
        ? String(couche).toLowerCase()
        : 'pf';

      const norm = t => String(t || '').toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
      const uniq = arr => Array.from(new Set((arr || []).filter(Boolean)));

      async function chargerCible(id) {
        const r = await db.execute({
          sql: 'SELECT id, campus, titre, rncp, niveau, titre_court, certificateur, data_json FROM formations WHERE id = ?',
          args: [id],
        });
        if (!r.rows.length) return null;
        const row = r.rows[0];
        if (user.role === 'rp' && String(row.campus || '') !== String(user.campus || '')) return 'interdit';
        return row;
      }

      // Liste normalisee des cibles : [{ id, cycle }]
      let listeCibles = [];
      if (Array.isArray(cibles) && cibles.length) {
        listeCibles = cibles
          .filter(c => c && c.id)
          .map(c => ({ id: c.id, cycle: String(c.cycle || '').toUpperCase() }));
      } else if (cible_id) {
        listeCibles = [{ id: cible_id, cycle: '' }];
      }

      if (listeCibles.length) {
        // ── Modules entrants, a plat ──────────────────────────────────────────
        const blocsEntrants = Array.isArray(data.blocs) ? data.blocs : [];
        const modulesEntrants = [];
        for (const b of blocsEntrants) {
          for (const m of (b.modules || [])) {
            modulesEntrants.push({ ...m, _bloc_id: b.id, _bloc_titre: b.titre });
          }
        }

        const rapport = { couche: layer, cibles: [], non_ventiles: [], non_rapproches: [] };

        for (const cible of listeCibles) {
          const row = await chargerCible(cible.id);
          if (row === 'interdit') return res.status(403).json({ error: 'Promotion hors de votre campus.' });
          if (!row) return res.status(404).json({ error: 'Promotion cible introuvable (id ' + cible.id + ').' });

          const titreCourt = String(row.titre_court || '');
          const cycle = cible.cycle || titreCourt.split(' ')[0];

          let existant = {};
          try { existant = JSON.parse(row.data_json || '{}'); } catch (_) { existant = {}; }

          // ── Selection des modules revenant a cette promotion ────────────────
          // Cible unique : tout lui revient, l'annee_cycle n'a rien a departager.
          // Cibles multiples : chacune ne recoit que son annee.
          const monoCible = listeCibles.length === 1;
          const mods = monoCible
            ? modulesEntrants
            : modulesEntrants.filter(m => String(m.annee_cycle || '').toUpperCase() === cycle);

          let sortie;

          if (layer === 'pf') {
            // ── Remplacement de la structure ──────────────────────────────────
            const parBloc = new Map();
            for (const m of mods) {
              const k = m._bloc_id || 'B0';
              if (!parBloc.has(k)) {
                parBloc.set(k, {
                  id: k,
                  titre: m._bloc_titre || 'Modules non rattachés',
                  competences: (blocsEntrants.find(b => b.id === k) || {}).competences || [],
                  modules: [],
                });
              }
              const copie = { ...m };
              delete copie._bloc_id; delete copie._bloc_titre;
              copie.annee_cycle = cycle;
              parBloc.get(k).modules.push(copie);
            }
            sortie = {
              ...existant,
              formation: {
                ...(existant.formation || {}),
                titre: String(row.titre || ''),
                rncp: String(row.rncp || ''),
                etablissement: String(row.certificateur || ''),
                annees_couvertes: [cycle],
              },
              blocs: Array.from(parBloc.values()),
              intervenants: uniq(mods.map(m => m.intervenant)),
              notions_transversales: existant.notions_transversales || [],
              alertes_detectees: [],
            };
          } else {
            // ── Enrichissement : le PF reste la structure de reference ─────────
            const blocsExistants = JSON.parse(JSON.stringify(existant.blocs || []));
            const index = new Map();
            blocsExistants.forEach((b, bi) => (b.modules || []).forEach((m, mi) => {
              const k = norm(m.titre);
              if (k) index.set(k, { bi, mi });
            }));

            let rapproches = 0;
            const orphelins = [];

            for (const m of mods) {
              const pos = index.get(norm(m.titre));
              if (pos) {
                const cible2 = blocsExistants[pos.bi].modules[pos.mi];
                cible2.competences_liees = uniq([...(cible2.competences_liees || []), ...(m.competences_liees || [])]);
                cible2.notions_cles = uniq([...(cible2.notions_cles || []), ...(m.notions_cles || [])]);
                if (Array.isArray(m.seances) && m.seances.length) cible2.seances = m.seances;
                if (!cible2.intervenant && m.intervenant) cible2.intervenant = m.intervenant;
                cible2._enrichi_par = layer;
                rapproches++;
              } else {
                orphelins.push(m);
              }
            }

            // Blocs de competences apportes par le document (RACE surtout) :
            // ajoutes s'ils n'existent pas, jamais substitues aux blocs du PF.
            for (const b of blocsEntrants) {
              if (!(b.competences || []).length) continue;
              const dejaLa = blocsExistants.find(x => String(x.id) === String(b.id));
              if (dejaLa) {
                dejaLa.competences = (b.competences || []).length ? b.competences : dejaLa.competences;
                if (!dejaLa.titre || dejaLa.titre === 'Modules non rattachés') dejaLa.titre = b.titre || dejaLa.titre;
              } else {
                blocsExistants.push({ id: b.id, titre: b.titre, competences: b.competences || [], modules: [] });
              }
            }

            // Modules non rapproches : conserves a part, jamais fondus dans le
            // PF. Un titre qui ne correspond a rien signale soit un module
            // absent du plan, soit un libelle divergent — c'est a arbitrer.
            if (orphelins.length) {
              let bacAttente = blocsExistants.find(b => b.id === 'B-ATT');
              if (!bacAttente) {
                bacAttente = { id: 'B-ATT', titre: 'Modules du syllabus absents du plan de formation', competences: [], modules: [] };
                blocsExistants.push(bacAttente);
              }
              for (const m of orphelins) {
                const copie = { ...m };
                delete copie._bloc_id; delete copie._bloc_titre;
                copie._origine = layer;
                bacAttente.modules.push(copie);
              }
            }

            sortie = {
              ...existant,
              blocs: blocsExistants,
              intervenants: uniq([...(existant.intervenants || []), ...mods.map(m => m.intervenant)]),
              notions_transversales: uniq([...(existant.notions_transversales || []), ...(data.notions_transversales || [])]),
              alertes_detectees: Array.isArray(data.alertes_detectees) ? data.alertes_detectees : (existant.alertes_detectees || []),
            };

            rapport.non_rapproches.push(...orphelins.map(m => ({ promotion: titreCourt, module: m.titre })));
            rapport.cibles.push({ promotion: titreCourt, id: Number(row.id), modules_rapproches: rapproches, modules_non_rapproches: orphelins.length });
          }

          sortie._campus = String(row.campus || '');
          sortie._cycle = cycle;
          sortie._couches = { ...(existant._couches || {}), [layer]: new Date().toISOString() };
          delete sortie._vide;

          await db.execute({
            sql: 'UPDATE formations SET data_json = ? WHERE id = ?',
            args: [JSON.stringify(sortie), row.id],
          });

          if (layer === 'pf') {
            rapport.cibles.push({
              promotion: titreCourt,
              id: Number(row.id),
              modules: mods.length,
              blocs: (sortie.blocs || []).length,
            });
          }
        }

        // Modules qu'aucune cible n'a pu accueillir, faute d'annee de cycle.
        if (listeCibles.length > 1 && layer === 'pf') {
          const cyclesCibles = listeCibles.map(c => c.cycle).filter(Boolean);
          rapport.non_ventiles = modulesEntrants
            .filter(m => !cyclesCibles.includes(String(m.annee_cycle || '').toUpperCase()))
            .map(m => m.titre);
        }

        return res.status(200).json({ ok: true, mode: layer === 'pf' ? 'ventilation' : 'enrichissement', rapport });
      }

      // ─── Création d'une formation autonome (héritage) ───────────────────────
      const campusStr = Array.isArray(campus) ? JSON.stringify(campus) : (campus || '');
      data._campus = campusStr;
      const rncpVal      = rncp          || (data.formation && data.formation.rncp)         || '';
      const niveauVal    = niveau        || '';
      const titreCourtVal= titre_court   || '';
      const certifVal    = certificateur || (data.formation && data.formation.etablissement) || '';
      const titreVal     = (data.formation && data.formation.titre) || '';

      await db.execute({
        sql: 'INSERT INTO formations (campus, titre, rncp, niveau, titre_court, certificateur, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))',
        args: [campusStr, titreVal, rncpVal, niveauVal, titreCourtVal, certifVal, JSON.stringify(data)],
      });

      return res.status(201).json({ ok: true, mode: 'creation' });
    }

    // ─── DELETE : supprimer une formation ─────────────────────────────────────
    if (req.method === 'DELETE') {
      const user = await requireRole(req, ['dir']);
      if (!user) return res.status(403).json({ error: 'Réservé à la Direction.' });

      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id requis.' });

      await db.execute({ sql: 'DELETE FROM formations WHERE id = ?', args: [id] });
      // Nettoyer les inscriptions orphelines
      await db.execute({ sql: 'DELETE FROM inscription WHERE formation_id = ?', args: [id] });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Méthode non supportée.' });

  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
};
