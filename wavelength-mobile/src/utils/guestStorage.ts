import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "guest_interaction_";

// ── Guest story detail view tracking ─────────────────────────────────────────
// Tracks the SET of story IDs the guest has opened today (not just a count).
// This lets us:
//   - allow re-opening an already-viewed article without counting it again
//   - enforce a daily cap of GUEST_DAILY_LIMIT unique new articles
const GUEST_VIEWS_KEY = "guest_story_views";
export const GUEST_DAILY_LIMIT = 3;

interface GuestViewRecord {
  ids: string[];   // story IDs viewed today
  date: string;    // YYYY-MM-DD
}

const todayStr = () => new Date().toISOString().split("T")[0];

async function getViewRecord(): Promise<GuestViewRecord> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_VIEWS_KEY);
    if (!raw) return { ids: [], date: todayStr() };
    const record: GuestViewRecord = JSON.parse(raw);
    // Reset if it's a new day
    return record.date === todayStr() ? record : { ids: [], date: todayStr() };
  } catch {
    return { ids: [], date: todayStr() };
  }
}

/** Returns how many unique new articles the guest has opened today. */
export const getGuestStoryViewsToday = async (): Promise<number> => {
  const record = await getViewRecord();
  return record.ids.length;
};

/** Returns true if this specific story was already opened by the guest today. */
export const hasGuestViewedStory = async (storyId: string): Promise<boolean> => {
  const record = await getViewRecord();
  return record.ids.includes(storyId);
};

/**
 * Records a new story view for the guest.
 * Returns true if the view was counted (new story today),
 * or false if the guest has already seen this story (no limit consumed).
 */
export const recordGuestStoryView = async (storyId: string): Promise<{ alreadySeen: boolean; total: number }> => {
  try {
    const record = await getViewRecord();
    if (record.ids.includes(storyId)) {
      return { alreadySeen: true, total: record.ids.length };
    }
    const updated = { ids: [...record.ids, storyId], date: todayStr() };
    await AsyncStorage.setItem(GUEST_VIEWS_KEY, JSON.stringify(updated));
    return { alreadySeen: false, total: updated.ids.length };
  } catch {
    return { alreadySeen: false, total: 0 };
  }
};

// Keep the old increment export for any callers that haven't been updated yet,
// but forward to recordGuestStoryView so logic stays consistent.
export const incrementGuestStoryViews = async (storyId?: string): Promise<void> => {
  if (storyId) {
    await recordGuestStoryView(storyId);
  }
};

export interface GuestInteraction {
  favorited?: boolean;
  used?: boolean;
  notes?: string;
  tags?: string[];
}

export const getGuestInteraction = async (
  storyId: string
): Promise<GuestInteraction | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + storyId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setGuestInteraction = async (
  storyId: string,
  interaction: GuestInteraction
): Promise<void> => {
  try {
    const existing = await getGuestInteraction(storyId);
    await AsyncStorage.setItem(
      KEY_PREFIX + storyId,
      JSON.stringify({ ...existing, ...interaction })
    );
  } catch {
    // ignore storage errors
  }
};

export const getAllGuestInteractions = async (): Promise<
  Record<string, GuestInteraction>
> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const guestKeys = keys.filter((k) => k.startsWith(KEY_PREFIX));
    const result: Record<string, GuestInteraction> = {};
    for (const key of guestKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) result[key.replace(KEY_PREFIX, "")] = JSON.parse(raw);
    }
    return result;
  } catch {
    return {};
  }
};

export const clearGuestStorage = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    for (const key of keys.filter((k) => k.startsWith(KEY_PREFIX))) {
      await AsyncStorage.removeItem(key);
    }
    await AsyncStorage.removeItem(GUEST_VIEWS_KEY);
  } catch {
    // ignore
  }
};
