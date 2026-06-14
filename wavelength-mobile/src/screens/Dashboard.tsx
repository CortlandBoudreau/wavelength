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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchStories, searchStories, type Story, type Category } from "../api/stories";
import { deduplicateClusters } from "../utils/clusterDedup";
import { GUEST_DAILY_LIMIT, recordGuestStoryView } from "../utils/guestStorage";
import { useAuth } from "../context/AuthContext";
import { isProUser } from "../utils/proCheck";
import StoryCard from "../components/StoryCard";
import SkeletonCard from "../components/SkeletonCard";
import CategoryTabs from "../components/CategoryTabs";
import WaveLogo from "../components/WaveLogo";
import type { RootStackParamList } from "../navigation/AppNavigator";

const FREE_DETAIL_LIMIT = GUEST_DAILY_LIMIT;

// Height of the collapsing section (logo + search + sort chips)
const COLLAPSE_HEIGHT = 108;

type DashboardNav = NativeStackNavigationProp<RootStackParamList>;

export default function Dashboard() {
  const navigation = useNavigation<DashboardNav>();
  const insets = useSafeAreaInsets();
  const { isGuest, user, guestInterests } = useAuth();
  const isLoggedIn = !!user;
  const isPro = isProUser(user);
  const [stories, setStories] = useState<Story[]>([]);
  const categories: Category[] = (user?.interests ?? guestInterests) as Category[];
  const [category, setCategory] = useState<Category | "all">("all");
  const [hashtag, setHashtag] = useState<string | undefined>();
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
  const [newBannerCount, setNewBannerCount] = useState(0);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collapsing header animation — translateY + opacity run on UI thread (native driver)
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, COLLAPSE_HEIGHT],
    outputRange: [0, -COLLAPSE_HEIGHT],
    extrapolate: "clamp",
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_HEIGHT * 0.65],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

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

  useEffect(() => {
    setLoading(true);
    loadStories().finally(() => setLoading(false));
  }, [loadStories]);

  // Handle story tap — check guest limit before navigating
  const handleStoryPress = useCallback(async (story: Story) => {
    if (isGuest) {
      const { alreadySeen, total } = await recordGuestStoryView(story.id);
      // Block once the new total meets or exceeds the cap (total is post-increment)
      if (!alreadySeen && total >= FREE_DETAIL_LIMIT) {
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
    setStories((latest) => {
      const added = latest.filter((s) => !prevIds.has(s.id)).length;
      if (added > 0) showNewBanner(added);
      return latest;
    });
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1a2a3a" }} edges={["left", "right"]}>
      {/* New stories banner */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute", top: insets.top + 60, left: 0, right: 0, zIndex: 99,
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

      {/* ── Sliding header ────────────────────────────────────────
            The entire block (logo+search+sort+categories) translates up
            by COLLAPSE_HEIGHT. Logo/search slide off screen; sort chips
            and category tabs scroll up into their place and become the
            new sticky top. FlatList paddingTop accounts for full height. */}
      <Animated.View style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        zIndex: 10,
        paddingTop: insets.top,
        transform: [{ translateY: headerTranslateY }],
        backgroundColor: "#1a2a3a",
      }}>
        {/* Logo + search — slides off screen on scroll */}
        <View style={{
          height: COLLAPSE_HEIGHT,
          paddingHorizontal: 16,
          paddingTop: 10,
          overflow: "hidden",
        }}>
          <Animated.View style={{ opacity: headerOpacity }}>
            {/* Logo row */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <WaveLogo size="md" />
              {isLoggedIn && isPersonalized && !topToday && (
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 4,
                  backgroundColor: "rgba(99,102,241,0.18)",
                  borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
                }}>
                  <Ionicons name="sparkles" size={12} color="#a78bfa" />
                  <Text style={{ color: "#a78bfa", fontSize: 11, fontWeight: "700" }}>Personalized</Text>
                </View>
              )}
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
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => { setSearchQuery(""); setSearchActive(false); loadStories(); }} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color="#5a7a94" />
                </Pressable>
              )}
            </View>
          </Animated.View>
        </View>

        {/* Sort chips — slide up to become new sticky top */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "nowrap", alignItems: "center" }}>
            <Pressable
              onPress={() => { setTopToday((t) => !t); if (!topToday) setSort("newest"); }}
              style={{
                flexDirection: "row", alignItems: "center", gap: 5,
                backgroundColor: topToday ? "#4A9EDB" : "rgba(255,255,255,0.12)",
                borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
              }}
            >
              <Ionicons name="trophy-outline" size={13} color={topToday ? "#fff" : "#7a96ae"} />
              <Text style={{ color: topToday ? "#fff" : "#7a96ae", fontSize: 12, fontWeight: "700" }}>Top Today</Text>
            </Pressable>

            {!topToday && (
              <Pressable
                onPress={() => setSort((s) => s === "newest" ? "score" : "newest")}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  backgroundColor: sort === "score" ? "#4A9EDB" : "rgba(255,255,255,0.12)",
                  borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
                }}
              >
                <Ionicons name={sort === "score" ? "flame" : "time-outline"} size={13} color={sort === "score" ? "#fff" : "#7a96ae"} />
                <Text style={{ color: sort === "score" ? "#fff" : "#7a96ae", fontSize: 12, fontWeight: "700" }}>
                  {sort === "score" ? "Top Rated" : "Newest"}
                </Text>
              </Pressable>
            )}

            {isLoggedIn && isPro && (
              <Pressable
                onPress={() => setHidePosted((h) => !h)}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  backgroundColor: hidePosted ? "#4A9EDB" : "rgba(255,255,255,0.12)",
                  borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
                }}
              >
                <Ionicons name={hidePosted ? "eye-off" : "eye-outline"} size={13} color={hidePosted ? "#fff" : "#7a96ae"} />
                <Text style={{ color: hidePosted ? "#fff" : "#7a96ae", fontSize: 12, fontWeight: "700" }}>Hide Posted</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Category tabs */}
        <View style={{ backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#e0e7ef" }}>
          <CategoryTabs categories={categories} selected={category} onSelect={setCategory} />
        </View>
      </Animated.View>

      {/* Story list — full screen, header overlays the top via absolute positioning */}
      {loading ? (
          <View style={{ flex: 1, paddingTop: COLLAPSE_HEIGHT + 106 + insets.top, backgroundColor: "#F5F0E8" }}>
            {[1, 2, 3, 4].map((k) => <SkeletonCard key={k} />)}
          </View>
        ) : (
          <Animated.FlatList
            style={{ backgroundColor: "#F5F0E8" }}
            data={hidePosted && isPro ? stories.filter((s) => !s.used) : stories}
            keyExtractor={(item) => item.id}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <StoryCard story={item} onPress={handleStoryPress} viewed={viewedIds.has(item.id)} />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A9EDB" colors={["#4A9EDB"]} />
            }
            ListEmptyComponent={
              <View style={{ alignItems: "center", marginTop: 48, paddingHorizontal: 32 }}>
                {fetchError ? (
                  <>
                    <Ionicons name="warning-outline" size={36} color="#f59e0b" style={{ marginBottom: 10 }} />
                    <Text style={{ color: "#2c3e50", fontWeight: "700", fontSize: 15, marginBottom: 6, textAlign: "center" }}>Could not load stories</Text>
                    <Text style={{ color: "#6b7a8d", fontSize: 12, textAlign: "center" }}>{fetchError}</Text>
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
              <View style={{ height: 1, backgroundColor: "#ddd8d0", marginHorizontal: 14, marginVertical: 2 }} />
            )}
            contentContainerStyle={{ paddingTop: COLLAPSE_HEIGHT + 106 + insets.top, paddingBottom: 32 }}
          />
        )}
    </SafeAreaView>
  );
}
