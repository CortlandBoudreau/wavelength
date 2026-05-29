import React from "react";
import { Pressable, Text } from "react-native";

interface Props {
  tag: string;
  onPress?: (tag: string) => void;
  active?: boolean;
}

export default function HashtagPill({ tag, onPress, active = false }: Props) {
  // Strip leading #, replace underscores with spaces, capitalise each word
  const raw = tag.startsWith("#") ? tag.slice(1) : tag;
  const display = raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <Pressable
      onPress={() => onPress?.(tag)}
      style={{
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginRight: 6,
        marginBottom: 4,
        backgroundColor: active ? "#4A9EDB" : "#e8f4fd",
        borderWidth: 1,
        borderColor: active ? "#4A9EDB" : "#c3dff5",
      }}
    >
      <Text
        style={{
          color: active ? "#ffffff" : "#0369a1",
          fontSize: 12,
          fontWeight: "500",
        }}
      >
        #{display}
      </Text>
    </Pressable>
  );
}
