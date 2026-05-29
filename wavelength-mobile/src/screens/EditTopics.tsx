import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { ALL_CATEGORIES, categoryEmoji, formatCategory } from "../utils/categories";

const MIN = 3;

export default function EditTopics() {
  const navigation = useNavigation();
  const { user, guestInterests, completeOnboarding } = useAuth();

  const current: string[] = user?.interests ?? guestInterests;
  const [selected, setSelected] = useState<string[]>(current);
  const [saving, setSaving] = useState(false);

  const toggle = (cat: string) => {
    setSelected((prev) => {
      if (prev.includes(cat)) {
        // Enforce minimum
        if (prev.length <= MIN) {
          Alert.alert(
            "Minimum topics",
            `Please keep at least ${MIN} topics selected.`
          );
          return prev;
        }
        return prev.filter((c) => c !== cat);
      }
      return [...prev, cat];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await completeOnboarding(selected);
      navigation.goBack();
    } catch {
      Alert.alert("Error", "Could not save your topics. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    selected.length !== current.length ||
    !selected.every((c) => current.includes(c));

  return (
    <View style={{ flex: 1, backgroundColor: "#0f1e2d" }}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.08)",
        }}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: "rgba(255,255,255,0.1)",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={18} color="#ffffff" />
          </Pressable>

          <Text style={{ color: "#ffffff", fontSize: 17, fontWeight: "700" }}>
            Edit Topics
          </Text>

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={saving || !hasChanges}
            style={{
              backgroundColor: hasChanges ? "#4A9EDB" : "transparent",
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={{
                color: hasChanges ? "#ffffff" : "#3a5a74",
                fontWeight: "700",
                fontSize: 14,
              }}>
                Save
              </Text>
            )}
          </Pressable>
        </View>

        {/* Count row */}
        <View style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "800" }}>
            Your Topics
          </Text>
          <View style={{
            backgroundColor: "rgba(74,158,219,0.2)",
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 4,
          }}>
            <Text style={{ color: "#4A9EDB", fontSize: 13, fontWeight: "700" }}>
              {selected.length} / {ALL_CATEGORIES.length}
            </Text>
          </View>
        </View>

        <Text style={{
          color: "#5a7a94",
          fontSize: 12,
          paddingHorizontal: 20,
          marginBottom: 12,
          lineHeight: 17,
        }}>
          Minimum {MIN} topics required. These appear as tabs on your feed.
        </Text>

        {/* Topic list */}
        <FlatList
          data={ALL_CATEGORIES}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const active = selected.includes(item);
            return (
              <Pressable
                onPress={() => toggle(item)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 13,
                  paddingHorizontal: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.06)",
                }}
              >
                {/* Emoji */}
                <Text style={{ fontSize: 20, marginRight: 14, width: 28, textAlign: "center" }}>
                  {categoryEmoji(item)}
                </Text>

                {/* Label */}
                <Text style={{
                  flex: 1,
                  color: active ? "#ffffff" : "#5a7a94",
                  fontSize: 16,
                  fontWeight: active ? "600" : "400",
                }}>
                  {formatCategory(item)}
                </Text>

                {/* Toggle switch */}
                <Switch
                  value={active}
                  onValueChange={() => toggle(item)}
                  trackColor={{ false: "rgba(255,255,255,0.1)", true: "#4A9EDB" }}
                  thumbColor={active ? "#ffffff" : "#6b8aaa"}
                  ios_backgroundColor="rgba(255,255,255,0.1)"
                />
              </Pressable>
            );
          }}
        />

      </SafeAreaView>
    </View>
  );
}
