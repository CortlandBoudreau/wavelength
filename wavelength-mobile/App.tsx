import "./global.css";
import React, { useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import type { NavigationContainerRef } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { PurchaseProvider, usePurchase } from "./src/context/PurchaseContext";
import AppNavigator from "./src/navigation/AppNavigator";
import type { RootStackParamList } from "./src/navigation/AppNavigator";

/** Syncs the logged-in user's ID into RevenueCat whenever auth state changes. */
function RevenueCatUserBridge() {
  const { user } = useAuth();
  const { identifyUser } = usePurchase();

  useEffect(() => {
    if (user?.id) {
      identifyUser(String(user.id));
    }
  }, [user?.id]);

  return null;
}

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    // Handle tap on a notification when the app is in foreground or background
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any> ?? {};
      handleNotificationNavigation(data);
    });

    // Handle tap when the app was fully closed (cold launch via notification)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, any> ?? {};
      // Delay slightly so the navigator is mounted before we navigate
      setTimeout(() => handleNotificationNavigation(data), 500);
    });

    return () => subscription.remove();
  }, []);

  function handleNotificationNavigation(data: Record<string, any>) {
    const nav = navigationRef.current;
    if (!nav?.isReady()) return;

    if (data.type === "topic_burst" || data.type === "posting_reminder" || !data.type) {
      // Navigate to Dashboard tab — works whether app was backgrounded or cold-launched
      nav.navigate("Main" as any);
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PurchaseProvider>
            <RevenueCatUserBridge />
            <NavigationContainer ref={navigationRef}>
              <StatusBar style="light" backgroundColor="#1a2a3a" translucent={false} />
              <AppNavigator />
            </NavigationContainer>
          </PurchaseProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
