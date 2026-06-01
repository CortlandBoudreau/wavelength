import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import WaveLogo from "../components/WaveLogo";
import { useAuth } from "../context/AuthContext";

import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { AuthStackParamList } from "../navigation/AuthStack";

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Register">;
  route: RouteProp<AuthStackParamList, "Register">;
}

export default function Register({ navigation, route }: Props) {
  const { register } = useAuth();
  const interests = route.params?.interests ?? [];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;
  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    password === confirmPassword;

  const handleRegister = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await register(email.trim(), name.trim(), password, interests.length > 0 ? interests : undefined);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      Alert.alert("Registration failed", msg);
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
              Almost there!
            </Text>
            <Text style={{ color: "#7a96ae", fontSize: 14, marginBottom: 28 }}>
              {interests.length > 0
                ? `${interests.length} topic${interests.length !== 1 ? "s" : ""} selected — create your account to save them`
                : "Fill in your details to get started"}
            </Text>

            <TextInput
              style={inputStyle}
              placeholder="Name"
              placeholderTextColor="#6b7a8d"
              autoCapitalize="words"
              returnKeyType="next"
              value={name}
              onChangeText={setName}
            />
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
              style={inputStyle}
              placeholder="Password (min 8 characters)"
              placeholderTextColor="#6b7a8d"
              secureTextEntry
              returnKeyType="next"
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              style={{
                ...inputStyle,
                marginBottom: 4,
                borderColor: !passwordsMatch ? "#e05c5c" : "#e0e7ef",
              }}
              placeholder="Confirm password"
              placeholderTextColor="#6b7a8d"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {!passwordsMatch && (
              <Text style={{ color: "#e05c5c", fontSize: 12, marginBottom: 8 }}>
                Passwords don't match
              </Text>
            )}

            <Text style={{ color: "#5a7a94", fontSize: 12, marginBottom: 24, marginTop: 8 }}>
              You'll get a free 7-day trial — no credit card needed.
            </Text>

            <Pressable
              onPress={() => navigation.navigate("Login")}
              style={{ alignItems: "center", paddingVertical: 10 }}
            >
              <Text style={{ color: "#7a96ae", fontSize: 14 }}>
                Already have an account?{" "}
                <Text style={{ color: "#4A9EDB", fontWeight: "600" }}>Sign In</Text>
              </Text>
            </Pressable>
          </ScrollView>

          {/* Fixed footer — always visible above keyboard */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8, backgroundColor: "#0f1e2d" }}>
            <Pressable
              onPress={handleRegister}
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
                  Create Account
                </Text>
              )}
            </Pressable>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
