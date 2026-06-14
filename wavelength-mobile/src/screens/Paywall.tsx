import React, { useState } from "react";
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Alert, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { PurchasesPackage } from "react-native-purchases";
import WaveLogo from "../components/WaveLogo";
import { usePurchase } from "../context/PurchaseContext";
import { useAuth } from "../context/AuthContext";
import { syncRevenueCatPurchase, redeemCode } from "../api/subscription";

interface Props {
  navigation: { goBack: () => void };
}

const FEATURES = [
  { icon: "newspaper-outline",     text: "Unlimited daily science stories" },
  { icon: "sparkles-outline",      text: "AI summaries, angles & hashtags" },
  { icon: "star-outline",          text: "Save, annotate & track stories" },
  { icon: "mail-outline",          text: "Daily personalised email digest" },
  { icon: "options-outline",       text: "Advanced hashtag filters" },
  { icon: "ban-outline",           text: "No ads" },
];

export default function Paywall({ navigation }: Props) {
  const { offerings, purchasing, purchasePackage, restorePurchases, loading } = usePurchase();
  const { refreshUser } = useAuth();
  const [promoInput, setPromoInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Grab the default offering's monthly package (or the first package available)
  const monthlyPackage: PurchasesPackage | null =
    offerings?.current?.monthly ??
    offerings?.current?.availablePackages?.[0] ??
    null;

  const priceString = monthlyPackage?.product.priceString ?? "$2.99";

  const handleSubscribe = async () => {
    if (!monthlyPackage) {
      Alert.alert(
        "Unavailable",
        "In-app purchases are not available right now. Please try again later or use a promo code."
      );
      return;
    }
    try {
      const info = await purchasePackage(monthlyPackage);
      // Sync the purchase to our backend so subscription_tier updates in the DB
      const subs = Object.keys(info.activeSubscriptions ?? {});
      const entitlement = info.entitlements.active["pro"];
      const expiresAt = entitlement?.expirationDate ?? null;
      await syncRevenueCatPurchase(subs, expiresAt);
      await refreshUser();
      Alert.alert(
        "Welcome to Pro! 🎉",
        "Your subscription is now active. Enjoy unlimited access.",
        [{ text: "Let's go!", onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      // USER_CANCELLED is not an error — just do nothing
      if (e?.userCancelled || e?.code === "1") return;
      Alert.alert("Purchase failed", e?.message ?? "Something went wrong. Please try again.");
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      const subs = Object.keys(info.activeSubscriptions ?? {});
      if (subs.length > 0) {
        const entitlement = info.entitlements.active["pro"];
        const expiresAt = entitlement?.expirationDate ?? null;
        await syncRevenueCatPurchase(subs, expiresAt);
        await refreshUser();
        Alert.alert("Restored!", "Your Pro subscription has been restored.", [
          { text: "Great!", onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert("Nothing to restore", "No active subscription found for this account.");
      }
    } catch (e: any) {
      Alert.alert("Restore failed", e?.message ?? "Could not restore purchases.");
    } finally {
      setRestoring(false);
    }
  };

  const handleRedeem = async () => {
    if (!promoInput.trim()) return;
    setRedeeming(true);
    try {
      const result = await redeemCode(promoInput.trim());
      await refreshUser();
      Alert.alert("Code redeemed! 🎉", `You now have ${result.label} access.`, [
        { text: "Awesome!", onPress: () => navigation.goBack() },
      ]);
      setPromoInput("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not redeem code";
      Alert.alert("Invalid code", msg);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0f1e2d" }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Nav bar */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="close" size={26} color="#7ec8f0" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={{ alignItems: "center", marginTop: 8, marginBottom: 32 }}>
            <WaveLogo size="md" />
            <Text style={{ color: "#ffffff", fontSize: 28, fontWeight: "800", marginTop: 20, textAlign: "center" }}>
              WaveLength Pro
            </Text>
            <Text style={{ color: "#7a96ae", fontSize: 15, marginTop: 8, textAlign: "center", lineHeight: 22 }}>
              Everything you need to create science content that converts.
            </Text>
          </View>

          {/* Features */}
          <View style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: "rgba(74,158,219,0.2)",
          }}>
            {FEATURES.map((f, i) => (
              <View key={f.text} style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingVertical: 10,
                borderBottomWidth: i < FEATURES.length - 1 ? 1 : 0,
                borderBottomColor: "rgba(255,255,255,0.06)",
              }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: "rgba(74,158,219,0.15)",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name={f.icon as any} size={18} color="#4A9EDB" />
                </View>
                <Text style={{ color: "#c8d8e8", fontSize: 14, flex: 1 }}>{f.text}</Text>
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
              </View>
            ))}
          </View>

          {/* Price card */}
          <View style={{
            backgroundColor: "rgba(74,158,219,0.12)",
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1.5,
            borderColor: "#4A9EDB",
            alignItems: "center",
          }}>
            <Text style={{ color: "#7a96ae", fontSize: 13, marginBottom: 4 }}>MONTHLY SUBSCRIPTION</Text>
            {loading ? (
              <ActivityIndicator color="#4A9EDB" style={{ marginVertical: 8 }} />
            ) : (
              <Text style={{ color: "#ffffff", fontSize: 36, fontWeight: "800" }}>
                {priceString}
                <Text style={{ fontSize: 16, fontWeight: "400", color: "#7a96ae" }}> / month</Text>
              </Text>
            )}
            <Text style={{ color: "#22c55e", fontSize: 13, marginTop: 6, fontWeight: "600" }}>
              ✓ Cancel anytime
            </Text>
          </View>

          {/* Subscribe button */}
          <Pressable
            onPress={handleSubscribe}
            disabled={purchasing}
            style={({ pressed }) => ({
              backgroundColor: purchasing ? "rgba(74,158,219,0.4)" : (pressed ? "#2c7cb8" : "#4A9EDB"),
              borderRadius: 14,
              paddingVertical: 17,
              alignItems: "center",
              marginBottom: 14,
            })}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 17 }}>
                Subscribe — {priceString}/mo
              </Text>
            )}
          </Pressable>

          {/* Restore */}
          <Pressable
            onPress={handleRestore}
            disabled={restoring}
            style={{ alignItems: "center", paddingVertical: 10, marginBottom: 28 }}
          >
            {restoring ? (
              <ActivityIndicator color="#7a96ae" size="small" />
            ) : (
              <Text style={{ color: "#7a96ae", fontSize: 13 }}>Restore previous purchase</Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
            <Text style={{ color: "#5a7a94", fontSize: 12 }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
          </View>

          {/* Promo code */}
          <Text style={{ color: "#a0b4c8", fontSize: 14, fontWeight: "600", marginBottom: 10 }}>
            Have a promo code?
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <TextInput
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.07)",
                borderWidth: 1.5,
                borderColor: promoInput.trim() ? "#4A9EDB" : "rgba(255,255,255,0.15)",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 13,
                color: "#ffffff",
                fontSize: 15,
                fontWeight: "700",
                letterSpacing: 2,
              }}
              placeholder="ENTER CODE"
              placeholderTextColor="#4a6a84"
              autoCapitalize="characters"
              value={promoInput}
              onChangeText={setPromoInput}
              onSubmitEditing={handleRedeem}
            />
            <Pressable
              onPress={handleRedeem}
              disabled={redeeming || !promoInput.trim()}
              style={{
                backgroundColor: promoInput.trim() ? "#4A9EDB" : "rgba(74,158,219,0.2)",
                borderRadius: 12,
                paddingHorizontal: 18,
                justifyContent: "center",
              }}
            >
              {redeeming
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: promoInput.trim() ? "#fff" : "#4a6a84", fontWeight: "700", fontSize: 14 }}>
                    Apply
                  </Text>
              }
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
