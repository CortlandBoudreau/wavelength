const BASE = '/api/auth';

function getToken() {
  return localStorage.getItem('wl_token');
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(res, fallbackMsg) {
  const text = await res.text();
  if (!text) throw new Error(`${fallbackMsg}: server returned an empty response (check server logs)`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${fallbackMsg}: unexpected server response — ${text.slice(0, 120)}`);
  }
}

export async function register({ email, name, password }) {
  const res = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password }),
  });
  const data = await parseResponse(res, 'Registration failed');
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  localStorage.setItem('wl_token', data.token);
  return data;
}

export async function login({ email, password }) {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseResponse(res, 'Login failed');
  if (!res.ok) throw new Error(data.error || 'Login failed');
  localStorage.setItem('wl_token', data.token);
  return data;
}

export function logout() {
  localStorage.removeItem('wl_token');
}

export async function getMe() {
  const res = await fetch(`${BASE}/me`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function updateProfile(updates) {
  const res = await fetch(`${BASE}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Update failed');
  return data;
}
