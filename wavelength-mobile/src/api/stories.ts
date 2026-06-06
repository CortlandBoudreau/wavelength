import client from "./client";

// Category is now a plain string — driven by whatever is in the DB
export type Category = string;

export interface Story {
  id: string;
  title: string;
  source: string;
  url: string;
  published_at: string;
  category: string;
  cluster_id: string | null;
  cluster_size?: number;
  summary: string;
  bullets: string[];
  angle: string;
  hashtags: string[];
  engagement_score: number;
  favorited: boolean;
  used: boolean;
  notes: string | null;
  tags: string[];
}

export const fetchCategories = async (): Promise<Category[]> => {
  const { data } = await client.get<Category[]>("/stories/categories");
  return data;
};

export interface FetchStoriesParams {
  category?: Category;
  categories?: Category[];  // multi-category filter for the "All" tab
  sort?: string;
  hashtag?: string;
  since?: number;   // only return stories from the last N hours
  limit?: number;
}

export interface FetchStoriesResult {
  stories: Story[];
  /** True when the feed was filtered by the user's category affinity model. */
  personalized?: boolean;
}

export const fetchStories = async (params?: FetchStoriesParams): Promise<FetchStoriesResult> => {
  const { categories, ...rest } = params ?? {};
  const query: Record<string, unknown> = { ...rest };
  // Axios serialises arrays as repeated params — join to a single comma string instead
  if (categories && categories.length > 0) query.categories = categories.join(",");
  const { data } = await client.get<FetchStoriesResult>("/stories", { params: query });
  return data;
};

export const fetchStory = async (id: string): Promise<Story> => {
  const { data } = await client.get<Story>(`/stories/${id}`);
  return data;
};

export const refreshStories = async (): Promise<void> => {
  await client.post("/stories/refresh");
};

export const toggleFavorite = async (id: string): Promise<{ favorited: boolean }> => {
  const { data } = await client.patch<{ favorited: boolean }>(`/stories/${id}/favorite`);
  return data;
};

export const toggleUsed = async (id: string): Promise<{ used: boolean }> => {
  const { data } = await client.patch<{ used: boolean }>(`/stories/${id}/used`);
  return data;
};

export const saveStoryNotes = async (id: string, notes: string): Promise<void> => {
  await client.patch(`/stories/${id}/notes`, { notes });
};

export const generateCaption = async (id: string): Promise<string> => {
  const { data } = await client.post<{ caption: string }>(`/stories/${id}/caption`);
  return data.caption;
};

export const searchStories = async (q: string): Promise<FetchStoriesResult> => {
  const { data } = await client.get<FetchStoriesResult>("/stories/search", { params: { q } });
  return data;
};

export const fetchRelatedStories = async (id: string): Promise<Story[]> => {
  const { data } = await client.get<{ stories: Story[] }>(`/stories/${id}/related`);
  return data.stories;
};
