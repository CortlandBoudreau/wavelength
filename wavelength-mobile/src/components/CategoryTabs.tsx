import React from "react";
import { ScrollView, Pressable, Text } from "react-native";
import { categoryEmoji, formatCategory } from "../utils/categories";
import type { Category } from "../api/stories";

interface Props {
  categories: Category[];
  selected: Category | "all";
  onSelect: (cat: Category | "all") => void;
}

export default function CategoryTabs({ categories, selected, onSelect }: Props) {
  const all: Array<Category | "all"> = ["all", ...categories];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ paddingVertical: 8 }}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
    >
      {all.map((cat) => {
        const isActive = selected === cat;
        const emoji = cat === "all" ? "🔭" : categoryEmoji(cat);
        return (
          <Pressable
            key={cat}
            onPress={() => onSelect(cat)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: isActive ? "#4A9EDB" : "#ffffff",
              borderWidth: 1.5,
              borderColor: isActive ? "#4A9EDB" : "#e0e7ef",
              shadowColor: isActive ? "#4A9EDB" : "transparent",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: isActive ? 2 : 0,
            }}
          >
            <Text style={{
              fontSize: 12,
              fontWeight: "600",
              color: isActive ? "#ffffff" : "#6b7a8d",
            }}>
              {emoji} {cat === "all" ? "All" : formatCategory(cat)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
