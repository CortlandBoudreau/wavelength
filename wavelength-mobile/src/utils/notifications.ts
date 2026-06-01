import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SCHEDULED_KEY = "wl_daily_notif_v1";

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
  } catch {
    // Never crash the app over a missed notification
  }
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
