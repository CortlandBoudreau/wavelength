import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import client from "../api/client";

interface AnalyticsData {
  total_stories?: number;
  favorited?: number;
  used?: number;
  [key: string]: unknown;
}

const STAT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  total_stories: "newspaper-outline",
  favorited: "star-outline",
  used: "checkmark-circle-outline",
};

const STAT_COLORS: Record<string, string> = {
  total_stories: "#4A9EDB",
  favorited: "#f59e0b",
  used: "#22c55e",
};

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get<AnalyticsData>("/analytics")
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F0E8", alignItems: "center", justifyContent: "center" }} edges={["top", "left", "right"]}>
        <ActivityIndicator color="#4A9EDB" size="large" />
      </SafeAreaView>
    );
  }

  const stats = data
    ? Object.entries(data).filter(([, v]) => typeof v === "number")
    : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F0E8" }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={{ color: "#2c3e50", fontSize: 22, fontWeight: "700", marginBottom: 6 }}>
          Analytics
        </Text>
        <Text style={{ color: "#6b7a8d", fontSize: 13, marginBottom: 24 }}>
          Your WaveLength stats
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {stats.map(([key, value]) => {
            const icon = STAT_ICONS[key] ?? "bar-chart-outline";
            const color = STAT_COLORS[key] ?? "#4A9EDB";
            return (
              <View
                key={key}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: 12,
                  padding: 18,
                  minWidth: 140,
                  flex: 1,
                  elevation: 2,
                  shadowColor: "#000",
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color + "20", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <Text style={{ color: "#2c3e50", fontSize: 28, fontWeight: "700" }}>
                  {String(value)}
                </Text>
                <Text style={{ color: "#6b7a8d", fontSize: 12, marginTop: 2, textTransform: "capitalize" }}>
                  {key.replace(/_/g, " ")}
                </Text>
              </View>
            );
          })}
        </View>

        {stats.length === 0 && (
          <Text style={{ color: "#6b7a8d", textAlign: "center", marginTop: 48 }}>
            No analytics data yet.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
