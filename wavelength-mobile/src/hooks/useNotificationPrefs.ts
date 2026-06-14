/**
 * useNotificationPrefs
 *
 * Loads, caches, and saves the user's notification preferences.
 * - Persists locally in AsyncStorage so the UI works offline / on first load.
 * - Syncs to the server on every save.
 * - Reschedules the local daily-digest notification whenever the time changes.
 */

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import client from "../api/client";
import { registerPushToken } from "../utils/notifications";

const PREFS_CACHE_KEY = "wl_notif_prefs_v1";
const SCHEDULED_KEY   = "wl_daily_notif_v1";

export interface NotificationPrefs {
  daily_digest:          boolean;
  daily_digest_hour:     number;   // 0–23
  topic_alerts:          boolean;
  posting_reminder:      boolean;
  posting_reminder_days: number;   // 1–30
}

const DEFAULTS: NotificationPrefs = {
  daily_digest:          true,
  daily_digest_hour:     9,
  topic_alerts:          true,
  posting_reminder:      false,
  posting_reminder_days: 5,
};

export function useNotificationPrefs(isLoggedIn: boolean) {
  const [prefs, setPrefs]     = useState<NotificationPrefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }

    (async () => {
      try {
        // Show cached value immediately while the server responds
        const cached = await AsyncStorage.getItem(PREFS_CACHE_KEY);
        if (cached) setPrefs({ ...DEFAULTS, ...JSON.parse(cached) });

        const { data } = await client.get<Partial<NotificationPrefs>>(
          "/auth/notification-preferences"
        );
        const merged = { ...DEFAULTS, ...data };
        setPrefs(merged);
        await AsyncStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(merged));
      } catch {
        // Silently fall back to cached / defaults
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoggedIn]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const savePrefs = useCallback(async (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next); // optimistic update
    setSaving(true);

    try {
      await client.patch("/auth/notification-preferences", patch);
      await AsyncStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(next));

      // ── Reschedule local daily-digest notification ──────────────────────
      // Cancel only the previously scheduled digest (by stored ID), not all notifications
      const existingId = await AsyncStorage.getItem(SCHEDULED_KEY);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
        await AsyncStorage.removeItem(SCHEDULED_KEY);
      }

      if (next.daily_digest) {
        // Re-request permission in case the user granted it since install
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === "granted") {
          const notifId = await Notifications.scheduleNotificationAsync({
            content: {
              title: "Your science digest is ready 🌊",
              body: "Fresh stories curated for you today.",
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: next.daily_digest_hour,
              minute: 0,
            },
          });
          // Store the ID so we cancel only this notification next time
          await AsyncStorage.setItem(SCHEDULED_KEY, notifId);

          // Ensure push token is registered for server-push features
          await registerPushToken();
        }
      }
    } catch (err) {
      // Roll back optimistic update on failure
      setPrefs(prefs);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  return { prefs, loading, saving, savePrefs };
}
