import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { isProUser } from "../utils/proCheck";
import type { RootStackParamList } from "../navigation/AppNavigator";

interface AnalyticsData {
  totals?: {
    total_stories: number;
    total_favorited: number;
    total_used: number;
  };
  byCategory?: Array<{
    category: string;
    total: number;
    favorited: number;
    used: number;
  }>;
  // legacy flat shape (fallback)
  total_stories?: number;
  favorited?: number;
  used?: number;
  [key: string]: unknown;
}

interface AffinityRow {
  category: string;
  views: number;
  favorites: number;
  posted: number;
  affinity_score: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  space:       "#6366f1",
  biology:     "#22c55e",
  physics:     "#f59e0b",
  environment: "#10b981",
  technology:  "#4A9EDB",
  medicine:    "#ef4444",
  chemistry:   "#f97316",
  general:     "#8b5cf6",
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  space:       "planet-outline",
  biology:     "leaf-outline",
  physics:     "flash-outline",
  environment: "earth-outline",
  technology:  "hardware-chip-outline",
  medicine:    "medical-outline",
  chemistry:   "flask-outline",
  general:     "newspaper-outline",
};

export default function Analytics({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const isGuest = !user;
  const isPro = isProUser(user);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [affinity, setAffinity] = useState<AffinityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [affinityLoading, setAffinityLoading] = useState(true);

  // Hooks must all be declared before any early return.
  // Refetch every time the tab gains focus — the screen stays mounted in the
  // tab navigator, so opening/favouriting/posting stories elsewhere would
  // otherwise leave these stats stale until app restart.
  const load = useCallback(() => {
    if (isGuest) return;
    client
      .get<AnalyticsData>("/analytics")
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    client
      .get<{ affinity: AffinityRow[] }>("/analytics/affinity")
      .then((r) => setAffinity(r.data.affinity ?? []))
      .catch(() => {})
      .finally(() => setAffinityLoading(false));
  }, [isGuest]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Guest upsell — rendered after all hooks are declared
  if (isGuest) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F0E8" }} edges={["top", "left", "right"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: "#e8f4fd",
            alignItems: "center", justifyContent: "center", marginBottom: 20,
          }}>
            <Ionicons name="bar-chart-outline" size={34} color="#4A9EDB" />
          </View>
          <Text style={{ color: "#1a2a3a", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>
            Your interest profile
          </Text>
          <Text style={{ color: "#6b7a8d", fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
            Sign in to track which topics you love and get a smarter, personalised feed.
          </Text>
          <Pressable
            onPress={() => navigation.navigate("Login")}
            style={{ backgroundColor: "#4A9EDB", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 36 }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Normalise to the flat totals shape whether the backend returns nested or flat
  const totals = data?.totals ?? {
    total_stories: data?.total_stories ?? 0,
    total_favorited: (data?.favorited as number) ?? 0,
    total_used: (data?.used as number) ?? 0,
  };

  const statCards = [
    { key: "total_stories", label: "Stories seen",  value: totals.total_stories,  icon: "newspaper-outline"       as const, color: "#4A9EDB" },
    { key: "favorited",     label: "Favourited",     value: totals.total_favorited, icon: "star-outline"            as const, color: "#f59e0b" },
    { key: "used",          label: "Posted",         value: totals.total_used,      icon: "checkmark-circle-outline" as const, color: "#22c55e" },
  ];

  const hasAffinity = affinity.length > 0;
  // Threshold: below 20% affinity → feed-filtered
  const LOW_THRESHOLD = 0.20;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F0E8" }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Text style={{ color: "#2c3e50", fontSize: 22, fontWeight: "700", marginBottom: 4 }}>
          Analytics
        </Text>
        <Text style={{ color: "#6b7a8d", fontSize: 13, marginBottom: 24 }}>
          Your WaveLength stats
        </Text>

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        {loading ? (
          <ActivityIndicator color="#4A9EDB" size="large" style={{ marginTop: 32 }} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
            {statCards.map(({ key, label, value, icon, color }) => (
              <View
                key={key}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: 12,
                  padding: 18,
                  minWidth: 100,
                  flex: 1,
                  elevation: 2,
                  shadowColor: "#000",
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: color + "20",
                  alignItems: "center", justifyContent: "center", marginBottom: 10,
                }}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <Text style={{ color: "#2c3e50", fontSize: 28, fontWeight: "700" }}>
                  {value ?? 0}
                </Text>
                <Text style={{ color: "#6b7a8d", fontSize: 12, marginTop: 2 }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Interest Profile ────────────────────────────────────────────── */}
        <Text style={{ color: "#2c3e50", fontSize: 17, fontWeight: "700", marginBottom: 4 }}>
          Your Interest Profile
        </Text>
        <Text style={{ color: "#6b7a8d", fontSize: 13, marginBottom: 16 }}>
          Based on what you open, favourite, and post — last 30 days.
          Low-interest categories only show high-traction stories.
        </Text>

        {affinityLoading ? (
          <ActivityIndicator color="#4A9EDB" style={{ marginTop: 8 }} />
        ) : !hasAffinity ? (
          <View style={{
            backgroundColor: "#ffffff", borderRadius: 12, padding: 20,
            alignItems: "center", elevation: 1,
          }}>
            <Ionicons name="bar-chart-outline" size={32} color="#d0d8e4" style={{ marginBottom: 8 }} />
            <Text style={{ color: "#8b9ab0", fontSize: 14, textAlign: "center" }}>
              Open some stories to build your interest profile.{"\n"}
              Your feed will personalise after a few taps.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {affinity.map((row) => {
              const color = CATEGORY_COLORS[row.category] ?? "#4A9EDB";
              const icon  = CATEGORY_ICONS[row.category] ?? "newspaper-outline";
              const pct   = Math.round(row.affinity_score * 100);
              const isLow = row.affinity_score < LOW_THRESHOLD;

              return (
                <View key={row.category} style={{
                  backgroundColor: "#ffffff", borderRadius: 12, padding: 14,
                  elevation: 1, shadowColor: "#000", shadowOpacity: 0.04,
                  shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
                }}>
                  {/* Header row */}
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    <View style={{
                      width: 30, height: 30, borderRadius: 15,
                      backgroundColor: color + "20",
                      alignItems: "center", justifyContent: "center", marginRight: 10,
                    }}>
                      <Ionicons name={icon} size={15} color={color} />
                    </View>
                    <Text style={{ flex: 1, color: "#2c3e50", fontSize: 14, fontWeight: "600", textTransform: "capitalize" }}>
                      {row.category.replace(/_/g, " ")}
                    </Text>
                    <Text style={{ color: "#6b7a8d", fontSize: 12, fontWeight: "600" }}>
                      {pct}%
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={{ height: 6, backgroundColor: "#f0f2f5", borderRadius: 3, overflow: "hidden" }}>
                    <View style={{
                      height: "100%",
                      width: `${pct}%`,
                      backgroundColor: isLow ? "#d0d8e4" : color,
                      borderRadius: 3,
                    }} />
                  </View>

                  {/* Sub-stats */}
                  <View style={{ flexDirection: "row", marginTop: 8, gap: 12 }}>
                    <Text style={{ color: "#8b9ab0", fontSize: 11 }}>
                      <Text style={{ color: "#4A9EDB", fontWeight: "600" }}>{row.views}</Text> opened
                    </Text>
                    <Text style={{ color: "#8b9ab0", fontSize: 11 }}>
                      <Text style={{ color: "#f59e0b", fontWeight: "600" }}>{row.favorites}</Text> fav
                    </Text>
                    <Text style={{ color: "#8b9ab0", fontSize: 11 }}>
                      <Text style={{ color: "#22c55e", fontWeight: "600" }}>{row.posted}</Text> posted
                    </Text>

                    {isLow && (
                      <View style={{
                        marginLeft: "auto",
                        flexDirection: "row", alignItems: "center",
                        backgroundColor: "#fef3c7", borderRadius: 6,
                        paddingHorizontal: 6, paddingVertical: 2,
                      }}>
                        <Ionicons name="flame-outline" size={11} color="#d97706" style={{ marginRight: 3 }} />
                        <Text style={{ color: "#d97706", fontSize: 10, fontWeight: "600" }}>
                          High-impact only
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            <Text style={{ color: "#a0aec0", fontSize: 11, textAlign: "center", marginTop: 4 }}>
              Tap any story to update your profile • Resets every 30 days
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
