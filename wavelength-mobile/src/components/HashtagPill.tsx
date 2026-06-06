import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  tag:         string;
  onPress?:    (tag: string) => void;
  active?:     boolean;
  isTrending?: boolean;  // shows 🔥 flame when velocity >= 3×
}

export default function HashtagPill({ tag, onPress, active = false, isTrending = false }: Props) {
  const raw = tag.startsWith("#") ? tag.slice(1) : tag;
  const display = raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <Pressable
      onPress={() => onPress?.(tag)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginRight: 6,
        marginBottom: 4,
        backgroundColor: active
          ? "#4A9EDB"
          : isTrending
          ? "#fff7ed"
          : "#e8f4fd",
        borderWidth: 1,
        borderColor: active
          ? "#4A9EDB"
          : isTrending
          ? "#fdba74"
          : "#c3dff5",
      }}
    >
      {isTrending && !active && (
        <Ionicons
          name="flame"
          size={11}
          color="#f97316"
          style={{ marginRight: 3 }}
        />
      )}
      <Text
        style={{
          color: active ? "#ffffff" : isTrending ? "#c2410c" : "#0369a1",
          fontSize: 12,
          fontWeight: isTrending ? "700" : "500",
        }}
      >
        #{display}
      </Text>
    </Pressable>
  );
}
