/**
 * Unit tests for pure utility functions in claudeSummarizer.js.
 * These functions have no I/O and are safe to test without mocking the DB or Claude.
 */

// claudeSummarizer requires 'pg' pool at module level, so we mock it
jest.mock('../db/pool', () => ({ query: jest.fn() }));

const { _test } = require('../services/claudeSummarizer');
const { detectSourceType, sanitizeForPrompt, parseClaudeResponse, buildThinContentSummary } = _test;

// ── detectSourceType ──────────────────────────────────────────────────────────

describe('detectSourceType', () => {
  test('identifies youtube by url substring', () => {
    expect(detectSourceType('YouTube: Kurzgesagt')).toBe('youtube');
    expect(detectSourceType('youtube.com/channel/abc')).toBe('youtube');
  });

  test('identifies reddit', () => {
    expect(detectSourceType('Reddit r/science')).toBe('reddit');
    expect(detectSourceType('reddit')).toBe('reddit');
  });

  test('identifies bluesky', () => {
    expect(detectSourceType('Bluesky: science')).toBe('bluesky');
  });

  test('identifies mastodon', () => {
    expect(detectSourceType('Mastodon: #oceanscience')).toBe('mastodon');
  });

  test('identifies arxiv by exact match only', () => {
    expect(detectSourceType('arxiv')).toBe('arxiv');
    expect(detectSourceType('ARXIV')).toBe('arxiv');
    // Substrings like 'arxiv.org' are NOT detected — falls through to article
    expect(detectSourceType('arxiv.org')).toBe('article');
  });

  test('defaults to article for RSS/unknown sources', () => {
    expect(detectSourceType('ScienceDaily')).toBe('article');
    expect(detectSourceType('Nature News')).toBe('article');
    expect(detectSourceType('')).toBe('article');
    expect(detectSourceType(undefined)).toBe('article');
  });
});

// ── sanitizeForPrompt ─────────────────────────────────────────────────────────

describe('sanitizeForPrompt', () => {
  test('returns empty string for null/undefined/non-string', () => {
    expect(sanitizeForPrompt(null)).toBe('');
    expect(sanitizeForPrompt(undefined)).toBe('');
    expect(sanitizeForPrompt(42)).toBe('');
  });

  test('replaces XML article tags with [tag] to prevent prompt injection', () => {
    const input = 'before <article>injected</article> after';
    const result = sanitizeForPrompt(input);
    // Tags replaced, surrounding content preserved
    expect(result).toBe('before [tag]injected[tag] after');
  });

  test('strips control characters', () => {
    const input = 'hello\x00world\x07';
    expect(sanitizeForPrompt(input)).toBe('helloworld');
  });

  test('collapses 4+ consecutive newlines to exactly two', () => {
    expect(sanitizeForPrompt('line1\n\n\n\n\nline2')).toBe('line1\n\nline2'); // 5 → 2
    expect(sanitizeForPrompt('line1\n\n\n\nline2')).toBe('line1\n\nline2');  // 4 → 2 (boundary)
  });

  test('does not collapse 3 or fewer consecutive newlines', () => {
    // regex is {4,} so 3 newlines must be left alone
    expect(sanitizeForPrompt('line1\n\n\nline2')).toBe('line1\n\n\nline2');
    expect(sanitizeForPrompt('line1\n\nline2')).toBe('line1\n\nline2');
  });

  test('truncates to maxLength', () => {
    const long = 'a'.repeat(3000);
    expect(sanitizeForPrompt(long, 100).length).toBe(100);
  });

  test('uses default maxLength of 2000', () => {
    const long = 'a'.repeat(3000);
    expect(sanitizeForPrompt(long).length).toBe(2000);
  });

  test('trims leading/trailing whitespace', () => {
    expect(sanitizeForPrompt('  hello  ')).toBe('hello');
  });
});

// ── parseClaudeResponse ───────────────────────────────────────────────────────

