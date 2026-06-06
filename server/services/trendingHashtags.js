const pool = require('../db/pool');

/**
 * Returns hashtags ranked by TRENDING VELOCITY, not raw count.
 *
 * Velocity = recent_count / max(baseline_daily_avg, 0.5)
 *
 * "Recent" window:  last 24 hours
 * "Baseline" window: the 6 days before that (days 1–7)
 *
 * Examples:
 *   #CRISPR:  recent=8, baseline_avg=1.0 → velocity 8.0  ← genuinely trending
 *   #Science: recent=9, baseline_avg=9.0 → velocity 1.0  ← just popular, not trending
 *   #NewTopic: recent=4, baseline_avg=0  → velocity 8.0  ← brand new burst
 *
 * Hashtags with zero recent appearances are excluded.
 * A minimum recent count of 2 filters out one-off noise.
 *
 * Falls back to count-ranked results if there are fewer than 3 trending hashtags,
 * so the UI always has something to show even on a fresh/quiet day.
 */
async function getTrendingHashtags({ days = 7, limit = 20 } = {}) {
  const { rows } = await pool.query(`
    WITH all_tags AS (
      -- Unnest every hashtag from summaries in the last ${days} days
      SELECT
        json_array_elements_text(sum.hashtags::json) AS hashtag,
        s.published_at
      FROM summaries sum
      JOIN stories s ON s.id = sum.story_id
      WHERE s.published_at > NOW() - INTERVAL '7 days'
        AND sum.hashtags IS NOT NULL
        AND sum.hashtags != '[]'
        AND s.deleted_at IS NULL
    ),
    recent AS (
      -- Last 24 hours
      SELECT hashtag, COUNT(*) AS recent_count
      FROM all_tags
      WHERE published_at > NOW() - INTERVAL '24 hours'
        AND hashtag LIKE '#%'
      GROUP BY hashtag
      HAVING COUNT(*) >= 2   -- filter single-story noise
    ),
    baseline AS (
      -- Days 1–7 (everything outside the recent window)
      SELECT hashtag, COUNT(*) / 6.0 AS daily_avg
      FROM all_tags
      WHERE published_at <= NOW() - INTERVAL '24 hours'
        AND hashtag LIKE '#%'
      GROUP BY hashtag
    )
    SELECT
      r.hashtag,
      r.recent_count                                        AS count,
      COALESCE(b.daily_avg, 0)                              AS baseline_avg,
      ROUND(
        (r.recent_count / GREATEST(COALESCE(b.daily_avg, 0), 0.5))::numeric
      , 2)                                                  AS velocity
    FROM recent r
    LEFT JOIN baseline b ON b.hashtag = r.hashtag
    ORDER BY velocity DESC, r.recent_count DESC
    LIMIT $1
  `, [limit]);

  // If fewer than 3 results (quiet day / new install), fall back to 7-day count ranking
  if (rows.length < 3) {
    const { rows: fallback } = await pool.query(`
      SELECT
        hashtag,
        COUNT(*) AS count,
        0         AS baseline_avg,
        1         AS velocity
      FROM (
        SELECT json_array_elements_text(sum.hashtags::json) AS hashtag
        FROM summaries sum
        JOIN stories s ON s.id = sum.story_id
        WHERE s.published_at > NOW() - INTERVAL '7 days'
          AND sum.hashtags IS NOT NULL
          AND sum.hashtags != '[]'
          AND s.deleted_at IS NULL
      ) sub
      WHERE hashtag LIKE '#%'
      GROUP BY hashtag
      ORDER BY count DESC
      LIMIT $1
    `, [limit]);

    return fallback.map((r) => ({
      hashtag:      r.hashtag,
      count:        parseInt(r.count, 10),
      velocity:     1,
      is_trending:  false,
    }));
  }

  return rows.map((r) => ({
    hashtag:     r.hashtag,
    count:       parseInt(r.count, 10),
    velocity:    parseFloat(r.velocity),
    // Mark as "hot" if velocity is 3× or more above baseline
    is_trending: parseFloat(r.velocity) >= 3,
  }));
}

module.exports = { getTrendingHashtags };
