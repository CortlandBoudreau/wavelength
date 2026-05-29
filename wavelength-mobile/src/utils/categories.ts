export const CATEGORY_EMOJI: Record<string, string> = {
  // Ocean / waves theme
  marine_science:   "🌊",
  coral_reefs:      "🪸",
  deep_sea:         "🦑",
  conservation:     "🌱",
  ecology:          "🍃",
  coastal_science:  "🏖️",
  ocean_chemistry:  "🧪",
  polar_science:    "🧊",
  aquaculture:      "🐟",
  plastic_pollution: "♻️",
  biodiversity:     "🦋",
  ocean_tech:       "⚓",
  wildlife:         "🦈",
  cool_facts:       "🤯",
  climate:          "🌍",
  environment:      "🌿",
  diversity_stem:   "🌟",
  // Legacy / fallback
  space:            "🚀",
  science:          "🔬",
  biology:          "🧬",
  physics:          "⚛️",
  technology:       "💡",
  medicine:         "🧠",
  health_science:   "🧠",
  chemistry:        "🧫",
  general:          "✨",
};

/**
 * Ordered list of all known categories shown in the onboarding interests picker.
 * Kept in sync with the aggregator's CATEGORY_QUERIES.
 * The feed's CategoryTabs still uses the DB query so only tabs with content appear.
 */
export const ALL_CATEGORIES: string[] = [
  "marine_science",
  "coral_reefs",
  "deep_sea",
  "conservation",
  "ecology",
  "coastal_science",
  "ocean_chemistry",
  "polar_science",
  "aquaculture",
  "plastic_pollution",
  "biodiversity",
  "ocean_tech",
  "wildlife",
  "cool_facts",
  "climate",
  "environment",
  "diversity_stem",
];

export function formatCategory(cat: string): string {
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function categoryEmoji(cat: string): string {
  return CATEGORY_EMOJI[cat] ?? "📰";
}
