const cron = require('node-cron');
const { runAggregation } = require('./newsAggregator');
const { summarizeUnsummarized } = require('./claudeSummarizer');
const { clusterRecentStories } = require('./clusterStories');
const { updateDecayedScores } = require('./freshnessDecay');
const { detectAndNotify, expireOldTopics } = require('./topicBursts');
const { sendDigest } = require('./emailDigest');
const pool = require('../db/pool');

async function softDeleteOldStories() {
  // Soft-delete stories older than 14 days that no user has saved, used, or annotated.
  // Favorited / used / noted stories are kept indefinitely.
  const { rowCount } = await pool.query(`
    UPDATE stories
    SET deleted_at = NOW()
    WHERE deleted_at IS NULL
      AND created_at < NOW() - INTERVAL '14 days'
      AND id NOT IN (
        SELECT story_id FROM interactions
        WHERE favorited = TRUE
           OR used = TRUE
           OR (notes IS NOT NULL AND notes <> '')
      )
  `);
  console.log(`[Scheduler] Soft-deleted ${rowCount} stories older than 14 days`);
}

function startScheduler() {
  // ── Aggregation pipeline (3× daily) ────────────────────────────────────────
  // Each run: fetch → summarize → cluster → refresh decay scores → detect bursts

  // 2:00 AM — overnight + international coverage
  cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Running overnight aggregation...');
    try {
      await runAggregation();
      await summarizeUnsummarized();
      await clusterRecentStories();
      await updateDecayedScores();
      await detectAndNotify();
    } catch (err) {
      console.error('[Scheduler] Aggregation error:', err);
    }
  });

  // 10:00 AM — morning news cycle
  cron.schedule('0 10 * * *', async () => {
    console.log('[Scheduler] Running morning aggregation...');
    try {
      await runAggregation();
      await summarizeUnsummarized();
      await clusterRecentStories();
      await updateDecayedScores();
      await detectAndNotify();
    } catch (err) {
      console.error('[Scheduler] Aggregation error:', err);
    }
  });

  // 4:00 PM — afternoon publications
  cron.schedule('0 16 * * *', async () => {
    console.log('[Scheduler] Running afternoon aggregation...');
    try {
      await runAggregation();
      await summarizeUnsummarized();
      await clusterRecentStories();
      await updateDecayedScores();
      await detectAndNotify();
    } catch (err) {
      console.error('[Scheduler] Aggregation error:', err);
    }
  });

  // 8:00 AM daily — send email digest
  cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Sending morning digest...');
    try {
      await sendDigest();
    } catch (err) {
      console.error('[Scheduler] Digest error:', err);
    }
  });

  // 3:00 AM daily — soft-delete old stories + expire old topic moments
  cron.schedule('0 3 * * *', async () => {
    console.log('[Scheduler] Running story cleanup...');
    try {
      await softDeleteOldStories();
      await expireOldTopics();
    } catch (err) {
      console.error('[Scheduler] Cleanup error:', err);
    }
  });

  console.log('[Scheduler] Cron jobs registered (3am cleanup, 6am aggregate, 8am digest)');
}

module.exports = { startScheduler };
