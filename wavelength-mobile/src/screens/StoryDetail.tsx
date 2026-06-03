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
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Share } from "react-native";
import { fetchStory, toggleFavorite, toggleUsed, saveStoryNotes, generateCaption, fetchRelatedStories, type Story } from "../api/stories";
import HashtagPill from "../components/HashtagPill";
import ScoreBadge from "../components/ScoreBadge";
import { useAuth } from "../context/AuthContext";
import { isProUser } from "../utils/proCheck";
import { categoryEmoji, formatCategory } from "../utils/categories";

interface Props {
  route: { params: { storyId: string } };
  navigation: { goBack: () => void; replace: (screen: string, params?: object) => void };
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
  const [caption, setCaption] = useState<string | null>(null);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionVisible, setCaptionVisible] = useState(false);
  const [copied, setCopied] = useState<"caption" | "hashtags" | "package" | null>(null);
  const [related, setRelated] = useState<Story[]>([]);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    fetchStory(storyId)
      .then((s) => {
        setStory(s);
        setNotes(s.notes ?? "");
        fetchRelatedStories(storyId).then(setRelated).catch(() => {});
      })
      .catch((err: any) => {
        if (err?.response?.status === 402) {
          navigation.replace("Paywall");
        }
      });
    // Stop speech when leaving the screen
    return () => { Speech.stop(); };
  }, [storyId]);

  const handleSpeak = async () => {
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    if (!story?.summary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSpeaking(true);
    Speech.speak(story.summary, {
      rate: 0.95,
      onDone: () => setSpeaking(false),
      onError: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
    });
  };

  const toggle = async (field: "favorited" | "used") => {
    if (!story) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const handleShare = async () => {
    if (!story) return;
    await Share.share({ message: `${story.title}\n\n${story.url}` });
  };

  const handleGenerateCaption = async () => {
    if (!story) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCaptionLoading(true);
    setCaptionVisible(true);
    try {
      const text = await generateCaption(story.id);
      setCaption(text);
    } catch {
      Alert.alert("Error", "Could not generate caption. Please try again.");
      setCaptionVisible(false);
    } finally {
      setCaptionLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: "caption" | "hashtags" | "package") => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyPackage = () => {
    if (!story) return;
    const pkg = `${story.title}\n\n${story.summary}\n\n${hashtagString}`;
    copyToClipboard(pkg, "package");
  };

  const { user } = useAuth();
  const isLoggedIn = !!user;
  const isPro = isProUser(user);

  if (!story) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F0E8", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#4A9EDB" size="large" />
      </SafeAreaView>
    );
  }

  const emoji = categoryEmoji(story.category);
  const categoryLabel = formatCategory(story.category);

  const hashtagString = (story?.hashtags ?? []).join(" ");

  return (
    <View style={{ flex: 1, backgroundColor: "#1a2a3a" }}>

    {/* ── Caption Modal ──────────────────────────────────── */}
    <Modal visible={captionVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCaptionVisible(false)}>
      <View style={{ flex: 1, backgroundColor: "#1a2a3a" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 12 }}>
          <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>Instagram Caption</Text>
          <Pressable onPress={() => setCaptionVisible(false)} hitSlop={8}>
            <Ionicons name="close" size={24} color="#7a96ae" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          {captionLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <ActivityIndicator color="#4A9EDB" size="large" />
              <Text style={{ color: "#7a96ae", marginTop: 16, fontSize: 14 }}>Writing your caption…</Text>
            </View>
          ) : caption ? (
            <>
              <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <Text style={{ color: "#e8f0f8", fontSize: 15, lineHeight: 24 }}>{caption}</Text>
              </View>
              <Pressable
                onPress={() => copyToClipboard(caption, "caption")}
                style={{ backgroundColor: copied === "caption" ? "#22c55e" : "#4A9EDB", borderRadius: 12, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 12 }}
              >
                <Ionicons name={copied === "caption" ? "checkmark" : "copy-outline"} size={18} color="#fff" />
                <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 15 }}>
                  {copied === "caption" ? "Copied!" : "Copy Caption"}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleGenerateCaption}
                style={{ borderWidth: 1.5, borderColor: "#4A9EDB", borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ color: "#4A9EDB", fontWeight: "600", fontSize: 14 }}>Regenerate</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>

    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F0E8" }}>

      {/* Thin nav bar — back + score only, matches dashboard header height */}
      <View style={{
        backgroundColor: "#1a2a3a", flexDirection: "row", alignItems: "center",
        justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Pressable onPress={handleSpeak} hitSlop={8}>
            <Ionicons name={speaking ? "stop-circle-outline" : "volume-medium-outline"} size={22} color={speaking ? "#4A9EDB" : "#7ec8f0"} />
          </Pressable>
          <Pressable onPress={handleShare} hitSlop={8}>
            <Ionicons name="share-outline" size={22} color="#7ec8f0" />
          </Pressable>
          <ScoreBadge score={story.engagement_score} />
        </View>
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
            {(story.cluster_size ?? 1) >= 3 && (
              <View style={{ backgroundColor: "#fff3e0", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="flame-outline" size={11} color="#f97316" />
                <Text style={{ color: "#f97316", fontSize: 11, fontWeight: "700" }}>
                  {story.cluster_size} sources
                </Text>
              </View>
            )}
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
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
              {(story.hashtags ?? []).map((h) => (
                <HashtagPill key={h} tag={h} />
              ))}
            </View>
            <Pressable
              onPress={() => copyToClipboard(hashtagString, "hashtags")}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                backgroundColor: copied === "hashtags" ? "#dcfce7" : "#f0f4f8",
                borderWidth: 1.5, borderColor: copied === "hashtags" ? "#22c55e" : "#b0bec5",
                borderRadius: 10, paddingVertical: 9,
              }}
            >
              <Ionicons name={copied === "hashtags" ? "checkmark" : "copy-outline"} size={15} color={copied === "hashtags" ? "#22c55e" : "#6b7a8d"} />
              <Text style={{ color: copied === "hashtags" ? "#166534" : "#6b7a8d", fontSize: 13, fontWeight: "700" }}>
                {copied === "hashtags" ? "Copied!" : "Copy Hashtags"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Copy full package — always available */}
        <Pressable
          onPress={handleCopyPackage}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
            backgroundColor: copied === "package" ? "#dcfce7" : "#ffffff",
            borderRadius: 12, paddingVertical: 13, marginBottom: 10,
            borderWidth: 1.5, borderColor: copied === "package" ? "#22c55e" : "#b0bec5",
          }}
        >
          <Ionicons name={copied === "package" ? "checkmark" : "layers-outline"} size={16} color={copied === "package" ? "#22c55e" : "#6b7a8d"} />
          <Text style={{ color: copied === "package" ? "#166534" : "#6b7a8d", fontSize: 14, fontWeight: "700" }}>
            {copied === "package" ? "Copied!" : "Copy Title + Summary + Hashtags"}
          </Text>
        </Pressable>

        {/* Generate caption */}
        {isLoggedIn && isPro ? (
          <Pressable
            onPress={handleGenerateCaption}
            disabled={captionLoading}
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
              backgroundColor: "#4A9EDB", borderRadius: 12, paddingVertical: 14, marginBottom: 14,
            }}
          >
            {captionLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="sparkles-outline" size={18} color="#fff" />
            }
            <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 15 }}>
              {captionLoading ? "Writing caption…" : "Generate Caption"}
            </Text>
          </Pressable>
        ) : isLoggedIn ? (
          <Pressable
            onPress={() => navigation.replace("Paywall")}
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
              backgroundColor: "#f0f4f8", borderRadius: 12, paddingVertical: 14, marginBottom: 14,
              borderWidth: 1.5, borderColor: "#b0bec5",
            }}
          >
            <Ionicons name="lock-closed-outline" size={16} color="#9aafc0" />
            <Text style={{ color: "#9aafc0", fontWeight: "700", fontSize: 15 }}>Generate Caption</Text>
            <View style={{ backgroundColor: "#4A9EDB", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>PRO</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Action buttons — pro only */}
        {isLoggedIn && isPro ? (
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
        ) : isLoggedIn ? (
          // Logged in but free — pro upsell
          <View style={[styles.card, { alignItems: "center", paddingVertical: 20 }]}>
            <Ionicons name="sparkles-outline" size={26} color="#4A9EDB" style={{ marginBottom: 8 }} />
            <Text style={{ color: "#1a2a3a", fontWeight: "800", fontSize: 15, marginBottom: 6 }}>Pro Feature</Text>
            <Text style={{ color: "#6b7a8d", fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: 16 }}>
              Upgrade to save stories, mark as posted, add notes, and generate captions.
            </Text>
            <Pressable
              onPress={() => navigation.replace("Paywall")}
              style={{ backgroundColor: "#4A9EDB", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 28 }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Upgrade to Pro</Text>
            </Pressable>
          </View>
        ) : (
          // Not logged in
          <View style={[styles.card, { alignItems: "center" }]}>
            <Ionicons name="lock-closed-outline" size={22} color="#b0bec5" style={{ marginBottom: 8 }} />
            <Text style={{ color: "#6b7a8d", fontSize: 13, textAlign: "center", lineHeight: 19 }}>
              Sign in to save, mark as posted, and add notes.
            </Text>
          </View>
        )}

        {/* Related stories */}
        {related.length > 0 && (
          <View style={[styles.card, { marginTop: 4 }]}>
            <Text style={styles.sectionLabel}>MORE LIKE THIS</Text>
            {related.map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => navigation.replace("StoryDetail", { storyId: r.id })}
                style={{
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: "#f0f4f8",
                }}
              >
                <Text style={{ color: "#0d1b2a", fontWeight: "700", fontSize: 13, lineHeight: 18, marginBottom: 3 }} numberOfLines={2}>
                  {r.title}
                </Text>
                <Text style={{ color: "#9aafc0", fontSize: 11 }}>{r.source}</Text>
              </Pressable>
            ))}
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
