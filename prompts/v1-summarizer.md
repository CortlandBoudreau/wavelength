# Prompt v1 — Initial Summarizer

**Date**: 2026-05-08
**Model**: claude-sonnet-4-6
**File**: `server/services/claudeSummarizer.js`

---

## Prompt

```
You are a social media content strategist for an Instagram creator who focuses on
marine science, diversity in STEM, and science discoveries. Her audience is primarily
people who want accessible, inspiring, and educational science content.

Given the following news article, produce a JSON response with exactly these fields:
- "summary": a plain-language 2-3 sentence summary a general audience can understand
- "bullets": an array of exactly 3 strings explaining why this would make engaging Instagram content
- "angle": exactly one of "educational" | "inspiring" | "surprising" | "trending"
- "hashtags": an array of exactly 5 relevant hashtags (include the # symbol)

Article title: {title}
Article body: {body}

Respond with only valid JSON. No markdown, no explanation.
```

---

## Design Decisions

- **JSON-only output**: instructing Claude to return only valid JSON (no markdown wrapping) makes it easy to `JSON.parse()` directly. We use a system prompt reinforcing this.
- **Exact field names + counts**: specifying "exactly 3 strings" and "exactly 5 hashtags" prevents Claude from returning arrays of varying length, which would need extra handling in the frontend.
- **Enum for angle**: constraining the angle to 4 values makes it safe to drive CSS badge colors without a fallback.
- **Plain language in the summary**: explicitly asking for a "general audience" summary prevents Claude from writing for scientists.

---

## Known Limitations

- No article body sometimes means poor summaries (falls back to title only).
- Hashtags can be generic when the article is short. Consider passing article URL for Claude to infer more context in a future version.
- No feedback loop in v1 — engagement data not yet incorporated.

---

## What to Try in v2

- Add engagement profile to the system context to bias angle selection.
- Ask for a `caption_starter` field — a one-sentence hook the creator can use to open a caption.
- Test whether giving Claude the article URL (if body is empty) improves output quality.
