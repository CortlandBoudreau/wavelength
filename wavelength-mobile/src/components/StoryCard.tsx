import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScoreBadge from "./ScoreBadge";
import { categoryEmoji, formatCategory } from "../utils/categories";
import type { Story } from "../api/stories";

interface Props {
  story: Story;
  onPress: (story: Story) => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StoryCard({ story, onPress }: Props) {
  const emoji = categoryEmoji(story.category);

  return (
    // Outer View owns the horizontal margin — never swallowed by FlatList
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => onPress(story)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {/* Title + score */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {story.title}
          </Text>
          <ScoreBadge score={story.engagement_score} />
        </View>

        {/* Summary */}
        <Text style={styles.summary} numberOfLines={2}>
          {story.summary}
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          {/* Left: category pill + status icons */}
          <View style={styles.footerLeft}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>
                {emoji} {formatCategory(story.category)}
              </Text>
            </View>
            {story.favorited && <Ionicons name="star" size={14} color="#f59e0b" />}
            {story.used && <Ionicons name="checkmark-circle" size={14} color="#22c55e" />}
          </View>
          {/* Right: source truncates, time is always visible */}
          <View style={styles.metaRight}>
            <Text style={styles.metaSource} numberOfLines={1} ellipsizeMode="tail">
              {story.source}
            </Text>
            <Text style={styles.metaTime}> · {relativeTime(story.published_at)}</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 14,
    marginBottom: 0,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: "#1a2a3a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#edf0f4",
  },
  cardPressed: {
    opacity: 0.92,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: {
    flex: 1,
    color: "#0d1b2a",
    fontWeight: "800",
    fontSize: 15,
    lineHeight: 22,
    paddingRight: 10,
  },
  summary: {
    color: "#5a6a7a",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryPill: {
    backgroundColor: "#e8f4fd",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  categoryText: {
    color: "#0369a1",
    fontSize: 11,
    fontWeight: "700",
  },
  metaRight: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    marginLeft: 8,
  },
  metaSource: {
    color: "#8a9ab0",
    fontSize: 11,
    flexShrink: 1,
  },
  metaTime: {
    color: "#8a9ab0",
    fontSize: 11,
    flexShrink: 0,
  },
});
