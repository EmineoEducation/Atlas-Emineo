// ─── Fetch authentifié vers les endpoints Vercel ───────────────────────────
export async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  let body;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    body = await res.json();
  } else {
    const text = await res.text();
    body = { error: `Réponse non-JSON (${res.status}) : ${text.slice(0, 200)}` };
  }

  if (!res.ok) {
    throw new Error(body.error || `Erreur HTTP ${res.status}`);
  }
  return body;
}

// ─── Ingestion via api/ingest.js ────────────────────────────────────────────
export async function ingererDocuments(textes, campus, onProgress) {
  onProgress('Envoi au serveur…');

  const result = await apiFetch('/api/ingest', {
    method: 'POST',
    body: JSON.stringify({ textes, campus }),
  });

  if (result.error) throw new Error(result.error);
  if (!result.data) throw new Error('Réponse inattendue du serveur (pas de champ data)');

  onProgress('Structuration…');
  return result.data;
}

// ─── Sauvegarde en Turso via api/formations.js ──────────────────────────────
export async function sauvegarderFormation(data, campus) {
  return apiFetch('/api/formations', {
    method: 'POST',
    body: JSON.stringify({ campus, data }),
  });
}

// ─── Chargement des formations ──────────────────────────────────────────────
export async function chargerFormations() {
  const result = await apiFetch('/api/formations');
  return result.formations || [];
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export async function login(email, password) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  return apiFetch('/api/auth/logout', { method: 'POST' });
}

export async function getMe() {
  return apiFetch('/api/auth/me');
}

// ─── Token helpers ────────────────────────────────────────────────────────────
const TOKEN_KEY = 'atlas_token'
export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }

// ─── Objet api — compatibilité avec App.jsx ───────────────────────────────────
export const api = {
  login:           (email, password) => apiFetch('/api/auth/login', { method:'POST', body: JSON.stringify({ email, password }) }),
  logout:          ()                => apiFetch('/api/auth/logout', { method:'POST' }),
  me:              ()                => apiFetch('/api/auth/me'),
  getUsers:        ()                => apiFetch('/api/users'),
  createUser:      (form)            => apiFetch('/api/users', { method:'POST', body: JSON.stringify(form) }),
  deleteUser:      (id)              => apiFetch('/api/users', { method:'DELETE', body: JSON.stringify({ id }) }),
  getFormations:   ()                => apiFetch('/api/formations'),
  createFormation: (campus, data)    => apiFetch('/api/formations', { method:'POST', body: JSON.stringify({ campus, data }) }),
  deleteFormation: (id)              => apiFetch('/api/formations', { method:'DELETE', body: JSON.stringify({ id }) }),
}
