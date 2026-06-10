import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import WaveLogo from "../components/WaveLogo";
import { useAuth } from "../context/AuthContext";
import { useGoogleAuth } from "../hooks/useGoogleAuth";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/AuthStack";

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Login">;
}

export default function Login({ navigation }: Props) {
  const { login, loginWithGoogle } = useAuth();
  const { request: googleRequest, response: googleResponse, promptAsync: googlePrompt, isAvailable: googleAvailable } = useGoogleAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  // Handle Google OAuth response
  useEffect(() => {
    if (googleResponse?.type === "success") {
      const token = googleResponse.authentication?.accessToken;
      if (token) {
        setLoading(true);
        loginWithGoogle(token).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Google sign-in failed";
          Alert.alert("Google sign-in failed", msg);
        }).finally(() => setLoading(false));
      }
    } else if (googleResponse?.type === "error") {
      Alert.alert("Google sign-in failed", googleResponse.error?.message ?? "Unknown error");
    }
  }, [googleResponse]);

  const handleLogin = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      Alert.alert("Login failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: "#ffffff",
    color: "#2c3e50",
    borderWidth: 1.5,
    borderColor: "#e0e7ef",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    marginBottom: 12,
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0f1e2d" }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Scrollable form */}
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Back */}
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ paddingTop: 8, paddingBottom: 4 }}>
              <Ionicons name="arrow-back" size={24} color="#7ec8f0" />
            </Pressable>

            <View style={{ alignItems: "center", marginTop: 24, marginBottom: 32 }}>
              <WaveLogo size="md" />
            </View>

            <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "800", marginBottom: 4 }}>
              Welcome back
            </Text>
            <Text style={{ color: "#7a96ae", fontSize: 14, marginBottom: 28 }}>
              Sign in to your account
            </Text>

            <TextInput
              style={inputStyle}
              placeholder="Email"
              placeholderTextColor="#6b7a8d"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={{ ...inputStyle, marginBottom: 8 }}
              placeholder="Password"
              placeholderTextColor="#6b7a8d"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              value={password}
              onChangeText={setPassword}
            />

            <Pressable
              onPress={() => navigation.navigate("ForgotPassword")}
              style={{ alignItems: "flex-end", paddingBottom: 20 }}
            >
              <Text style={{ color: "#4A9EDB", fontSize: 13 }}>Forgot password?</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("Interests")}
              style={{ alignItems: "center", paddingVertical: 10 }}
            >
              <Text style={{ color: "#7a96ae", fontSize: 14 }}>
                No account?{" "}
                <Text style={{ color: "#4A9EDB", fontWeight: "600" }}>Create one</Text>
              </Text>
            </Pressable>
          </ScrollView>

          {/* Fixed footer — always visible above keyboard */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8, backgroundColor: "#0f1e2d" }}>
            {/* Google Sign-In — only shown when EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is configured */}
            {googleAvailable && <Pressable
              onPress={() => googlePrompt()}
              disabled={loading || !googleRequest}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
                borderRadius: 14,
                paddingVertical: 14,
                marginBottom: 10,
                opacity: loading || !googleRequest ? 0.6 : 1,
              }}
            >
              <Ionicons name="logo-google" size={18} color="#DB4437" style={{ marginRight: 8 }} />
              <Text style={{ color: "#2c3e50", fontWeight: "700", fontSize: 15 }}>
                Continue with Google
              </Text>
            </Pressable>}

            {/* Divider */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
              <Text style={{ color: "#5a7a94", fontSize: 12, marginHorizontal: 10 }}>or</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
            </View>

            {/* Email Sign-In */}
            <Pressable
              onPress={handleLogin}
              disabled={loading || !canSubmit}
              style={{
                backgroundColor: canSubmit ? "#4A9EDB" : "rgba(74,158,219,0.3)",
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{
                  color: canSubmit ? "#ffffff" : "rgba(255,255,255,0.4)",
                  fontWeight: "700",
                  fontSize: 16,
                }}>
                  Sign In
                </Text>
              )}
            </Pressable>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
