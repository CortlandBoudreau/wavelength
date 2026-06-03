import client from "./client";

export interface TrendingHashtag {
  hashtag: string;
  count: number;
}

export const fetchTrendingHashtags = async (
  days = 7,
  limit = 20
): Promise<TrendingHashtag[]> => {
  const { data } = await client.get<TrendingHashtag[]>("/trending/hashtags", {
    params: { days, limit },
  });
  return data;
};

export interface TopicMoment {
  id: string;
  topic_label: string;
  story_count: number;
  story_ids: string[];
  first_seen_at: string;
  expires_at: string;
  top_story: { id: string; title: string; category: string } | null;
}

export const fetchTopicMoments = async (): Promise<TopicMoment[]> => {
  const { data } = await client.get<{ topics: TopicMoment[] }>("/trending/topics");
  return data.topics ?? [];
};
