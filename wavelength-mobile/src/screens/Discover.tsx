import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchTrendingHashtags, fetchTopicMoments, type TopicMoment, type TrendingHashtag } from "../api/trending";
import { GUEST_DAILY_LIMIT, recordGuestStoryView } from "../utils/guestStorage";
import { useAuth } from "../context/AuthContext";
import HashtagPill from "../components/HashtagPill";
import type { RootStackParamList } from "../navigation/AppNavigator";

type DiscoverNav = NativeStackNavigationProp<RootStackParamList>;

export default function Discover() {
  const navigation = useNavigation<DiscoverNav>();
  const { isGuest } = useAuth();
  const [trending, setTrending] = useState<TrendingHashtag[]>([]);
  const [topics, setTopics] = useState<TopicMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [hashtagData, topicData] = await Promise.all([
        fetchTrendingHashtags(),
        fetchTopicMoments().catch(() => []),
      ]);
      setTrending(hashtagData);
      setTopics(topicData);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Same guest gate as the Dashboard — a topic moment opens a full story,
  // so it must count against (and respect) the free daily limit.
  const handleTopicPress = useCallback(async (storyId: string) => {
    if (isGuest) {
      const { alreadySeen, total } = await recordGuestStoryView(storyId);
      if (!alreadySeen && total >= GUEST_DAILY_LIMIT) {
        navigation.navigate("Paywall");
        return;
      }
    }
    navigation.navigate("StoryDetail", { storyId });
  }, [isGuest, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1a2a3a" }} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 }}>
        <Text style={{ color: "#ffffff", fontSize: 26, fontWeight: "800", letterSpacing: -0.3 }}>
          Discover
        </Text>
        <Text style={{ color: "#5a7a94", fontSize: 13, marginTop: 2 }}>
          Trending topics and breaking story clusters
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, backgroundColor: "#F5F0E8", alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#4A9EDB" size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: "#F5F0E8" }}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A9EDB" colors={["#4A9EDB"]} />
          }
        >
          {/* ── Trending Hashtags ───────────────────────────── */}
          {trending.length > 0 && (
            <View style={{ paddingTop: 20, paddingBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 }}>
                <Ionicons name="trending-up-outline" size={16} color="#4A9EDB" style={{ marginRight: 6 }} />
                <Text style={{ color: "#1a2a3a", fontSize: 15, fontWeight: "800", letterSpacing: 0.2 }}>
                  Trending Hashtags
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: "row" }}>
                {trending.map((item) => (
                  <HashtagPill key={item.hashtag} tag={item.hashtag} isTrending={item.is_trending} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Topic Moments ───────────────────────────────── */}
          {topics.length > 0 && (
            <View style={{ paddingTop: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 }}>
                <Ionicons name="flame" size={16} color="#f97316" style={{ marginRight: 6 }} />
                <Text style={{ color: "#1a2a3a", fontSize: 15, fontWeight: "800" }}>
                  Topic Moments
                </Text>
                <Text style={{ color: "#9aabb8", fontSize: 12, marginLeft: 8 }}>
                  stories breaking in 24h
                </Text>
              </View>

              <View style={{ paddingHorizontal: 16, gap: 10 }}>
                {topics.map((topic) => (
                  <Pressable
                    key={topic.id}
                    onPress={() => {
                      if (topic.top_story?.id) {
                        handleTopicPress(topic.top_story.id);
                      }
                    }}
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "#fed7aa",
                      padding: 14,
                      borderLeftWidth: 4,
                      borderLeftColor: "#f97316",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                      <View style={{
                        backgroundColor: "#f97316", borderRadius: 10,
                        paddingHorizontal: 8, paddingVertical: 3, marginRight: 8,
                      }}>
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                          {topic.story_count} stories
                        </Text>
                      </View>
                      <Text style={{ color: "#9a3412", fontSize: 12, fontWeight: "600", textTransform: "capitalize", flex: 1 }}>
                        {topic.topic_label}
                      </Text>
                    </View>
                    {topic.top_story && (
                      <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600", lineHeight: 20 }} numberOfLines={2}>
                        {topic.top_story.title}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 }}>
                      <Text style={{ color: "#9aabb8", fontSize: 12 }}>Tap to read top story</Text>
                      <Ionicons name="arrow-forward" size={12} color="#9aabb8" />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {trending.length === 0 && topics.length === 0 && (
            <View style={{ alignItems: "center", marginTop: 80, paddingHorizontal: 32 }}>
              <Ionicons name="telescope-outline" size={40} color="#b0bec5" style={{ marginBottom: 12 }} />
              <Text style={{ color: "#6b7a8d", fontSize: 15, textAlign: "center", lineHeight: 22 }}>
                Nothing trending right now.{"\n"}Check back after the next story refresh.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
