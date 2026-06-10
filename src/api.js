// ════════════════════════════════════════════════════════════════════════════
//  Atlas Émineo — client API (front)
//  Exporte TOUT ce que App.jsx importe :
//    api, setToken, clearToken, getToken, ingererDocuments, genererFicheJ1
// ════════════════════════════════════════════════════════════════════════════

const TOKEN_KEY = 'atlas_token'

// ─── Token helpers (localStorage) ─────────────────────────────────────────────
export function getToken()   { try { return localStorage.getItem(TOKEN_KEY) } catch (_) { return null } }
export function setToken(t)  { try { localStorage.setItem(TOKEN_KEY, t) } catch (_) {} }
export function clearToken() { try { localStorage.removeItem(TOKEN_KEY) } catch (_) {} }

// ─── Fetch authentifié vers les endpoints Vercel ──────────────────────────────
// Envoie le token à la fois en cookie (credentials) ET en header Bearer,
// pour rester compatible quel que soit le mode attendu par api/_lib/auth.js.
export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  // Accepte body objet (on stringify) OU body déjà string.
  let body = options.body
  if (body && typeof body !== 'string') body = JSON.stringify(body)

  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers,
    body,
  })

  let data
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    data = await res.json()
  } else {
    const text = await res.text()
    data = { error: `Réponse non-JSON (${res.status}) : ${text.slice(0, 200)}` }
  }

  if (!res.ok) throw new Error(data.error || `Erreur HTTP ${res.status}`)
  return data
}

// ─── Réparation JSON tronqué (front, miroir du serveur) ───────────────────────
function repairJSON(raw) {
  let s = (raw || '').trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const first = s.indexOf('{')
  if (first === -1) throw new Error('Aucun JSON dans la réponse')
  const last = s.lastIndexOf('}')
  s = s.slice(first, last > first ? last + 1 : undefined)
  let open = 0, arr = 0
  for (const ch of s) {
    if (ch === '{') open++
    if (ch === '}') open--
    if (ch === '[') arr++
    if (ch === ']') arr--
  }
  if (open > 0 || arr > 0) {
    const cut = Math.max(s.lastIndexOf(',{'), s.lastIndexOf(',"'))
    if (cut > s.length * 0.5) s = s.slice(0, cut)
    open = 0; arr = 0
    for (const ch of s) {
      if (ch === '{') open++
      if (ch === '}') open--
      if (ch === '[') arr++
      if (ch === ']') arr--
    }
    while (arr > 0) { s += ']'; arr-- }
    while (open > 0) { s += '}'; open-- }
  }
  return JSON.parse(s)
}

// ─── Ingestion de documents (envoie textes + campus) ──────────────────────────
// Signature : ingererDocuments(textes, campus, onProgress)
export async function ingererDocuments(textes, campus, onProgress) {
  if (onProgress) onProgress('Envoi au serveur…')
  const result = await apiFetch('/api/ingest', {
    method: 'POST',
    body: { textes, campus },
  })
  if (result.error) throw new Error(result.error)
  if (!result.data) throw new Error('Réponse inattendue du serveur (pas de champ data).')
  if (onProgress) onProgress('Structuration…')
  return result.data
}

// ─── Fiche J-1 intervenant (envoie un prompt direct) ──────────────────────────
// Signature : genererFicheJ1(formation, module_, onToken)
export async function genererFicheJ1(formation, module_, onToken) {
  const autres = (formation.blocs || [])
    .flatMap(b => (b.modules || []).map(m => ({ titre: m.titre, notions: m.notions_cles })))
    .filter(m => m.titre !== module_.titre)
    .slice(0, 10)

  const prompt =
    'Assistant pédagogique. Fiche contexte J-1.\n' +
    'Formation : ' + ((formation.formation && formation.formation.titre) || '') + '\n' +
    'Module : ' + module_.titre + '\n' +
    'Notions : ' + ((module_.notions_cles || []).join(', ')) + '\n' +
    'Autres modules : ' + JSON.stringify(autres) + '\n' +
    'Retourne UNIQUEMENT ce JSON : {"ancrage":"2 lignes max","dejavu":[{"intervenant":"...","module":"...","concepts":["..."],"lien":"conseil"}],"apres":[{"date":"à venir","intervenant":"...","module":"...","concepts":["..."]}]}'

  try {
    const result = await apiFetch('/api/ingest', { method: 'POST', body: { prompt } })
    const text = result.text || ''
    if (onToken) onToken(text)
    try { return repairJSON(text) }
    catch (_) { return { ancrage: text.slice(0, 120), dejavu: [], apres: [] } }
  } catch (_) {
    return { ancrage: 'Cette séance prépare les étudiants aux compétences visées.', dejavu: [], apres: [] }
  }
}

// ─── Objet api — toutes les méthodes consommées par App.jsx ───────────────────
export const api = {
  login:           (email, password) => apiFetch('/api/auth/login',  { method: 'POST',   body: { email, password } }),
  logout:          ()                => apiFetch('/api/auth/logout', { method: 'POST' }),
  me:              ()                => apiFetch('/api/auth/me'),
  getUsers:        ()                => apiFetch('/api/users'),
  createUser:      (form)            => apiFetch('/api/users',       { method: 'POST',   body: form }),
  deleteUser:      (id)              => apiFetch('/api/users',       { method: 'DELETE', body: { id } }),
  getFormations:   ()                => apiFetch('/api/formations'),
  createFormation: (campus, data)    => apiFetch('/api/formations',  { method: 'POST',   body: { campus, data } }),
  deleteFormation: (id)              => apiFetch('/api/formations',  { method: 'DELETE', body: { id } }),
}
