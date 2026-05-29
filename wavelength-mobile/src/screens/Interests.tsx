import React, { useState } from "react";
import {
  View, Text, Pressable, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ALL_CATEGORIES, categoryEmoji, formatCategory } from "../utils/categories";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/AuthStack";

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Interests">;
}

const MIN = 3;

export default function Interests({ navigation }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (cat: string) => {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const canContinue = selected.length >= MIN;

  return (
    <View style={{ flex: 1, backgroundColor: "#0f1e2d" }}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#7ec8f0" />
          </Pressable>
          {/* Counter badge */}
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
            Select {MIN} or more topics you care about.
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
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.06)",
                }}
              >
                {/* Emoji circle */}
                <View style={{
                  width: 46, height: 46, borderRadius: 23,
                  backgroundColor: active ? "rgba(74,158,219,0.2)" : "rgba(255,255,255,0.06)",
                  alignItems: "center", justifyContent: "center",
                  marginRight: 14,
                }}>
                  <Text style={{ fontSize: 22 }}>{categoryEmoji(item)}</Text>
                </View>

                {/* Label */}
                <Text style={{
                  flex: 1, color: active ? "#ffffff" : "#a0b4c8",
                  fontSize: 16, fontWeight: active ? "700" : "400",
                }}>
                  {formatCategory(item)}
                </Text>

                {/* Toggle icon */}
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

        {/* Continue button */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <Pressable
            onPress={() => navigation.navigate("Register", { interests: selected })}
            disabled={!canContinue}
            style={{
              backgroundColor: canContinue ? "#4A9EDB" : "rgba(74,158,219,0.25)",
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            <Text style={{
              color: canContinue ? "#ffffff" : "rgba(255,255,255,0.35)",
              fontWeight: "700", fontSize: 16,
            }}>
              Continue
            </Text>
          </Pressable>
        </View>

      </SafeAreaView>
    </View>
  );
}
