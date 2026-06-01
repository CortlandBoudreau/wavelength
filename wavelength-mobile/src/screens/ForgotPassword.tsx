import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import WaveLogo from "../components/WaveLogo";
import { forgotPassword, resetPassword } from "../api/auth";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/AuthStack";

type Step = "email" | "otp" | "password";

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, "ForgotPassword">;
}

export default function ForgotPassword({ navigation }: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

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

  const handleSendCode = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setStep("otp");
    } catch {
      Alert.alert("Error", "Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) return;
    setStep("password");
  };

  const handleResetPassword = async () => {
    if (password.length < 8 || password !== confirmPassword) return;
    setLoading(true);
    try {
      await resetPassword(email.trim(), otp, password);
      Alert.alert("Password reset", "Your password has been updated. Please sign in.", [
        { text: "Sign in", onPress: () => navigation.navigate("Login") },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const stepTitle = step === "email"
    ? "Forgot password"
    : step === "otp"
    ? "Enter your code"
    : "New password";

  const stepSubtitle = step === "email"
    ? "We'll email you a 6-digit code"
    : step === "otp"
    ? `Code sent to ${email}`
    : "Choose a strong password";

  return (
    <View style={{ flex: 1, backgroundColor: "#0f1e2d" }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              onPress={() => (step === "email" ? navigation.goBack() : setStep(step === "otp" ? "email" : "otp"))}
              hitSlop={8}
              style={{ paddingTop: 8, paddingBottom: 4 }}
            >
              <Ionicons name="arrow-back" size={24} color="#7ec8f0" />
            </Pressable>

            <View style={{ alignItems: "center", marginTop: 24, marginBottom: 32 }}>
              <WaveLogo size="md" />
            </View>

            <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "800", marginBottom: 4 }}>
              {stepTitle}
            </Text>
            <Text style={{ color: "#7a96ae", fontSize: 14, marginBottom: 28 }}>
              {stepSubtitle}
            </Text>

            {step === "email" && (
              <TextInput
                style={inputStyle}
                placeholder="Email"
                placeholderTextColor="#6b7a8d"
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={handleSendCode}
                value={email}
                onChangeText={setEmail}
                autoFocus
              />
            )}

            {step === "otp" && (
              <>
                <TextInput
                  style={{ ...inputStyle, letterSpacing: 8, textAlign: "center", fontSize: 24 }}
                  placeholder="000000"
                  placeholderTextColor="#6b7a8d"
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyOtp}
                  value={otp}
                  onChangeText={setOtp}
                  autoFocus
                />
                <Pressable onPress={handleSendCode} style={{ alignItems: "center", paddingVertical: 8 }}>
                  <Text style={{ color: "#4A9EDB", fontSize: 14 }}>Resend code</Text>
                </Pressable>
              </>
            )}

            {step === "password" && (
              <>
                <TextInput
                  style={inputStyle}
                  placeholder="New password (min 8 characters)"
                  placeholderTextColor="#6b7a8d"
                  secureTextEntry
                  returnKeyType="next"
                  value={password}
                  onChangeText={setPassword}
                  autoFocus
                />
                <TextInput
                  style={{
                    ...inputStyle,
                    marginBottom: 4,
                    borderColor: !passwordsMatch ? "#e05c5c" : "#e0e7ef",
                  }}
                  placeholder="Confirm new password"
                  placeholderTextColor="#6b7a8d"
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleResetPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                {!passwordsMatch && (
                  <Text style={{ color: "#e05c5c", fontSize: 12, marginBottom: 8 }}>
                    Passwords don't match
                  </Text>
                )}
              </>
            )}
          </ScrollView>

          <View style={{ paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8, backgroundColor: "#0f1e2d" }}>
            <Pressable
              onPress={step === "email" ? handleSendCode : step === "otp" ? handleVerifyOtp : handleResetPassword}
              disabled={
                loading ||
                (step === "email" && !email.trim()) ||
                (step === "otp" && otp.length !== 6) ||
                (step === "password" && (password.length < 8 || password !== confirmPassword))
              }
              style={({ pressed }) => ({
                backgroundColor:
                  (step === "email" && !email.trim()) ||
                  (step === "otp" && otp.length !== 6) ||
                  (step === "password" && (password.length < 8 || password !== confirmPassword))
                    ? "rgba(74,158,219,0.3)"
                    : "#4A9EDB",
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 16 }}>
                  {step === "email" ? "Send code" : step === "otp" ? "Continue" : "Reset password"}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
