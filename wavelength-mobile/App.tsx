import "./global.css";
import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { PurchaseProvider, usePurchase } from "./src/context/PurchaseContext";
import AppNavigator from "./src/navigation/AppNavigator";

/** Syncs the logged-in user's ID into RevenueCat whenever auth state changes. */
function RevenueCatUserBridge() {
  const { user } = useAuth();
  const { identifyUser, logOutRevenueCat } = usePurchase();

  useEffect(() => {
    if (user?.id) {
      identifyUser(String(user.id));
    }
  }, [user?.id]);

  return null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PurchaseProvider>
            <RevenueCatUserBridge />
            <NavigationContainer>
              <StatusBar style="light" backgroundColor="#1a2a3a" translucent={false} />
              <AppNavigator />
            </NavigationContainer>
          </PurchaseProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
