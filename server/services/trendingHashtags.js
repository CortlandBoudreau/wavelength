const pool = require('../db/pool');

/**
 * Returns the top N hashtags seen in Claude-generated summaries
 * from the last `days` days, along with their occurrence counts.
 */
async function getTrendingHashtags({ days = 7, limit = 20 } = {}) {
  // summaries.hashtags is stored as a JSON array string, e.g. ["#ocean","#science",...]
  // We unnest it using json_array_elements_text so we get one row per hashtag.
  const { rows } = await pool.query(
    `
    SELECT
      hashtag,
      COUNT(*) AS count
    FROM (
      SELECT json_array_elements_text(hashtags::json) AS hashtag
      FROM summaries
      JOIN stories ON stories.id = summaries.story_id
      WHERE stories.published_at > NOW() - ($1 || ' days')::INTERVAL
        AND summaries.hashtags IS NOT NULL
        AND summaries.hashtags != '[]'
    ) sub
    WHERE hashtag LIKE '#%'
    GROUP BY hashtag
    ORDER BY count DESC, hashtag ASC
    LIMIT $2
    `,
    [days, limit]
  );

  return rows.map((r) => ({ hashtag: r.hashtag, count: parseInt(r.count, 10) }));
}

module.exports = { getTrendingHashtags };
