import type { Story } from "../api/stories";

export function deduplicateClusters(stories: Story[]): Story[] {
  const best: Map<string, Story> = new Map();
  const unclustered: Story[] = [];

  for (const story of stories) {
    if (!story.cluster_id) {
      unclustered.push(story);
      continue;
    }
    const existing = best.get(story.cluster_id);
    if (!existing || story.engagement_score > existing.engagement_score) {
      best.set(story.cluster_id, story);
    }
  }

  return [...unclustered, ...Array.from(best.values())];
}
