import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchStories, searchStories, type Story, type Category } from "../api/stories";
import { fetchTrendingHashtags } from "../api/trending";
import { deduplicateClusters } from "../utils/clusterDedup";
import { getGuestStoryViewsToday, incrementGuestStoryViews } from "../utils/guestStorage";
import { useAuth } from "../context/AuthContext";
import StoryCard from "../components/StoryCard";
import SkeletonCard from "../components/SkeletonCard";
import CategoryTabs from "../components/CategoryTabs";
import HashtagPill from "../components/HashtagPill";
import WaveLogo from "../components/WaveLogo";
import type { RootStackParamList } from "../navigation/AppNavigator";

const FREE_DETAIL_LIMIT = 3;

type DashboardNav = NativeStackNavigationProp<RootStackParamList>;

const TRENDING_STALE_MS = 5 * 60 * 1000;

export default function Dashboard() {
  const navigation = useNavigation<DashboardNav>();
  const { isGuest, user, guestInterests } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  // Use the interests the user picked during onboarding as the category tabs
  const categories: Category[] = (user?.interests ?? guestInterests) as Category[];
  const [category, setCategory] = useState<Category | "all">("all");
  const [hashtag, setHashtag] = useState<string | undefined>();
  const [trending, setTrending] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const trendingFetchedAt = useRef<number>(0);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStories = useCallback(async () => {
    try {
      setFetchError(null);
      const result = await fetchStories({
        category:   category !== "all" ? category    : undefined,
        categories: category === "all" ? categories  : undefined,
        hashtag,
      });
      setStories(deduplicateClusters(result.stories));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFetchError(msg);
    }
  }, [category, hashtag]);

  const loadTrending = useCallback(async () => {
    if (Date.now() - trendingFetchedAt.current < TRENDING_STALE_MS) return;
    try {
      const data = await fetchTrendingHashtags();
      setTrending(data.map((t) => t.hashtag));
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
      const views = await getGuestStoryViewsToday();
      if (views >= FREE_DETAIL_LIMIT) {
        navigation.navigate("Paywall");
        return;
      }
      await incrementGuestStoryViews();
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStories();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1a2a3a" }} edges={["top", "left", "right"]}>
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
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <HashtagPill
                tag={item}
                active={hashtag === item}
                onPress={(t) => setHashtag((prev) => (prev === t ? undefined : t))}
              />
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
          data={stories}
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
