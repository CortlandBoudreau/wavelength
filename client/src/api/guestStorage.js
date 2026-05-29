// All guest state lives in localStorage under these keys
const KEYS = {
  PROFILE: 'wl_guest_profile',
  INTERACTIONS: 'wl_guest_interactions', // { [storyId]: { favorited, notes, tags, used } }
};

// --- Guest profile (interests + hashtag filters) ---

export function getGuestProfile() {
  try {
    const raw = localStorage.getItem(KEYS.PROFILE);
    return raw ? JSON.parse(raw) : {
      interests: ['marine_science', 'diversity_stem', 'science', 'cool_facts'],
      hashtag_includes: [],
      hashtag_excludes: [],
    };
  } catch {
    return { interests: [], hashtag_includes: [], hashtag_excludes: [] };
  }
}

export function saveGuestProfile(updates) {
  const current = getGuestProfile();
  const merged = { ...current, ...updates };
  localStorage.setItem(KEYS.PROFILE, JSON.stringify(merged));
  return merged;
}

// --- Guest interactions (favorites, notes, tags, used) ---

function getAllInteractions() {
  try {
    const raw = localStorage.getItem(KEYS.INTERACTIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAllInteractions(data) {
  localStorage.setItem(KEYS.INTERACTIONS, JSON.stringify(data));
}

export function getGuestInteraction(storyId) {
  return getAllInteractions()[storyId] || { favorited: false, notes: '', tags: [], used: false };
}

export function toggleGuestFavorite(storyId) {
  const all = getAllInteractions();
  const current = all[storyId] || {};
  const favorited = !current.favorited;
  all[storyId] = { ...current, favorited };
  saveAllInteractions(all);
  return { favorited };
}

export function updateGuestNotes(storyId, { notes, tags }) {
  const all = getAllInteractions();
  all[storyId] = { ...(all[storyId] || {}), notes, tags: tags || [] };
  saveAllInteractions(all);
  return { ok: true };
}

export function toggleGuestUsed(storyId) {
  const all = getAllInteractions();
  const current = all[storyId] || {};
  const used = !current.used;
  all[storyId] = { ...current, used };
  saveAllInteractions(all);
  return { used };
}

// Merge guest interactions into a stories array (from API)
export function mergeGuestInteractions(stories) {
  const all = getAllInteractions();
  return stories.map((s) => {
    const g = all[s.id];
    if (!g) return s;
    return {
      ...s,
      favorited: g.favorited ?? s.favorited,
      notes: g.notes ?? s.notes,
      tags: g.tags ?? s.tags,
      used: g.used ?? s.used,
    };
  });
}
