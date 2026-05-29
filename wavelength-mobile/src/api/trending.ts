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
