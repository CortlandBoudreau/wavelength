import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Linking } from "react-native";
import { useAuth } from "../context/AuthContext";
import { usePurchase } from "../context/PurchaseContext";
import { updateProfile, changePassword, deleteAccount, sendVerificationEmail, verifyEmail } from "../api/auth";
import { sendDigest } from "../api/digest";
import { redeemCode } from "../api/subscription";
import { submitFeedback, type FeedbackType } from "../api/feedback";
import { ALL_CATEGORIES, categoryEmoji, formatCategory } from "../utils/categories";
import type { RootStackParamList } from "../navigation/AppNavigator";

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: "#1a2a3a",
        fontWeight: "700",
        fontSize: 13,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        marginBottom: 12,
      }}
    >
      {children}
    </Text>
  );
}

export default function Profile() {
  const { user, logout, isGuest, guestInterests, completeOnboarding } = useAuth();
  const { logOutRevenueCat, restorePurchases } = usePurchase();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [interests, setInterests] = useState<string[]>(
    isGuest ? guestInterests : (user?.interests ?? [])
  );
  const [hashtagInput, setHashtagInput] = useState("");
  const [includes, setIncludes] = useState<string[]>(user?.hashtag_includes ?? []);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("general");
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Change password
  const [changePwVisible, setChangePwVisible] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  // Delete account
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Email verification
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [verifyOtp, setVerifyOtp] = useState("");
  const [sendingVerify, setSendingVerify] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Restore purchases
  const [restoring, setRestoring] = useState(false);

  const sub = user
    ? { tier: user.subscription_tier, expiresAt: user.subscription_expires_at }
    : null;

  const subLabel = (() => {
    if (!sub) return null;
    if (sub.tier === "lifetime") return { text: "Lifetime Access", color: "#f59e0b" };
    if (sub.tier === "pro") {
      const exp = sub.expiresAt ? new Date(sub.expiresAt) : null;
      const active = exp && exp > new Date();
      return active
        ? { text: `Pro · expires ${exp!.toLocaleDateString()}`, color: "#4A9EDB" }
        : { text: "Pro expired", color: "#b91c1c" };
    }
    if (sub.tier === "trial") {
      const exp = sub.expiresAt ? new Date(sub.expiresAt) : null;
      const active = exp && exp > new Date();
      const daysLeft = exp ? Math.max(0, Math.ceil((exp.getTime() - Date.now()) / 86400000)) : 0;
      return active
        ? { text: `Trial · ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`, color: "#10b981" }
        : { text: "Trial expired", color: "#b91c1c" };
    }
    return { text: "Free", color: "#6b7a8d" };
  })();

  const handleRedeem = async () => {
    if (!promoInput.trim()) return;
    setRedeeming(true);
    try {
      const result = await redeemCode(promoInput.trim());
      Alert.alert("Code redeemed!", `You now have ${result.label} access.`);
      setPromoInput("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not redeem code";
      Alert.alert("Invalid code", msg);
    } finally {
      setRedeeming(false);
    }
  };

  const toggleCategory = (cat: string) =>
    setInterests((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const addInclude = () => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (tag && !includes.includes(tag)) setIncludes((p) => [...p, tag]);
    setHashtagInput("");
  };

  const save = async () => {
    setSaving(true);
    try {
      if (isGuest) {
        await completeOnboarding(interests);
      } else {
        await updateProfile({ interests, hashtag_includes: includes });
      }
      Alert.alert("Saved", "Your topics have been updated.");
    } catch {
      Alert.alert("Error", "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendDigest = async () => {
    setSending(true);
    try {
      await sendDigest();
      Alert.alert("Digest sent", "Check your email.");
    } catch {
      Alert.alert("Error", "Could not send digest.");
    } finally {
      setSending(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (feedbackText.trim().length < 5) return;
    setSubmittingFeedback(true);
    try {
      await submitFeedback(feedbackType, feedbackText.trim());
      setFeedbackVisible(false);
      setFeedbackText("");
      setFeedbackType("general");
      Alert.alert("Thanks! 🙏", "Your feedback has been received.");
    } catch {
      Alert.alert("Error", "Could not send feedback. Please try again.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPw.length < 8 || newPw !== confirmPw) return;
    setChangingPw(true);
    try {
      await changePassword(currentPw, newPw);
      setChangePwVisible(false);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      Alert.alert("Password updated", "Your password has been changed.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change password";
      Alert.alert("Error", msg);
    } finally {
      setChangingPw(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This will permanently delete your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", style: "destructive", onPress: () => setDeleteVisible(true) },
      ]
    );
  };

  const handleConfirmDelete = async () => {
    if (!deletePw) return;
    setDeleting(true);
    try {
      await deleteAccount(deletePw);
      await logOutRevenueCat();
      await logout();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete account";
      Alert.alert("Error", msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleSendVerification = async () => {
    setSendingVerify(true);
    try {
      await sendVerificationEmail();
      setVerifyVisible(true);
    } catch {
      Alert.alert("Error", "Could not send verification email. Please try again.");
    } finally {
      setSendingVerify(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (verifyOtp.length !== 6) return;
    setVerifyingOtp(true);
    try {
      await verifyEmail(verifyOtp);
      setVerifyVisible(false);
      setVerifyOtp("");
      Alert.alert("Email verified ✓", "Your email address has been verified.");
    } catch {
      Alert.alert("Error", "Invalid or expired code. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleRestorePurchases = async () => {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      const hasPro = !!info.entitlements.active["pro"];
      Alert.alert(
        hasPro ? "Purchases restored ✓" : "Nothing to restore",
        hasPro ? "Your Pro subscription has been restored." : "No active purchases found for this account."
      );
    } catch {
      Alert.alert("Error", "Could not restore purchases. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  const FEEDBACK_TYPES: { value: FeedbackType; label: string; emoji: string }[] = [
    { value: "bug",     label: "Bug Report",       emoji: "🐛" },
    { value: "feature", label: "Feature Request",  emoji: "✨" },
    { value: "general", label: "General Feedback", emoji: "💬" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#1a2a3a" }}>
      {/* Feedback Modal */}
      <Modal
        visible={feedbackVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFeedbackVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#1a2a3a", padding: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "800" }}>Send Feedback</Text>
            <Pressable onPress={() => setFeedbackVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color="#7a96ae" />
            </Pressable>
          </View>

          {/* Type selector */}
          <Text style={{ color: "#7a96ae", fontSize: 12, fontWeight: "600", letterSpacing: 0.8, marginBottom: 10 }}>TYPE</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {FEEDBACK_TYPES.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setFeedbackType(t.value)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
                  backgroundColor: feedbackType === t.value ? "#4A9EDB" : "rgba(255,255,255,0.07)",
                  borderWidth: 1.5,
                  borderColor: feedbackType === t.value ? "#4A9EDB" : "rgba(255,255,255,0.1)",
                }}
              >
                <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                <Text style={{ color: feedbackType === t.value ? "#fff" : "#7a96ae", fontSize: 11, marginTop: 3, fontWeight: "600" }}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Message */}
          <Text style={{ color: "#7a96ae", fontSize: 12, fontWeight: "600", letterSpacing: 0.8, marginBottom: 10 }}>MESSAGE</Text>
          <TextInput
            style={{
              backgroundColor: "rgba(255,255,255,0.07)",
              borderWidth: 1.5,
              borderColor: feedbackText.trim().length >= 5 ? "#4A9EDB" : "rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 14,
              color: "#ffffff",
              fontSize: 15,
              lineHeight: 22,
              minHeight: 140,
              textAlignVertical: "top",
              marginBottom: 20,
            }}
            placeholder={
              feedbackType === "bug"
                ? "Describe what happened and how to reproduce it..."
                : feedbackType === "feature"
                ? "What would you like to see added?"
                : "Tell us what you think..."
            }
            placeholderTextColor="#4a6a84"
            multiline
            value={feedbackText}
            onChangeText={setFeedbackText}
          />

          <Pressable
            onPress={handleFeedbackSubmit}
            disabled={submittingFeedback || feedbackText.trim().length < 5}
            style={{
              backgroundColor: feedbackText.trim().length >= 5 ? "#4A9EDB" : "rgba(74,158,219,0.3)",
              borderRadius: 12, paddingVertical: 15, alignItems: "center",
            }}
          >
            {submittingFeedback
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 15 }}>Send Feedback</Text>
            }
          </Pressable>
        </View>
      </Modal>
      {/* ── Change Password Modal ──────────────────────────── */}
      <Modal visible={changePwVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setChangePwVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "#1a2a3a", padding: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "800" }}>Change Password</Text>
            <Pressable onPress={() => setChangePwVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color="#7a96ae" />
            </Pressable>
          </View>
          {(["Current password", "New password (min 8 chars)", "Confirm new password"] as const).map((placeholder, i) => (
            <TextInput
              key={placeholder}
              style={{
                backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1.5,
                borderColor: i === 2 && confirmPw.length > 0 && newPw !== confirmPw ? "#e05c5c" : "rgba(255,255,255,0.15)",
                borderRadius: 12, padding: 14, color: "#ffffff", fontSize: 15, marginBottom: 12,
              }}
              placeholder={placeholder} placeholderTextColor="#4a6a84"
              secureTextEntry
              value={i === 0 ? currentPw : i === 1 ? newPw : confirmPw}
              onChangeText={i === 0 ? setCurrentPw : i === 1 ? setNewPw : setConfirmPw}
            />
          ))}
          {confirmPw.length > 0 && newPw !== confirmPw && (
            <Text style={{ color: "#e05c5c", fontSize: 12, marginBottom: 8 }}>Passwords don't match</Text>
          )}
          <Pressable
            onPress={handleChangePassword}
            disabled={changingPw || newPw.length < 8 || newPw !== confirmPw || !currentPw}
            style={{ backgroundColor: newPw.length >= 8 && newPw === confirmPw && currentPw ? "#4A9EDB" : "rgba(74,158,219,0.3)", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8 }}
          >
            {changingPw ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 15 }}>Update Password</Text>}
          </Pressable>
        </View>
      </Modal>

      {/* ── Delete Account Modal ───────────────────────────── */}
      <Modal visible={deleteVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDeleteVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "#1a2a3a", padding: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={{ color: "#e05c5c", fontSize: 20, fontWeight: "800" }}>Delete Account</Text>
            <Pressable onPress={() => setDeleteVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color="#7a96ae" />
            </Pressable>
          </View>
          <Text style={{ color: "#7a96ae", fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
            Enter your password to permanently delete your account. All your data — stories, notes, and settings — will be removed and cannot be recovered.
          </Text>
          <TextInput
            style={{ backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 14, color: "#ffffff", fontSize: 15, marginBottom: 20 }}
            placeholder="Your password" placeholderTextColor="#4a6a84"
            secureTextEntry value={deletePw} onChangeText={setDeletePw}
          />
          <Pressable
            onPress={handleConfirmDelete}
            disabled={deleting || !deletePw}
            style={{ backgroundColor: deletePw ? "#b91c1c" : "rgba(185,28,28,0.3)", borderRadius: 12, paddingVertical: 15, alignItems: "center" }}
          >
            {deleting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 15 }}>Permanently Delete Account</Text>}
          </Pressable>
        </View>
      </Modal>

      {/* ── Email Verify Modal ─────────────────────────────── */}
      <Modal visible={verifyVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setVerifyVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "#1a2a3a", padding: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "800" }}>Verify Email</Text>
            <Pressable onPress={() => setVerifyVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color="#7a96ae" />
            </Pressable>
          </View>
          <Text style={{ color: "#7a96ae", fontSize: 14, marginBottom: 24 }}>Enter the 6-digit code we sent to {user?.email}.</Text>
          <TextInput
            style={{ backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 14, color: "#ffffff", fontSize: 24, letterSpacing: 8, textAlign: "center", marginBottom: 20 }}
            placeholder="000000" placeholderTextColor="#4a6a84"
            keyboardType="number-pad" maxLength={6}
            value={verifyOtp} onChangeText={setVerifyOtp}
          />
          <Pressable
            onPress={handleVerifyOtp}
            disabled={verifyingOtp || verifyOtp.length !== 6}
            style={{ backgroundColor: verifyOtp.length === 6 ? "#4A9EDB" : "rgba(74,158,219,0.3)", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 12 }}
          >
            {verifyingOtp ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 15 }}>Verify</Text>}
          </Pressable>
          <Pressable onPress={handleSendVerification} style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ color: "#4A9EDB", fontSize: 14 }}>Resend code</Text>
          </Pressable>
        </View>
      </Modal>

      <SafeAreaView style={{ flex: 1, backgroundColor: "#1a2a3a" }} edges={["top", "left", "right"]}>
        <ScrollView
          style={{ flex: 1, backgroundColor: "#F5F0E8" }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ─────────────────────────────────── */}
          <View style={{ backgroundColor: "#1a2a3a", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: "rgba(74,158,219,0.25)",
              alignItems: "center", justifyContent: "center", marginBottom: 12,
            }}>
              <Ionicons name={isGuest ? "person-outline" : "person"} size={28} color="#4A9EDB" />
            </View>
            <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "700" }}>
              {isGuest ? "Guest" : (user?.name ?? "Account")}
            </Text>
            <Text style={{ color: "#7a96ae", fontSize: 13, marginTop: 3 }}>
              {isGuest ? "Browsing as guest" : (user?.email ?? "")}
            </Text>
          </View>

          {/* ── Content ────────────────────────────────── */}
          <View style={{ padding: 16, marginTop: -10 }}>

            {/* Subscription status — logged-in users only */}
            {!isGuest && subLabel && (
              <SectionCard>
                <SectionLabel>Subscription</SectionLabel>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                  <View style={{
                    width: 10, height: 10, borderRadius: 5,
                    backgroundColor: subLabel.color, marginRight: 8,
                  }} />
                  <Text style={{ color: subLabel.color, fontWeight: "700", fontSize: 14, flex: 1 }}>
                    {subLabel.text}
                  </Text>
                </View>

                {/* Upgrade button — shown when not active */}
                {(sub?.tier === "free" ||
                  (sub?.tier === "trial" && sub?.expiresAt && new Date(sub.expiresAt) <= new Date()) ||
                  (sub?.tier === "pro"   && sub?.expiresAt && new Date(sub.expiresAt) <= new Date())
                ) && (
                  <Pressable
                    onPress={() => navigation.navigate("Paywall")}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? "#2c7cb8" : "#4A9EDB",
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: "center",
                      marginBottom: 14,
                    })}
                  >
                    <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 14 }}>
                      ⚡ Upgrade to Pro
                    </Text>
                  </Pressable>
                )}

                {/* Trial active — show upgrade nudge */}
                {sub?.tier === "trial" &&
                  sub?.expiresAt && new Date(sub.expiresAt) > new Date() && (
                  <Pressable
                    onPress={() => navigation.navigate("Paywall")}
                    style={{
                      borderWidth: 1.5, borderColor: "#4A9EDB",
                      borderRadius: 10, paddingVertical: 10,
                      alignItems: "center", marginBottom: 14,
                    }}
                  >
                    <Text style={{ color: "#4A9EDB", fontWeight: "600", fontSize: 13 }}>
                      Subscribe before trial ends
                    </Text>
                  </Pressable>
                )}

                {/* Promo code input — hide if already lifetime */}
                {sub?.tier !== "lifetime" && (
                  <>
                    <Text style={{ color: "#6b7a8d", fontSize: 12, marginBottom: 8 }}>
                      Have a promo code? Enter it below.
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <TextInput
                        style={{
                          flex: 1,
                          backgroundColor: "#f0f4f8",
                          borderWidth: 2, borderColor: "#b0bec5",
                          borderRadius: 10,
                          paddingHorizontal: 14, paddingVertical: 10,
                          color: "#1a2a3a", fontSize: 14, fontWeight: "600",
                          letterSpacing: 1.5,
                        }}
                        placeholder="PROMO CODE"
                        placeholderTextColor="#9aafc0"
                        autoCapitalize="characters"
                        value={promoInput}
                        onChangeText={setPromoInput}
                        onSubmitEditing={handleRedeem}
                      />
                      <Pressable
                        onPress={handleRedeem}
                        disabled={redeeming || !promoInput.trim()}
                        style={{
                          backgroundColor: promoInput.trim() ? "#4A9EDB" : "#b0bec5",
                          borderRadius: 10,
                          paddingHorizontal: 16, paddingVertical: 10,
                        }}
                      >
                        {redeeming
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={{ color: "#fff", fontWeight: "700" }}>Redeem</Text>
                        }
                      </Pressable>
                    </View>
                  </>
                )}
              </SectionCard>
            )}

            {/* Guest upgrade banner */}
            {isGuest && (
              <Pressable
                onPress={logout}
                style={{
                  backgroundColor: "#1a2a3a",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: "rgba(74,158,219,0.2)",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name="star-outline" size={18} color="#4A9EDB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 14 }}>
                    Create a free account
                  </Text>
                  <Text style={{ color: "#7a96ae", fontSize: 12, marginTop: 2 }}>
                    Save stories, add notes & get email digests
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#4A9EDB" />
              </Pressable>
            )}

            {/* Interests — visible to everyone */}
            <SectionCard>
              <SectionLabel>My Topics</SectionLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ALL_CATEGORIES.map((cat) => {
                  const active = interests.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => toggleCategory(cat)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 20,
                        backgroundColor: active ? "#4A9EDB" : "#f0f4f8",
                        borderWidth: 2,
                        borderColor: active ? "#4A9EDB" : "#b0bec5",
                      }}
                    >
                      <Text style={{
                        color: active ? "#ffffff" : "#1a2a3a",
                        fontSize: 13,
                        fontWeight: "700",
                      }}>
                        {categoryEmoji(cat)} {formatCategory(cat)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </SectionCard>

            {/* Hashtag Filters — logged-in only */}
            {!isGuest && (
              <SectionCard>
                <SectionLabel>Hashtag Filters</SectionLabel>
                <Text style={{ color: "#6b7a8d", fontSize: 12, marginBottom: 10, lineHeight: 17 }}>
                  Stories containing these hashtags will be prioritised in your feed.
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: "#f0f4f8",
                      borderWidth: 2,
                      borderColor: "#b0bec5",
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 11,
                      color: "#1a2a3a",
                      fontSize: 14,
                      fontWeight: "600",
                      marginRight: 8,
                    }}
                    placeholder="#science"
                    placeholderTextColor="#9aafc0"
                    value={hashtagInput}
                    onChangeText={setHashtagInput}
                    onSubmitEditing={addInclude}
                  />
                  <Pressable
                    onPress={addInclude}
                    style={{ backgroundColor: "#4A9EDB", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 }}
                  >
                    <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 14 }}>Add</Text>
                  </Pressable>
                </View>
                {includes.length === 0 ? (
                  <Text style={{ color: "#9aafc0", fontSize: 13, fontStyle: "italic" }}>
                    No hashtag filters added yet.
                  </Text>
                ) : (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {includes.map((tag) => (
                      <Pressable
                        key={tag}
                        onPress={() => setIncludes((p) => p.filter((t) => t !== tag))}
                        style={{
                          flexDirection: "row", alignItems: "center",
                          backgroundColor: "#e8f4fd",
                          borderWidth: 1.5, borderColor: "#4A9EDB",
                          borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 5,
                        }}
                      >
                        <Text style={{ color: "#0f6fa3", fontSize: 13, fontWeight: "700" }}>#{tag}</Text>
                        <Ionicons name="close-circle" size={15} color="#4A9EDB" />
                      </Pressable>
                    ))}
                  </View>
                )}
              </SectionCard>
            )}

            {/* Save */}
            <Pressable
              onPress={save}
              disabled={saving}
              style={{
                backgroundColor: "#4A9EDB",
                borderRadius: 12, paddingVertical: 15,
                alignItems: "center", marginBottom: 12,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 15 }}>
                  Save Topics
                </Text>
              )}
            </Pressable>

            {/* Email digest — logged-in only */}
            {!isGuest && (
              <Pressable
                onPress={handleSendDigest}
                disabled={sending}
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 2, borderColor: "#4A9EDB",
                  borderRadius: 12, paddingVertical: 15,
                  alignItems: "center", marginBottom: 28,
                }}
              >
                {sending ? (
                  <ActivityIndicator color="#4A9EDB" />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <Ionicons name="mail-outline" size={17} color="#4A9EDB" />
                    <Text style={{ color: "#4A9EDB", fontWeight: "700", fontSize: 15 }}>
                      Send Email Digest
                    </Text>
                  </View>
                )}
              </Pressable>
            )}

            {/* Feedback */}
            <Pressable
              onPress={() => setFeedbackVisible(true)}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 7, paddingVertical: 12, marginBottom: 4,
              }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#4A9EDB" />
              <Text style={{ color: "#4A9EDB", fontSize: 14, fontWeight: "600" }}>
                Send Feedback or Report a Bug
              </Text>
            </Pressable>

            {/* Email unverified banner */}
            {!isGuest && user && !user.email_verified && (
              <Pressable
                onPress={handleSendVerification}
                disabled={sendingVerify}
                style={{ backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1.5, borderColor: "#f59e0b", borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Ionicons name="mail-unread-outline" size={20} color="#f59e0b" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#f59e0b", fontWeight: "700", fontSize: 13 }}>Email not verified</Text>
                  <Text style={{ color: "#b89040", fontSize: 12, marginTop: 2 }}>Tap to send a verification code</Text>
                </View>
                {sendingVerify && <ActivityIndicator color="#f59e0b" size="small" />}
              </Pressable>
            )}

            {/* Account section — logged-in only */}
            {!isGuest && (
              <SectionCard>
                <SectionLabel>Account</SectionLabel>
                <Pressable
                  onPress={() => setChangePwVisible(true)}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#e0e7ef" }}
                >
                  <Ionicons name="lock-closed-outline" size={18} color="#4A9EDB" style={{ marginRight: 10 }} />
                  <Text style={{ flex: 1, color: "#1a2a3a", fontSize: 14, fontWeight: "600" }}>Change Password</Text>
                  <Ionicons name="chevron-forward" size={16} color="#b0bec5" />
                </Pressable>
                <Pressable
                  onPress={handleRestorePurchases}
                  disabled={restoring}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#e0e7ef" }}
                >
                  <Ionicons name="refresh-outline" size={18} color="#4A9EDB" style={{ marginRight: 10 }} />
                  <Text style={{ flex: 1, color: "#1a2a3a", fontSize: 14, fontWeight: "600" }}>Restore Purchases</Text>
                  {restoring ? <ActivityIndicator size="small" color="#4A9EDB" /> : <Ionicons name="chevron-forward" size={16} color="#b0bec5" />}
                </Pressable>
                <Pressable
                  onPress={handleDeleteAccount}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#b91c1c" style={{ marginRight: 10 }} />
                  <Text style={{ flex: 1, color: "#b91c1c", fontSize: 14, fontWeight: "600" }}>Delete Account</Text>
                  <Ionicons name="chevron-forward" size={16} color="#b0bec5" />
                </Pressable>
              </SectionCard>
            )}

            {/* Sign out / back to auth */}
            <Pressable
              onPress={async () => { await logOutRevenueCat(); await logout(); }}
              style={{ alignItems: "center", paddingVertical: 10 }}
            >
              <Text style={{ color: "#b91c1c", fontSize: 14, fontWeight: "700" }}>
                {isGuest ? "Sign In / Create Account" : "Log Out"}
              </Text>
            </Pressable>

            {/* Privacy & Terms links */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 20, paddingVertical: 12 }}>
              <Pressable onPress={() => Linking.openURL("https://wavelength-staging.up.railway.app/privacy")}>
                <Text style={{ color: "#5a7a94", fontSize: 12 }}>Privacy Policy</Text>
              </Pressable>
              <Text style={{ color: "#3a5a74", fontSize: 12 }}>·</Text>
              <Pressable onPress={() => Linking.openURL("https://wavelength-staging.up.railway.app/terms")}>
                <Text style={{ color: "#5a7a94", fontSize: 12 }}>Terms of Service</Text>
              </Pressable>
            </View>

          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
