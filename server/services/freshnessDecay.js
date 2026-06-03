/**
 * Freshness Decay Service
 *
 * Recalculates `summaries.decayed_score` for all active stories.
 *
 * Formula:  decayed_score = engagement_score / (1 + age_days * 0.15)
 *
 * Decay curve (engagement_score = 8 example):
 *   Day 0 → 8.0   (full score)
 *   Day 1 → 6.96
 *   Day 2 → 6.15
 *   Day 3 → 5.52
 *   Day 5 → 4.57
 *   Day 7 → 3.81
 *   Day 14 → 2.51
 *
 * Runs nightly after aggregation so the feed always reflects "good AND recent."
 */

const pool = require('../db/pool');

async function updateDecayedScores() {
  const { rowCount } = await pool.query(`
    UPDATE summaries s
    SET decayed_score = ROUND(
      (s.engagement_score /
        (1 + EXTRACT(EPOCH FROM NOW() - st.published_at) / 86400.0 * 0.15)
      )::numeric, 2
    )
    FROM stories st
    WHERE st.id = s.story_id
      AND st.deleted_at IS NULL
  `);
  console.log(`[FreshnessDecay] Updated decayed_score for ${rowCount} stories.`);
  return rowCount;
}

module.exports = { updateDecayedScores };
