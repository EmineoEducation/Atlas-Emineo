# Atlas des compétences — Éminéo (vierge)

Outil de coordination pédagogique inter-intervenants.  
**Aucune donnée de formation n'est codée en dur.** Le graphe se construit uniquement à partir des documents que vous y déposez.

## Déploiement Vercel

### 1. GitHub Desktop
- File → Add Local Repository → pointer ce dossier
- Commit : `init atlas vierge`
- Publish repository

### 2. Vercel
- Add New Project → importer le repo
- Framework : **Vite** (détecté automatiquement)
- Environment Variables → ajouter :

| Nom | Valeur |
|-----|--------|
| `VITE_ANTHROPIC_API_KEY` | `sk-ant-…` |

- Deploy

### 3. Utilisation
1. Se connecter en **Direction des programmes**
2. Onglet **Ingestion** → déposer les fichiers texte (.txt .md)
3. Cliquer **Analyser avec Claude**
4. La formation est chargée — les 4 rôles sont actifs

## Format des fichiers acceptés

Texte brut `.txt` ou `.md` — copier-coller le contenu des syllabi Word/PDF dedans si nécessaire.  
Le moteur Claude lit : intitulés de blocs, compétences, modules, intervenants, notions clés, volumes horaires.

## Développement local

```bash
cp .env.example .env   # remplir la clé
npm install
npm run dev
```
