import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetchSources, rateSource, type Source } from "../api/sources";

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSources()
      .then(setSources)
      .finally(() => setLoading(false));
  }, []);

  const rate = async (source: string, rating: number) => {
    await rateSource(source, rating);
    setSources((prev) =>
      prev.map((s) => (s.name === source ? { ...s, rating } : s))
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F0E8", alignItems: "center", justifyContent: "center" }} edges={["top", "left", "right"]}>
        <ActivityIndicator color="#4A9EDB" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F0E8" }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: "#2c3e50", fontSize: 22, fontWeight: "700" }}>Sources</Text>
        <Text style={{ color: "#6b7a8d", fontSize: 13, marginTop: 2 }}>Rate your news sources</Text>
      </View>
      <FlatList
        data={sources}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 12,
              padding: 16,
              marginHorizontal: 16,
              marginBottom: 10,
              elevation: 2,
              shadowColor: "#000",
              shadowOpacity: 0.06,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text style={{ color: "#2c3e50", fontWeight: "600", fontSize: 15, marginBottom: 10 }}>
              {item.name}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = (item.rating ?? 0) >= n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => rate(item.name, n)}
                    style={{ padding: 2 }}
                  >
                    <Ionicons
                      name={filled ? "star" : "star-outline"}
                      size={24}
                      color={filled ? "#f59e0b" : "#d1d5db"}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: "#6b7a8d", textAlign: "center", marginTop: 48 }}>
            No sources found.
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}
