import { authHeaders } from './auth';

const BASE = '/api';

export async function fetchStories({ category, favorited, limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit, offset });
  if (category) params.set('category', category);
  if (favorited) params.set('favorited', 'true');
  const res = await fetch(`${BASE}/stories?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch stories');
  return res.json();
}

export async function fetchStory(id) {
  const res = await fetch(`${BASE}/stories/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Story not found');
  return res.json();
}

export async function refreshStories() {
  const res = await fetch(`${BASE}/stories/refresh`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) throw new Error('Refresh failed');
  return res.json();
}

export async function toggleFavorite(id) {
  const res = await fetch(`${BASE}/stories/${id}/favorite`, { method: 'PATCH', headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to toggle favorite');
  return res.json();
}

export async function updateNotes(id, { notes, tags }) {
  const res = await fetch(`${BASE}/stories/${id}/notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ notes, tags }),
  });
  if (!res.ok) throw new Error('Failed to save notes');
  return res.json();
}

export async function toggleUsed(id) {
  const res = await fetch(`${BASE}/stories/${id}/used`, { method: 'PATCH', headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to toggle used');
  return res.json();
}

export async function fetchAnalytics() {
  const res = await fetch(`${BASE}/analytics`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

export async function sendDigest() {
  const res = await fetch(`${BASE}/digest/send`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to send digest');
  return res.json();
}

export async function previewDigest() {
  const res = await fetch(`${BASE}/digest/preview`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to preview digest');
  return res.json();
}

export async function fetchTrendingHashtags({ days = 7, limit = 20 } = {}) {
  const params = new URLSearchParams({ days, limit });
  const res = await fetch(`${BASE}/trending/hashtags?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch trending hashtags');
  return res.json();
}

export async function rateSource(source, rating) {
  const res = await fetch(`${BASE}/sources/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ source, rating }),
  });
  if (!res.ok) throw new Error('Failed to rate source');
  return res.json();
}

export async function fetchSources() {
  const res = await fetch(`${BASE}/sources`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch sources');
  return res.json();
}
