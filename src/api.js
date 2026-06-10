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