describe('parseClaudeResponse', () => {
  const makeJson = (overrides = {}) => JSON.stringify({
    summary: 'Sharks can detect electrical fields.',
    bullets: ['Cool fact', 'Broad appeal', 'Visually strong'],
    angle: 'surprising',
    hashtags: ['#Sharks', '#OceanScience', '#MarineBiology', '#DeepSea', '#Wildlife'],
    engagement_score: 8,
    ...overrides,
  });

  test('parses a well-formed Claude response', () => {
    const result = parseClaudeResponse(makeJson());
    expect(result.summary).toBe('Sharks can detect electrical fields.');
    expect(result.bullets).toHaveLength(3);
    expect(result.angle).toBe('surprising');
    expect(result.hashtags).toHaveLength(5);
    expect(result.engagement_score).toBe(8);
  });

  test('strips markdown code fences if present', () => {
    const fenced = '```json\n' + makeJson() + '\n```';
    const result = parseClaudeResponse(fenced);
    expect(result.summary).toBe('Sharks can detect electrical fields.');
  });

  test('caps summary at 600 chars', () => {
    const result = parseClaudeResponse(makeJson({ summary: 's'.repeat(700) }));
    expect(result.summary.length).toBe(600);
  });

  test('caps bullet count at 5', () => {
    const result = parseClaudeResponse(makeJson({ bullets: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }));
    expect(result.bullets.length).toBe(5);
  });

  test('rejects invalid angle and falls back to educational', () => {
    const result = parseClaudeResponse(makeJson({ angle: 'viral' }));
    expect(result.angle).toBe('educational');
  });

  test('defaults engagement_score to 5 when missing', () => {
    const result = parseClaudeResponse(makeJson({ engagement_score: null }));
    expect(result.engagement_score).toBe(5);
  });

  test('defaults engagement_score to 5 when out of range', () => {
    expect(parseClaudeResponse(makeJson({ engagement_score: 0 })).engagement_score).toBe(5);
    expect(parseClaudeResponse(makeJson({ engagement_score: 11 })).engagement_score).toBe(5);
  });

  test('strips non-word characters from hashtags', () => {
    const result = parseClaudeResponse(makeJson({ hashtags: ['#Ocean Science!', '#valid'] }));
    // Space and ! are removed, leaving only word chars and #
    expect(result.hashtags[0]).toBe('#OceanScience');
    expect(result.hashtags[1]).toBe('#valid');
  });

  test('caps hashtag array at 10', () => {
    const result = parseClaudeResponse(makeJson({ hashtags: Array.from({ length: 15 }, (_, i) => `#tag${i}`) }));
    expect(result.hashtags.length).toBe(10);
  });

  test('handles empty bullets array gracefully', () => {
    const result = parseClaudeResponse(makeJson({ bullets: [] }));
    expect(result.bullets).toEqual([]);
  });

  test('throws on completely invalid JSON', () => {
    // Callers are expected to handle this — document the contract
    expect(() => parseClaudeResponse('not json at all')).toThrow();
    expect(() => parseClaudeResponse('')).toThrow();
  });
});

// ── buildThinContentSummary ───────────────────────────────────────────────────

describe('buildThinContentSummary', () => {
  const story = { id: '123', title: 'Octopuses can dream' };

  test('uses the story title as the summary', () => {
    const result = buildThinContentSummary(story);
    expect(result.summary).toBe(story.title);
  });

  test('returns exactly 3 bullets', () => {
    const result = buildThinContentSummary(story);
    expect(result.bullets).toHaveLength(3);
  });

  test('returns a valid angle', () => {
    const result = buildThinContentSummary(story);
    expect(['educational', 'inspiring', 'surprising', 'trending']).toContain(result.angle);
  });

  test('returns the expected default hashtags', () => {
    const result = buildThinContentSummary(story);
    expect(result.hashtags).toEqual(['#Science', '#ScienceNews', '#LearnSomethingNew', '#ScienceFacts', '#Discovery']);
  });

  test('marks result as thin content', () => {
    const result = buildThinContentSummary(story);
    expect(result._thin).toBe(true);
  });

  test('returns an engagement_score of 5', () => {
    const result = buildThinContentSummary(story);
    expect(result.engagement_score).toBe(5);
  });
});
