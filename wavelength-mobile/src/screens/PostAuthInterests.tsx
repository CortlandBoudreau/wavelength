import React, { useState } from "react";
import {
  View, Text, Pressable, FlatList, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { ALL_CATEGORIES, categoryEmoji, formatCategory } from "../utils/categories";

const MIN = 3;

export default function PostAuthInterests() {
  const { completeOnboarding, isGuest } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving]     = useState(false);

  const toggle = (cat: string) =>
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const canContinue = selected.length >= MIN;

  const handleContinue = async () => {
    setSaving(true);
    await completeOnboarding(selected);
    setSaving(false);
    // needsOnboarding flips to false in AuthContext → AppNavigator auto-navigates to Main
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0f1e2d" }}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#7a96ae", fontSize: 13 }}>
              {isGuest ? "Browsing as guest" : "Almost there!"}
            </Text>
          </View>
          <View style={{
            backgroundColor: canContinue ? "#4A9EDB" : "rgba(255,255,255,0.1)",
            borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
          }}>
            <Text style={{ color: canContinue ? "#ffffff" : "#7a96ae", fontSize: 13, fontWeight: "700" }}>
              {selected.length}/{MIN}
            </Text>
          </View>
        </View>

        {/* Title */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ color: "#ffffff", fontSize: 26, fontWeight: "800", marginBottom: 6 }}>
            Personalise your feed
          </Text>
          <Text style={{ color: "#7a96ae", fontSize: 14, lineHeight: 20 }}>
            Select {MIN} or more topics to get started.
          </Text>
        </View>

        {/* Category list */}
        <FlatList
            data={ALL_CATEGORIES}
            keyExtractor={(item) => item}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            renderItem={({ item }) => {
              const active = selected.includes(item);
              return (
                <Pressable
                  onPress={() => toggle(item)}
                  style={{
                    flexDirection: "row", alignItems: "center",
                    paddingVertical: 14,
                    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  <View style={{
                    width: 46, height: 46, borderRadius: 23, marginRight: 14,
                    backgroundColor: active ? "rgba(74,158,219,0.2)" : "rgba(255,255,255,0.06)",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Text style={{ fontSize: 22 }}>{categoryEmoji(item)}</Text>
                  </View>

                  <Text style={{
                    flex: 1, fontSize: 16,
                    color: active ? "#ffffff" : "#a0b4c8",
                    fontWeight: active ? "700" : "400",
                  }}>
                    {formatCategory(item)}
                  </Text>

                  <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: active ? "#4A9EDB" : "transparent",
                    borderWidth: 1.5,
                    borderColor: active ? "#4A9EDB" : "rgba(255,255,255,0.25)",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Ionicons
                      name={active ? "checkmark" : "add"}
                      size={16}
                      color={active ? "#ffffff" : "rgba(255,255,255,0.4)"}
                    />
                  </View>
                </Pressable>
              );
            }}
          />

        {/* Continue */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          {isGuest && (
            <Text style={{ color: "#5a7a94", fontSize: 12, textAlign: "center", marginBottom: 10 }}>
              Create an account to save your preferences permanently.
            </Text>
          )}
          <Pressable
            onPress={handleContinue}
            disabled={!canContinue || saving}
            style={{
              backgroundColor: canContinue ? "#4A9EDB" : "rgba(74,158,219,0.25)",
              borderRadius: 14, paddingVertical: 16, alignItems: "center",
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{
                color: canContinue ? "#ffffff" : "rgba(255,255,255,0.35)",
                fontWeight: "700", fontSize: 16,
              }}>
                Let's Go
              </Text>
            )}
          </Pressable>
        </View>

      </SafeAreaView>
    </View>
  );
}
