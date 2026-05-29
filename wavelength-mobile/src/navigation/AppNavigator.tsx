import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";
import StoryDetail from "../screens/StoryDetail";
import PostAuthInterests from "../screens/PostAuthInterests";
import Paywall from "../screens/Paywall";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  PostAuthInterests: undefined;
  StoryDetail: { storyId: string };
  Paywall: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { user, isGuest, needsOnboarding } = useAuth();
  const isAuthenticated = !!user || isGuest;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : needsOnboarding ? (
        <Stack.Screen name="PostAuthInterests" component={PostAuthInterests} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="StoryDetail" component={StoryDetail} />
          <Stack.Screen
            name="Paywall"
            component={Paywall}
            options={{ presentation: "modal" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
