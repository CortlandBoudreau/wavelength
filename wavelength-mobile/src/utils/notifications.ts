import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import client from "../api/client";

const SCHEDULED_KEY = "wl_daily_notif_v1";
const PUSH_TOKEN_KEY = "wl_push_token_v1";

// Show notifications while app is in foreground too
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Request permission and schedule a repeating daily notification at 9 am.
 * Silently no-ops if permission is denied or already scheduled.
 */
export async function scheduleDailyDigest(): Promise<void> {
  try {
    const already = await AsyncStorage.getItem(SCHEDULED_KEY);
    if (already === "true") return;

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    // Clear any leftover schedules from previous installs
    await Notifications.cancelAllScheduledNotificationsAsync();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your science digest is ready 🌊",
        body: "Fresh stories curated for you today.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 9,
        minute: 0,
      },
    });

    await AsyncStorage.setItem(SCHEDULED_KEY, "true");

    // Register the Expo push token with the server so topic burst alerts can
    // be delivered as server-initiated push notifications.
    await registerPushToken();
  } catch {
    // Never crash the app over a missed notification
  }
}

/**
 * Register (or refresh) the device's Expo push token with the server.
 * Safe to call multiple times — uses AsyncStorage to avoid redundant requests.
 * Must be called while the user is authenticated (needs a valid JWT in client).
 */
export async function registerPushToken(): Promise<void> {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Only POST if the token changed since last time
    const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (stored === token) return;

    await client.patch("/auth/push-token", { push_token: token });
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  } catch {
    // Non-fatal — topic bursts will just not have push for this user
  }
}

/**
 * Deregister push token from the server (call on logout).
 */
export async function deregisterPushToken(): Promise<void> {
  try {
    await client.patch("/auth/push-token", { push_token: null });
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {}
}

/**
 * Cancel the daily notification and clear the scheduled flag.
 * Call this on logout if you want to stop notifications for signed-out users.
 */
export async function cancelDailyDigest(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(SCHEDULED_KEY);
  } catch {}
}
