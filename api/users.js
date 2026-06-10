const { getDB } = require('./_lib/db');
const { requireAuth, requireRole, hashPassword } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  try {
    const db = getDB();

    // ─── GET : liste des comptes ───────────────────────────────────────────────
    if (req.method === 'GET') {
      const user = await requireRole(req, ['dir', 'rp']);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });

      let result;
      if (user.role === 'dir') {
        // Dir voit tous les comptes sauf les sessions
        result = await db.execute('SELECT id, role, nom, prenom, email, campus FROM users ORDER BY role, nom');
      } else {
        // RP voit uniquement les intervenants et étudiants de son campus
        result = await db.execute({
          sql: "SELECT id, role, nom, prenom, email, campus FROM users WHERE role IN ('intervenant','etudiant') AND campus = ? ORDER BY role, nom",
          args: [user.campus || ''],
        });
      }

      return res.status(200).json({ users: result.rows || [] });
    }

    // ─── POST : créer un compte ────────────────────────────────────────────────
    if (req.method === 'POST') {
      const user = await requireAuth(req);
      if (!user) return res.status(401).json({ error: 'Non authentifié.' });

      const { role, nom, prenom, email, password, campus } = req.body || {};

      // Règle de création selon rôle appelant :
      // - dir peut créer : rp, intervenant, etudiant, dir
      // - rp peut créer : intervenant, etudiant (uniquement)
      const rolesAllowed = user.role === 'dir'
        ? ['rp', 'intervenant', 'etudiant', 'dir']
        : user.role === 'rp'
          ? ['intervenant', 'etudiant']
          : null;

      if (!rolesAllowed) return res.status(403).json({ error: 'Accès refusé.' });
      if (!rolesAllowed.includes(role)) {
        return res.status(403).json({ error: `Un ${user.role} ne peut pas créer un compte de type "${role}".` });
      }

      if (!nom || !password) return res.status(400).json({ error: 'nom et password requis.' });

      // Générer email si absent : prenom.nom@emineo-education.fr
      const finalEmail = (email || '').trim() ||
        `${(prenom||'x').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-')}.${nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-')}@emineo-education.fr`;

      // Vérifier doublon email
      const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [finalEmail] });
      if (existing.rows && existing.rows.length) {
        return res.status(409).json({ error: `Email déjà utilisé : ${finalEmail}` });
      }

      const hash = hashPassword(password);
      // Campus : RP hérite son propre campus si non précisé
      const finalCampus = (campus || '').trim() || (user.role === 'rp' ? (user.campus || '') : '');

      await db.execute({
        sql: 'INSERT INTO users (role, nom, prenom, email, password_hash, campus) VALUES (?, ?, ?, ?, ?, ?)',
        args: [role, nom, prenom || '', finalEmail, hash, finalCampus],
      });

      return res.status(201).json({ ok: true, email: finalEmail });
    }

    // ─── DELETE : supprimer un compte ─────────────────────────────────────────
    if (req.method === 'DELETE') {
      const user = await requireRole(req, ['dir', 'rp']);
      if (!user) return res.status(403).json({ error: 'Accès réservé.' });

      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id requis.' });

      // Récupérer le compte cible
      const target = await db.execute({ sql: 'SELECT role, campus FROM users WHERE id = ?', args: [id] });
      if (!target.rows || !target.rows.length) return res.status(404).json({ error: 'Compte introuvable.' });

      const t = target.rows[0];
      // RP ne peut supprimer que intervenant/etudiant de son campus
      if (user.role === 'rp') {
        if (!['intervenant','etudiant'].includes(t.role)) return res.status(403).json({ error: 'Accès refusé.' });
        if (t.campus !== user.campus) return res.status(403).json({ error: 'Ce compte n\'appartient pas à votre campus.' });
      }
      // Protéger les comptes dir contre la suppression par un rp
      if (t.role === 'dir' && user.role !== 'dir') return res.status(403).json({ error: 'Seule la Direction peut supprimer un compte dir.' });

      await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
      await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [id] });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Méthode non supportée.' });

  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
};
