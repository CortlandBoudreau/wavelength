import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "guest_interaction_";

// ── Guest story detail view tracking ─────────────────────────────────────────
const GUEST_VIEWS_KEY = "guest_story_views";

interface GuestViewRecord { count: number; date: string }

const todayStr = () => new Date().toISOString().split("T")[0];

export const getGuestStoryViewsToday = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(GUEST_VIEWS_KEY);
    if (!raw) return 0;
    const record: GuestViewRecord = JSON.parse(raw);
    return record.date === todayStr() ? record.count : 0;
  } catch {
    return 0;
  }
};

export const incrementGuestStoryViews = async (): Promise<void> => {
  try {
    const existing = await getGuestStoryViewsToday();
    await AsyncStorage.setItem(
      GUEST_VIEWS_KEY,
      JSON.stringify({ count: existing + 1, date: todayStr() })
    );
  } catch {
    // ignore
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
  } catch {
    // ignore
  }
};
