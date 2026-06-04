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

const STEPS: Step[] = ["email", "otp", "password"];

export default function ForgotPassword({ navigation }: Props) {
  const [step, setStep]                     = useState<Step>("email");
  const [email, setEmail]                   = useState("");
  const [otp, setOtp]                       = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]               = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;
  const stepIndex = STEPS.indexOf(step);

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
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown) return;
    setResendCooldown(true);
    try {
      await forgotPassword(email.trim());
      Alert.alert("Code resent", `A new code was sent to ${email}.`);
    } catch {
      Alert.alert("Error", "Could not resend. Please try again.");
    } finally {
      // 60-second cooldown before they can resend again
      setTimeout(() => setResendCooldown(false), 60_000);
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
      Alert.alert(
        "Password reset ✓",
        "Your password has been updated. Please sign in.",
        [{ text: "Sign in", onPress: () => navigation.navigate("Login") }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    step === "email"    ? email.trim().length > 0 :
    step === "otp"      ? otp.length === 6 :
    password.length >= 8 && password === confirmPassword;

  const handleSubmit =
    step === "email"    ? handleSendCode :
    step === "otp"      ? handleVerifyOtp :
    handleResetPassword;

  // Per-step button config
  const buttonConfig = {
    email: {
      icon:  "mail" as const,
      label: "Send reset code",
      color: "#4A9EDB",
    },
    otp: {
      icon:  "arrow-forward-circle" as const,
      label: "Continue",
      color: "#4A9EDB",
    },
    password: {
      icon:  "lock-closed" as const,
      label: "Reset password",
      color: "#22c55e",
    },
  } as const;

  const btn = buttonConfig[step];

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
            {/* Back arrow */}
            <Pressable
              onPress={() =>
                step === "email"
                  ? navigation.goBack()
                  : setStep(step === "otp" ? "email" : "otp")
              }
              hitSlop={8}
              style={{ paddingTop: 8, paddingBottom: 4 }}
            >
              <Ionicons name="arrow-back" size={24} color="#7ec8f0" />
            </Pressable>

            {/* Logo */}
            <View style={{ alignItems: "center", marginTop: 24, marginBottom: 28 }}>
              <WaveLogo size="md" />
            </View>

            {/* Step indicator */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 28 }}>
              {STEPS.map((s, i) => (
                <View
                  key={s}
                  style={{
                    height: 4,
                    flex: 1,
                    borderRadius: 2,
                    backgroundColor:
                      i < stepIndex  ? "#4A9EDB" :
                      i === stepIndex ? "#7ec8f0" :
                      "rgba(255,255,255,0.12)",
                  }}
                />
              ))}
            </View>

            {/* Step icon + heading */}
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor:
                  step === "password" ? "rgba(34,197,94,0.15)" : "rgba(74,158,219,0.15)",
                alignItems: "center", justifyContent: "center", marginBottom: 14,
              }}>
                <Ionicons
                  name={btn.icon}
                  size={26}
                  color={step === "password" ? "#22c55e" : "#4A9EDB"}
                />
              </View>
              <Text style={{ color: "#ffffff", fontSize: 22, fontWeight: "800", textAlign: "center" }}>
                {step === "email"    ? "Forgot password?" :
                 step === "otp"      ? "Check your email" :
                 "New password"}
              </Text>
              <Text style={{ color: "#7a96ae", fontSize: 14, marginTop: 6, textAlign: "center", lineHeight: 20 }}>
                {step === "email"
                  ? "Enter your email and we'll send\na 6-digit reset code."
                  : step === "otp"
                  ? `We sent a code to\n${email}`
                  : "Choose a new password\n(at least 8 characters)"}
              </Text>
            </View>

            {/* ── Email step ─────────────────────────────── */}
            {step === "email" && (
              <TextInput
                style={inputStyle}
                placeholder="Email address"
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

            {/* ── OTP step ───────────────────────────────── */}
            {step === "otp" && (
              <>
                <TextInput
                  style={{
                    ...inputStyle,
                    letterSpacing: 12,
                    textAlign: "center",
                    fontSize: 26,
                    fontWeight: "700",
                    paddingVertical: 18,
                  }}
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
                <Text style={{ color: "#5a7a94", fontSize: 12, textAlign: "center", marginBottom: 8 }}>
                  Code expires in 15 minutes
                </Text>
                <Pressable
                  onPress={handleResend}
                  disabled={resendCooldown}
                  style={{ alignItems: "center", paddingVertical: 10 }}
                >
                  <Text style={{
                    color: resendCooldown ? "#3a5a74" : "#4A9EDB",
                    fontSize: 14, fontWeight: "600",
                  }}>
                    {resendCooldown ? "Code sent — wait 60s to resend" : "Didn't get it? Resend code"}
                  </Text>
                </Pressable>
              </>
            )}

            {/* ── Password step ──────────────────────────── */}
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

          {/* ── Fixed footer button ──────────────────────── */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8, backgroundColor: "#0f1e2d" }}>
            <Pressable
              onPress={handleSubmit}
              disabled={loading || !canSubmit}
              style={({ pressed }) => ({
                backgroundColor: canSubmit
                  ? pressed ? btn.color + "cc" : btn.color
                  : "rgba(255,255,255,0.08)",
                borderRadius: 14,
                paddingVertical: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={btn.icon}
                    size={18}
                    color={canSubmit ? "#ffffff" : "rgba(255,255,255,0.3)"}
                  />
                  <Text style={{
                    color: canSubmit ? "#ffffff" : "rgba(255,255,255,0.3)",
                    fontWeight: "700",
                    fontSize: 16,
                  }}>
                    {btn.label}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
