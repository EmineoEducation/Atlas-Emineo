/* ═══════════════════════════════════════════════════════════════
   API HELPERS — toutes les requêtes passent par ici
═══════════════════════════════════════════════════════════════ */
const TOKEN_KEY = 'atlas_token'

export function getToken()  { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }

export async function apiFetch(path, opts = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (token) headers['Authorization'] = 'Bearer ' + token

  const res = await fetch('/api' + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch (_) {
    throw new Error(res.ok ? 'Réponse non-JSON du serveur' : `Erreur serveur ${res.status} — ${text.slice(0, 100)}`)
  }
  if (!res.ok) throw new Error(data.error || 'Erreur ' + res.status)
  return data
}

export const api = {
  login:    (email, password) => apiFetch('/auth/login', { method:'POST', body:{ email, password } }),
  me:       ()                => apiFetch('/auth/me'),
  logout:   ()                => apiFetch('/auth/logout', { method:'POST' }),
  setup:    ()                => apiFetch('/setup', { method:'POST' }),

  getUsers:    ()   => apiFetch('/users'),
  createUser:  (u)  => apiFetch('/users', { method:'POST', body:u }),
  deleteUser:  (id) => apiFetch('/users', { method:'DELETE', body:{ id } }),

  getFormations:    ()       => apiFetch('/formations'),
  createFormation:  (campus, data) => apiFetch('/formations', { method:'POST', body:{ campus, data } }),
  deleteFormation:  (id)     => apiFetch('/formations', { method:'DELETE', body:{ id } }),
}

/* ═══════════════════════════════════════════════════════════════
   CLAUDE ENGINE — via endpoint serveur /api/ingest (clé protégée)
═══════════════════════════════════════════════════════════════ */
function repairJSON(raw) {
  let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const first = cleaned.indexOf('{')
  const last  = cleaned.lastIndexOf('}')
  if (first === -1) throw new Error('Aucun JSON trouvé')
  cleaned = cleaned.slice(first, last > first ? last + 1 : undefined)
  let open = 0, arr = 0
  for (const ch of cleaned) { if (ch==='{') open++; if (ch==='}') open--; if (ch==='[') arr++; if (ch===']') arr-- }
  if (open > 0 || arr > 0) {
    const lc = Math.max(cleaned.lastIndexOf(',{'), cleaned.lastIndexOf(',"'))
    if (lc > cleaned.length * 0.5) cleaned = cleaned.slice(0, lc)
    open = 0; arr = 0
    for (const ch of cleaned) { if (ch==='{') open++; if (ch==='}') open--; if (ch==='[') arr++; if (ch===']') arr-- }
    while (arr > 0) { cleaned += ']'; arr-- }
    while (open > 0) { cleaned += '}'; open-- }
  }
  return JSON.parse(cleaned)
}

export async function ingererDocuments(textes, campus, onProgress) {
  const corpus = textes.map((t, i) => `--- DOC ${i+1} ---\n${t.slice(0, 12000)}`).join('\n\n')
  const prompt = `Expert en ingénierie pédagogique. Analyse ces documents et extrais la structure.

${corpus}

RÈGLES STRICTES :
- Retourne UNIQUEMENT du JSON brut, PAS de markdown, PAS de backticks
- Maximum 5 notions_cles par module
- Descriptions courtes (max 10 mots par libellé)
- Messages d'alerte : 1 phrase max

NIVEAUX D'ALERTE (état des lieux du corpus) :
- niveau 1 = incohérence franche : une même notion centrale est couverte par plusieurs intervenants sur la même compétence sans articulation, OU contradiction manifeste entre modules. Signal fort.
- niveau 2 = coordination à établir : recoupement entre intervenants différents sur une notion proche. À coordonner.
- niveau 3 = signal doux : résonance sémantique transversale, simple mise en relation informative.

JSON :
{"formation":{"titre":"...","etablissement":"...","annee":"..."},"blocs":[{"id":"B1","titre":"...","competences":[{"id":"C1","libelle":"max 10 mots"}],"modules":[{"id":"M1","titre":"...","intervenant":"...","competences_liees":["C1"],"notions_cles":["max 5"],"volume":"Xh"}]}],"intervenants":["noms"],"notions_transversales":["notions multi-blocs"],"alertes_detectees":[{"niveau":1,"notion":"...","modules":["M1","M2"],"message":"1 phrase"}]}`
  onProgress('Analyse du corpus…')
  const { text } = await apiFetch('/ingest', { method:'POST', body:{ prompt } })
  onProgress('Structuration…')
  return repairJSON(text)
}

export async function genererFicheJ1(formation, module_, onToken) {
  const autres = (formation.blocs||[]).flatMap(b=>(b.modules||[]).map(m=>({titre:m.titre,notions:m.notions_cles}))).filter(m=>m.titre!==module_.titre).slice(0,10)
  const prompt = `Assistant pédagogique. Fiche contexte J-1.
Formation : ${formation.formation?.titre||''}
Module : ${module_.titre}
Notions : ${(module_.notions_cles||[]).join(', ')}
Autres modules : ${JSON.stringify(autres)}
Retourne UNIQUEMENT ce JSON :
{"ancrage":"2 lignes max","dejavu":[{"intervenant":"...","module":"...","concepts":["..."],"lien":"conseil"}],"apres":[{"date":"à venir","intervenant":"...","module":"...","concepts":["..."]}]}`
  try {
    const { text } = await apiFetch('/ingest', { method:'POST', body:{ prompt } })
    if (onToken) onToken(text)
    try { return repairJSON(text) }
    catch (_) { return { ancrage:text.slice(0,120), dejavu:[], apres:[] } }
  } catch (_) {
    return { ancrage:'Cette séance prépare les étudiants aux compétences visées.', dejavu:[], apres:[] }
  }
}

export { repairJSON }
