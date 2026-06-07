import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  TextInput,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchStories, searchStories, type Story, type Category } from "../api/stories";
import { fetchTrendingHashtags, fetchTopicMoments, type TopicMoment, type TrendingHashtag } from "../api/trending";
import { deduplicateClusters } from "../utils/clusterDedup";
import { GUEST_DAILY_LIMIT, recordGuestStoryView } from "../utils/guestStorage";
import { useAuth } from "../context/AuthContext";
import { isProUser } from "../utils/proCheck";
import StoryCard from "../components/StoryCard";
import SkeletonCard from "../components/SkeletonCard";
import CategoryTabs from "../components/CategoryTabs";
import HashtagPill from "../components/HashtagPill";
import WaveLogo from "../components/WaveLogo";
import type { RootStackParamList } from "../navigation/AppNavigator";

const FREE_DETAIL_LIMIT = GUEST_DAILY_LIMIT;

type DashboardNav = NativeStackNavigationProp<RootStackParamList>;

const TRENDING_STALE_MS = 5 * 60 * 1000;

export default function Dashboard() {
  const navigation = useNavigation<DashboardNav>();
  const { isGuest, user, guestInterests } = useAuth();
  const isLoggedIn = !!user;
  const isPro = isProUser(user);
  const [stories, setStories] = useState<Story[]>([]);
  // Use the interests the user picked during onboarding as the category tabs
  const categories: Category[] = (user?.interests ?? guestInterests) as Category[];
  const [category, setCategory] = useState<Category | "all">("all");
  const [hashtag, setHashtag] = useState<string | undefined>();
  const [trending, setTrending] = useState<TrendingHashtag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<"newest" | "score">("newest");
  const [hidePosted, setHidePosted] = useState(false);
  const [topToday, setTopToday] = useState(false);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [topics, setTopics] = useState<TopicMoment[]>([]);
  const [newBannerCount, setNewBannerCount] = useState(0);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trendingFetchedAt = useRef<number>(0);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStories = useCallback(async () => {
    try {
      setFetchError(null);
      const result = await fetchStories(topToday ? {
        sort: "score",
        since: 24,
        limit: 8,
      } : {
        category:   category !== "all" ? category    : undefined,
        categories: category === "all" ? categories  : undefined,
        hashtag,
        sort:       sort === "score" ? "score" : undefined,
      });
      setStories(deduplicateClusters(result.stories));
      setIsPersonalized(result.personalized ?? false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFetchError(msg);
    }
  }, [category, hashtag, sort, topToday]);

  const loadTrending = useCallback(async () => {
    if (Date.now() - trendingFetchedAt.current < TRENDING_STALE_MS) return;
    try {
      const [hashtagData, topicData] = await Promise.all([
        fetchTrendingHashtags(),
        fetchTopicMoments().catch(() => []),
      ]);
      setTrending(hashtagData);
      setTopics(topicData);
      trendingFetchedAt.current = Date.now();
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStories(), loadTrending()]).finally(() => setLoading(false));
  }, [loadStories, loadTrending]);

  // Handle story tap — check guest limit before navigating
  const handleStoryPress = useCallback(async (story: Story) => {
    if (isGuest) {
      const { alreadySeen, total } = await recordGuestStoryView(story.id);
      // Block only if this is a brand-new article AND the daily cap is reached
      if (!alreadySeen && total > FREE_DETAIL_LIMIT) {
        navigation.navigate("Paywall");
        return;
      }
    }
    setViewedIds((prev) => new Set(prev).add(story.id));
    navigation.navigate("StoryDetail", { storyId: story.id });
  }, [isGuest, navigation]);

  // Debounced search
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) { setSearchActive(false); loadStories(); return; }
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchStories(text.trim());
        setStories(result.stories);
        setSearchActive(true);
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 400);
  };

  const showNewBanner = (count: number) => {
    if (count <= 0) return;
    setNewBannerCount(count);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(bannerOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const prevIds = new Set(stories.map((s) => s.id));
    await loadStories();
    // Count how many IDs we have after that aren't in the old set
    // We read `stories` via a callback to get the post-load value
    setStories((latest) => {
      const added = latest.filter((s) => !prevIds.has(s.id)).length;
      if (added > 0) showNewBanner(added);
      return latest;
    });
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1a2a3a" }} edges={["top", "left", "right"]}>
      {/* New stories banner */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute", top: 60, left: 0, right: 0, zIndex: 99,
          alignItems: "center", opacity: bannerOpacity,
        }}
      >
        <View style={{
          backgroundColor: "#22c55e", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8,
          flexDirection: "row", alignItems: "center", gap: 6,
          shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
        }}>
          <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 13 }}>
            ✦ {newBannerCount} new {newBannerCount === 1 ? "story" : "stories"} added
          </Text>
        </View>
      </Animated.View>

      {/* Header */}
      <View style={{ backgroundColor: "#1a2a3a", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <WaveLogo size="md" />
        </View>
        {/* Search bar */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
          <Ionicons name="search-outline" size={16} color="#7a96ae" />
          <TextInput
            style={{ flex: 1, color: "#ffffff", fontSize: 14 }}
            placeholder="Search stories…"
            placeholderTextColor="#5a7a94"
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => { setSearchQuery(""); setSearchActive(false); loadStories(); }} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#5a7a94" />
            </Pressable>
          )}
        </View>

        {/* Sort + filter toggles */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <Pressable
            onPress={() => { setTopToday((t) => !t); if (!topToday) setSort("newest"); }}
            style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              backgroundColor: topToday ? "#f97316" : "rgba(255,255,255,0.12)",
              borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
            }}
          >
            <Ionicons name="trophy-outline" size={13} color={topToday ? "#fff" : "#7a96ae"} />
            <Text style={{ color: topToday ? "#fff" : "#7a96ae", fontSize: 12, fontWeight: "700" }}>
              Top Today
            </Text>
          </Pressable>

          {!topToday && (
            <Pressable
              onPress={() => setSort((s) => s === "newest" ? "score" : "newest")}
              style={{
                flexDirection: "row", alignItems: "center", gap: 5,
                backgroundColor: sort === "score" ? "#4A9EDB" : "rgba(255,255,255,0.12)",
                borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
              }}
            >
              <Ionicons name={sort === "score" ? "flame" : "time-outline"} size={13} color={sort === "score" ? "#fff" : "#7a96ae"} />
              <Text style={{ color: sort === "score" ? "#fff" : "#7a96ae", fontSize: 12, fontWeight: "700" }}>
                {sort === "score" ? "Top Rated" : "Newest"}
              </Text>
            </Pressable>
          )}

          {/* Personalization indicator — shown when the feed is being tailored */}
          {isLoggedIn && isPersonalized && !topToday && (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              backgroundColor: "rgba(99,102,241,0.18)",
              borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
            }}>
              <Ionicons name="sparkles" size={12} color="#a78bfa" />
              <Text style={{ color: "#a78bfa", fontSize: 11, fontWeight: "700" }}>
                Personalized
              </Text>
            </View>
          )}

          {isLoggedIn && isPro && (
            <Pressable
              onPress={() => setHidePosted((h) => !h)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 5,
                backgroundColor: hidePosted ? "#4A9EDB" : "rgba(255,255,255,0.12)",
                borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
              }}
            >
              <Ionicons name={hidePosted ? "eye-off" : "eye-outline"} size={13} color={hidePosted ? "#fff" : "#7a96ae"} />
              <Text style={{ color: hidePosted ? "#fff" : "#7a96ae", fontSize: 12, fontWeight: "700" }}>
                Hide Posted
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Category tabs */}
      <View style={{ backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#e0e7ef" }}>
        <CategoryTabs categories={categories} selected={category} onSelect={setCategory} />
      </View>

      {/* Trending hashtags */}
      {trending.length > 0 && (
        <View style={{ backgroundColor: "#F5F0E8", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
          <Text style={{ color: "#6b7a8d", fontSize: 11, fontWeight: "600", marginBottom: 6, letterSpacing: 0.5 }}>
            TRENDING
          </Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={trending.slice(0, 10)}
            keyExtractor={(item) => item.hashtag}
            renderItem={({ item }) => (
              <HashtagPill
                tag={item.hashtag}
                active={hashtag === item.hashtag}
                isTrending={item.is_trending}
                onPress={(t) => setHashtag((prev) => (prev === t ? undefined : t))}
              />
            )}
          />
        </View>
      )}

      {/* Topic Moments — active bursts of 4+ stories on the same topic */}
      {topics.length > 0 && (
        <View style={{ backgroundColor: "#F5F0E8", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Ionicons name="flame" size={13} color="#f97316" style={{ marginRight: 5 }} />
            <Text style={{ color: "#2c3e50", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
              TOPIC MOMENTS
            </Text>
            <Text style={{ color: "#9aabb8", fontSize: 10, marginLeft: 6 }}>
              multiple stories breaking in 24h
            </Text>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={topics}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
            renderItem={({ item: topic }) => (
              <Pressable
                onPress={() => {
                  if (topic.top_story?.id) {
                    navigation.navigate("StoryDetail", { storyId: topic.top_story.id });
                  }
                }}
                style={{
                  backgroundColor: "#fff7ed",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#fed7aa",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  maxWidth: 200,
                  minWidth: 140,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                  <View style={{
                    backgroundColor: "#f97316", borderRadius: 10,
                    paddingHorizontal: 6, paddingVertical: 2, marginRight: 6,
                  }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                      {topic.story_count} stories
                    </Text>
                  </View>
                </View>
                <Text
                  style={{ color: "#7c2d12", fontSize: 13, fontWeight: "700", textTransform: "capitalize" }}
                  numberOfLines={2}
                >
                  {topic.topic_label}
                </Text>
                {topic.top_story && (
                  <Text style={{ color: "#9a3412", fontSize: 11, marginTop: 3 }} numberOfLines={2}>
                    {topic.top_story.title}
                  </Text>
                )}
              </Pressable>
            )}
          />
        </View>
      )}

      {/* Story list + FAB */}
      <View style={{ flex: 1 }}>
      {loading ? (
        <View style={{ flex: 1, paddingTop: 12, backgroundColor: "#F5F0E8" }}>
          {[1, 2, 3, 4].map((k) => (
            <SkeletonCard key={k} />
          ))}
        </View>
      ) : (
        <FlatList
          style={{ backgroundColor: "#F5F0E8" }}
          data={hidePosted && isPro ? stories.filter((s) => !s.used) : stories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <StoryCard
              story={item}
              onPress={handleStoryPress}
              viewed={viewedIds.has(item.id)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4A9EDB"
              colors={["#4A9EDB"]}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 48, paddingHorizontal: 32 }}>
              {fetchError ? (
                <>
                  <Ionicons name="warning-outline" size={36} color="#f59e0b" style={{ marginBottom: 10 }} />
                  <Text style={{ color: "#2c3e50", fontWeight: "700", fontSize: 15, marginBottom: 6, textAlign: "center" }}>
                    Could not load stories
                  </Text>
                  <Text style={{ color: "#6b7a8d", fontSize: 12, textAlign: "center" }}>
                    {fetchError}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="water-outline" size={36} color="#b0bec5" style={{ marginBottom: 10 }} />
                  <Text style={{ color: "#6b7a8d", fontSize: 15, textAlign: "center" }}>
                    No stories yet.{"\n"}New stories are added every morning.
                  </Text>
                </>
              )}
            </View>
          }
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 1,
                backgroundColor: "#ddd8d0",
                marginHorizontal: 14,
                marginVertical: 2,
              }}
            />
          )}
          contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }}
        />
      )}

      </View>
    </SafeAreaView>
  );
}
