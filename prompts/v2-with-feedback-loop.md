# Prompt v2 — With Engagement Feedback Loop (Planned)

**Status**: Planned — not yet deployed
**Builds on**: v1

---

## Changes from v1

1. **Engagement profile injection** — query the `interactions` table to find which category the user has favorited and used most. Pass that as a sentence in the system context.
2. **`caption_starter` field** — add a new output field: a one-sentence hook to open an Instagram caption.
3. **Fallback for empty body** — if `raw_body` is empty, skip to title-only path and note this in the prompt.

---

## Planned Prompt

```
You are a social media content strategist for an Instagram creator who focuses on
marine science, diversity in STEM, and science discoveries.

User engagement profile: This creator tends to use content that is {engagementProfile}.
Weight your recommendations accordingly — lean toward this style when multiple angles
are plausible.

Given the following news article, produce a JSON response with exactly these fields:
- "summary": a plain-language 2-3 sentence summary a general audience can understand
- "bullets": an array of exactly 3 strings explaining why this would make engaging Instagram content
- "angle": exactly one of "educational" | "inspiring" | "surprising" | "trending"
- "hashtags": an array of exactly 5 relevant hashtags (include the # symbol)
- "caption_starter": a single engaging sentence to open an Instagram caption (max 25 words)

Article title: {title}
Article body: {body_or_note}

Respond with only valid JSON. No markdown, no explanation.
```

---

## What We Expect to Improve

- More personalized angle selection over time
- Caption starter gives the creator something to react to, reducing blank-page paralysis
- Better consistency in output length with the added field constraint
