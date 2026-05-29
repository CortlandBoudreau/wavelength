import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Landing from "../screens/Landing";
import Interests from "../screens/Interests";
import Login from "../screens/Login";
import Register from "../screens/Register";

export type AuthStackParamList = {
  Landing: undefined;
  Interests: undefined;
  Login: undefined;
  Register: { interests: string[] };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing" component={Landing} />
      <Stack.Screen name="Interests" component={Interests} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Register" component={Register} />
    </Stack.Navigator>
  );
}
