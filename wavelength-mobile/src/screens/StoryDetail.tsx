import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetchStory, toggleFavorite, toggleUsed, saveStoryNotes, type Story } from "../api/stories";
import HashtagPill from "../components/HashtagPill";
import ScoreBadge from "../components/ScoreBadge";
import { useAuth } from "../context/AuthContext";
import { categoryEmoji, formatCategory } from "../utils/categories";

interface Props {
  route: { params: { storyId: string } };
  navigation: { goBack: () => void; replace: (screen: string) => void };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#edf0f4",
    shadowColor: "#1a2a3a",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionLabel: {
    color: "#1a2a3a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
});

export default function StoryDetail({ route, navigation }: Props) {
  const { storyId } = route.params;
  const [story, setStory] = useState<Story | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStory(storyId)
      .then((s) => {
        setStory(s);
        setNotes(s.notes ?? "");
      })
      .catch((err: any) => {
        if (err?.response?.status === 402) {
          navigation.replace("Paywall");
        }
      });
  }, [storyId]);

  const toggle = async (field: "favorited" | "used") => {
    if (!story) return;
    // Optimistic update so the button responds instantly
    const prev = story;
    setStory({ ...story, [field]: !story[field] });
    try {
      if (field === "favorited") {
        const { favorited } = await toggleFavorite(storyId);
        setStory((s) => s ? { ...s, favorited } : s);
      } else {
        const { used } = await toggleUsed(storyId);
        setStory((s) => s ? { ...s, used } : s);
      }
    } catch (err: unknown) {
      // Revert on failure and tell the user
      setStory(prev);
      const msg = err instanceof Error ? err.message : "Could not update story.";
      Alert.alert("Error", msg);
    }
  };

  const saveNotes = async () => {
    if (!story) return;
    setSaving(true);
    try {
      await saveStoryNotes(storyId, notes);
      setStory({ ...story, notes });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not save notes.";
      Alert.alert("Save failed", msg);
    } finally {
      setSaving(false);
    }
  };

  const { user } = useAuth();
  const isLoggedIn = !!user;

  if (!story) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F0E8", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#4A9EDB" size="large" />
      </SafeAreaView>
    );
  }

  const emoji = categoryEmoji(story.category);
  const categoryLabel = formatCategory(story.category);

  return (
    <View style={{ flex: 1, backgroundColor: "#1a2a3a" }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F0E8" }}>

      {/* Thin nav bar — back + score only, matches dashboard header height */}
      <View style={{
        backgroundColor: "#1a2a3a", flexDirection: "row", alignItems: "center",
        justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <ScoreBadge score={story.engagement_score} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      >

        {/* Title card — same white-card-on-sand as dashboard story cards */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <View style={{ backgroundColor: "#e8f4fd", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ color: "#4A9EDB", fontSize: 12, fontWeight: "600" }}>
                {emoji} {categoryLabel}
              </Text>
            </View>
            <Text style={{ color: "#9aafc0", fontSize: 12 }}>
              {story.source} · {new Date(story.published_at).toLocaleDateString()}
            </Text>
          </View>
          <Text style={{ color: "#0d1b2a", fontSize: 20, fontWeight: "800", lineHeight: 28 }}>
            {story.title}
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>SUMMARY</Text>
          <Text style={{ color: "#5a6a7a", fontSize: 14, lineHeight: 22 }}>{story.summary}</Text>
        </View>

        {/* Bullets */}
        {(story.bullets ?? []).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>KEY POINTS</Text>
            {(story.bullets ?? []).map((b, i) => (
              <View key={i} style={{ flexDirection: "row", marginBottom: 7 }}>
                <Text style={{ color: "#4A9EDB", marginRight: 8, fontSize: 15, lineHeight: 20 }}>•</Text>
                <Text style={{ color: "#5a6a7a", fontSize: 13, lineHeight: 20, flex: 1 }}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Angle */}
        {story.angle ? (
          <View style={[styles.card, { backgroundColor: "#e8f4fd", borderColor: "#c3dff5", borderLeftWidth: 4, borderLeftColor: "#4A9EDB" }]}>
            <Text style={styles.sectionLabel}>CONTENT ANGLE</Text>
            <Text style={{ color: "#0f4c7a", fontSize: 13, lineHeight: 20 }}>
              {story.angle.charAt(0).toUpperCase() + story.angle.slice(1)}
            </Text>
          </View>
        ) : null}

        {/* Hashtags */}
        {(story.hashtags ?? []).length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
            {(story.hashtags ?? []).map((h) => (
              <HashtagPill key={h} tag={h} />
            ))}
          </View>
        )}

        {/* Action buttons — logged-in only */}
        {isLoggedIn ? (
          <>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
              <Pressable
                onPress={() => toggle("favorited")}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  backgroundColor: story.favorited ? "#fef9c3" : "#ffffff",
                  borderColor: story.favorited ? "#f59e0b" : "#e0e7ef",
                }}
              >
                <Ionicons name={story.favorited ? "star" : "star-outline"} size={16} color={story.favorited ? "#f59e0b" : "#6b7a8d"} />
                <Text style={{ color: story.favorited ? "#713f12" : "#6b7a8d", fontSize: 13, fontWeight: "700" }}>
                  {story.favorited ? "Saved" : "Save"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => toggle("used")}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  backgroundColor: story.used ? "#dcfce7" : "#ffffff",
                  borderColor: story.used ? "#22c55e" : "#e0e7ef",
                }}
              >
                <Ionicons name={story.used ? "checkmark-circle" : "checkmark-circle-outline"} size={16} color={story.used ? "#22c55e" : "#6b7a8d"} />
                <Text style={{ color: story.used ? "#166534" : "#6b7a8d", fontSize: 13, fontWeight: "700" }}>
                  {story.used ? "Posted" : "Mark Posted"}
                </Text>
              </Pressable>
            </View>

            {/* Notes */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>NOTES</Text>
              <TextInput
                style={{
                  backgroundColor: "#f0f4f8",
                  borderWidth: 1.5,
                  borderColor: "#b0bec5",
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: "#1a2a3a",
                  fontSize: 14,
                  marginBottom: 12,
                  minHeight: 90,
                  textAlignVertical: "top",
                }}
                placeholder="Add your notes..."
                placeholderTextColor="#9aafc0"
                multiline
                numberOfLines={4}
                value={notes}
                onChangeText={setNotes}
              />
              <Pressable
                onPress={saveNotes}
                disabled={saving}
                style={{ backgroundColor: "#4A9EDB", borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 14 }}>Save Notes</Text>
                )}
              </Pressable>
            </View>
          </>
        ) : (
          <View style={[styles.card, { alignItems: "center" }]}>
            <Ionicons name="lock-closed-outline" size={22} color="#b0bec5" style={{ marginBottom: 8 }} />
            <Text style={{ color: "#6b7a8d", fontSize: 13, textAlign: "center", lineHeight: 19 }}>
              Sign in to save, mark as posted, and add notes.
            </Text>
          </View>
        )}

        {/* Open original */}
        <Pressable
          onPress={() => Linking.openURL(story.url)}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
            backgroundColor: "#ffffff", borderRadius: 12, paddingVertical: 13,
            borderWidth: 1.5, borderColor: "#4A9EDB",
          }}
        >
          <Ionicons name="open-outline" size={15} color="#4A9EDB" />
          <Text style={{ color: "#4A9EDB", fontSize: 14, fontWeight: "700" }}>Open Original Article</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
    </View>
  );
}
