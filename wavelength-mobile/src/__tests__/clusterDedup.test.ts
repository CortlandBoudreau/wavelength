import { deduplicateClusters } from "../utils/clusterDedup";
import type { Story } from "../api/stories";

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: Math.random().toString(),
    title: "Test story",
    source: "ScienceDaily",
    url: "https://example.com",
    published_at: new Date().toISOString(),
    category: "science",
    cluster_id: null,
    summary: "A summary.",
    bullets: [],
    angle: "educational",
    hashtags: [],
    engagement_score: 5,
    favorited: false,
    used: false,
    notes: null,
    tags: [],
    ...overrides,
  };
}

describe("deduplicateClusters", () => {
  test("returns empty array for empty input", () => {
    expect(deduplicateClusters([])).toEqual([]);
  });

  test("passes through stories with no cluster_id unchanged", () => {
    const stories = [makeStory({ cluster_id: null }), makeStory({ cluster_id: null })];
    expect(deduplicateClusters(stories)).toHaveLength(2);
  });

  test("keeps only the highest-scored story per cluster", () => {
    const low  = makeStory({ cluster_id: "c1", engagement_score: 4 });
    const high = makeStory({ cluster_id: "c1", engagement_score: 9 });
    const result = deduplicateClusters([low, high]);
    expect(result).toHaveLength(1);
    expect(result[0].engagement_score).toBe(9);
  });

  test("handles multiple distinct clusters independently", () => {
    const a1 = makeStory({ cluster_id: "c1", engagement_score: 3 });
    const a2 = makeStory({ cluster_id: "c1", engagement_score: 7 });
    const b1 = makeStory({ cluster_id: "c2", engagement_score: 6 });
    const b2 = makeStory({ cluster_id: "c2", engagement_score: 2 });
    const result = deduplicateClusters([a1, a2, b1, b2]);
    expect(result).toHaveLength(2);
    const scores = result.map((s) => s.engagement_score).sort((a, b) => b - a);
    expect(scores).toEqual([7, 6]);
  });

  test("preserves unclustered stories alongside deduplicated clusters", () => {
    const loose    = makeStory({ cluster_id: null });
    const clustered = makeStory({ cluster_id: "c1", engagement_score: 8 });
    const result = deduplicateClusters([loose, clustered]);
    expect(result).toHaveLength(2);
  });

  test("handles a single story in a cluster", () => {
    const story = makeStory({ cluster_id: "c1", engagement_score: 5 });
    const result = deduplicateClusters([story]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(story);
  });

  test("equal-scored cluster stories keep the first seen (strict >)", () => {
    // The function uses strict > so a tie does NOT replace the incumbent
    const first  = makeStory({ id: "first",  cluster_id: "c1", engagement_score: 5 });
    const second = makeStory({ id: "second", cluster_id: "c1", engagement_score: 5 });
    const result = deduplicateClusters([first, second]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("first");
  });
});
