# Atlas des compétences — Éminéo (bêta générique)

Outil de coordination pédagogique inter-intervenants. 4 rôles : Direction des programmes, Responsable pédagogique, Intervenant, Étudiant.

## Déploiement Vercel (recommandé)

### 1. Cloner et préparer
```bash
git clone <votre-repo>
cd atlas-emineo-generique
npm install
```

### 2. Variables d'environnement Vercel
Dans Vercel > Settings > Environment Variables, ajouter :

| Nom | Valeur | Environnements |
|-----|--------|----------------|
| `VITE_ANTHROPIC_API_KEY` | `sk-ant-…` | Production, Preview |

⚠️ **Ne jamais committer la clé API.** Elle doit uniquement être définie dans Vercel.

### 3. Push → déploiement automatique
```bash
git add .
git commit -m "feat: atlas emineo beta"
git push origin main
```
Vercel détecte automatiquement Vite et déploie.

### 4. Framework preset Vercel
- **Framework** : Vite
- **Build command** : `npm run build`
- **Output directory** : `dist`
- **Install command** : `npm install`

---

## Développement local
```bash
cp .env.example .env
# Remplir VITE_ANTHROPIC_API_KEY dans .env (ne pas committer)
npm run dev
```

---

## Configuration de la formation

Éditer `src/App.jsx`, section `CONFIG` (ligne ~1) :

```js
const CONFIG = {
  nomReseau:  "Éminéo Éducation",
  nomAtlas:   "Atlas des compétences",
  annee:      "2026–27",
  campus:     ["Paris", "Bordeaux", ...],
  promos:     ["BUT 1", "BUT 2", ...],
  groupes:    ["Groupe A", "Groupe B", ...],
}
```

Les blocs, compétences et modules (section `BLOCS_MOCK`, `COMP_ETUDIANT_MOCK`, etc.) sont des données de démonstration — à remplacer par les vraies données issues de l'ingestion syllabi une fois la bêta validée.

---

## Architecture

```
src/
├── App.jsx        # Tout : données, logique, vues, Claude API
├── index.css      # Tokens Charte Éminéo V.1 Mars 2026
└── main.jsx       # Entry point React
index.html         # Shell HTML, fonts Google
vite.config.js     # Config Vite
.env.example       # Template variables d'environnement
```

## Stack
- React 18 + Vite 5
- Pas de dépendance tierce (graphe en Canvas pur)
- Claude API : `claude-sonnet-4-20250514`, streaming SSE
- Charte Éminéo : Playfair Display + Inter, palette Vert Abysse / Vert Menthe / Menthe Givrée / Saumon
