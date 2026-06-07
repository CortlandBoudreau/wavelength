import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Dashboard from "../screens/Dashboard";
import Discover from "../screens/Discover";
import Analytics from "../screens/Analytics";
import Profile from "../screens/Profile";

export type MainTabsParamList = {
  Dashboard: undefined;
  Discover: undefined;
  Analytics: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

export default function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1a2a3a",
          borderTopColor: "rgba(74,158,219,0.15)",
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: "#4A9EDB",
        tabBarInactiveTintColor: "#6b8aaa",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Dashboard:  "radio-outline",
            Discover:   "compass-outline",
            Analytics:  "bar-chart-outline",
            Profile:    "person-circle-outline",
          };
          return <Ionicons name={icons[route.name] ?? "ellipse-outline"} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={Dashboard} />
      <Tab.Screen name="Discover"  component={Discover} />
      <Tab.Screen name="Analytics" component={Analytics} />
      <Tab.Screen name="Profile"   component={Profile} />
    </Tab.Navigator>
  );
}
