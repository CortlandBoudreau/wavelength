import { categoryEmoji, formatCategory, CATEGORY_EMOJI, ALL_CATEGORIES } from "../utils/categories";

describe("formatCategory", () => {
  test("converts underscore_case to Title Case", () => {
    expect(formatCategory("marine_science")).toBe("Marine Science");
    expect(formatCategory("deep_sea")).toBe("Deep Sea");
    expect(formatCategory("health_science")).toBe("Health Science");
  });

  test("handles single-word categories", () => {
    expect(formatCategory("space")).toBe("Space");
    expect(formatCategory("science")).toBe("Science");
  });

  test("handles two-word categories", () => {
    expect(formatCategory("plastic_pollution")).toBe("Plastic Pollution");
  });
});

describe("categoryEmoji", () => {
  test("returns correct emoji for known categories", () => {
    expect(categoryEmoji("marine_science")).toBe("🌊");
    expect(categoryEmoji("space")).toBe("🚀");
    expect(categoryEmoji("coral_reefs")).toBe("🪸");
    expect(categoryEmoji("climate")).toBe("🌍");
  });

  test("returns fallback emoji for unknown category", () => {
    expect(categoryEmoji("unknown_category")).toBe("📰");
    expect(categoryEmoji("")).toBe("📰");
  });
});

describe("CATEGORY_EMOJI", () => {
  test("all ALL_CATEGORIES entries have an emoji defined", () => {
    for (const cat of ALL_CATEGORIES) {
      expect(CATEGORY_EMOJI[cat]).toBeTruthy();
    }
  });
});

describe("ALL_CATEGORIES", () => {
  test("is a non-empty array", () => {
    expect(Array.isArray(ALL_CATEGORIES)).toBe(true);
    expect(ALL_CATEGORIES.length).toBeGreaterThan(0);
  });

  test("contains no duplicates", () => {
    const unique = new Set(ALL_CATEGORIES);
    expect(unique.size).toBe(ALL_CATEGORIES.length);
  });

  test("all entries are non-empty strings", () => {
    for (const cat of ALL_CATEGORIES) {
      expect(typeof cat).toBe("string");
      expect(cat.length).toBeGreaterThan(0);
    }
  });
});
