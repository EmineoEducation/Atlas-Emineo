# Atlas des compétences — Éminéo (avec authentification)

## Architecture

```
api/                      ← Vercel serverless functions
  _lib/db.js              ← Client Turso
  _lib/auth.js            ← Hash + sessions
  setup.js                ← POST /api/setup — init DB + 3 comptes dir péda
  auth/login.js           ← POST /api/auth/login
  auth/me.js              ← GET /api/auth/me
  auth/logout.js          ← POST /api/auth/logout
  users.js                ← GET/POST/DELETE /api/users (admin)
  formations.js           ← GET/POST/DELETE /api/formations
src/
  api.js                  ← API helpers + moteur Claude
  App.jsx                 ← Frontend React complet
  index.css               ← Charte Éminéo
  main.jsx
```

## Déploiement

### 1. Variables d'environnement Vercel

| Nom | Valeur |
|-----|--------|
| `VITE_ANTHROPIC_API_KEY` | `sk-ant-…` |
| `TURSO_DATABASE_URL` | `libsql://atlas-emineo-xxx.turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJ…` |

### 2. GitHub Desktop → push → Vercel deploy

### 3. Initialiser la base de données

Après le premier déploiement, appeler UNE FOIS :

```
curl -X POST https://votre-domaine.vercel.app/api/setup
```

Ou ouvrir dans le navigateur l'URL et utiliser un outil comme Postman.

Ça crée les tables et les 3 comptes Direction pédagogique :

| Email | Mot de passe |
|-------|-------------|
| `arnaud.robert@emineo-education.fr` | `atlas2026` |
| `ludovic.herve@emineo-education.fr` | `atlas2026` |
| `sylvain.kornowski@emineo-education.fr` | `atlas2026` |

### 4. Se connecter

Aller sur l'URL Vercel → page de login → saisir email + mot de passe.

### 5. Créer les comptes des autres acteurs

Connecté en tant que Dir péda → onglet **Comptes** → créer RP, intervenants, étudiants.
