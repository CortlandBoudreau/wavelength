const cron = require('node-cron');
const { runAggregation } = require('./newsAggregator');
const { summarizeUnsummarized } = require('./claudeSummarizer');
const { clusterRecentStories } = require('./clusterStories');
const { updateDecayedScores } = require('./freshnessDecay');
const { detectAndNotify, expireOldTopics } = require('./topicBursts');
const { sendPostingReminders } = require('./postingReminder');
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
  // ── Aggregation pipeline ────────────────────────────────────────────────────
  // AGGREGATION_RUNS_PER_DAY controls how many times per day the full pipeline
  // runs (fetch → summarize → cluster → decay → burst detection).
  //   1 = once daily at 10:00 AM  (staging / dev — cheapest)
  //   2 = 10:00 AM + 4:00 PM      (moderate)
  //   3 = 2:00 AM + 10:00 AM + 4:00 PM (production default)
  const runsPerDay = parseInt(process.env.AGGREGATION_RUNS_PER_DAY ?? '3', 10);
  console.log(`[Scheduler] Aggregation runs per day: ${runsPerDay}`);

  async function runPipeline(label) {
    console.log(`[Scheduler] Running ${label} aggregation...`);
    try {
      await runAggregation();
      await summarizeUnsummarized();
      await clusterRecentStories();
      await updateDecayedScores();
      await detectAndNotify();
    } catch (err) {
      console.error('[Scheduler] Aggregation error:', err);
    }
  }

  // 2:00 AM — overnight + international coverage (runs=3 only)
  if (runsPerDay >= 3) {
    cron.schedule('0 2 * * *', () => runPipeline('overnight'));
  }

  // 10:00 AM — morning news cycle (always runs)
  cron.schedule('0 10 * * *', () => runPipeline('morning'));

  // 4:00 PM — afternoon publications (runs=2 or 3)
  if (runsPerDay >= 2) {
    cron.schedule('0 16 * * *', () => runPipeline('afternoon'));
  }

  // Outbound email jobs (digest + posting reminders) go to the admin EMAIL_TO.
  // Set EMAIL_JOBS_ENABLED=false on non-production environments (e.g. staging) so
  // only one Railway service sends — otherwise every running service fires its
  // own 8am digest to the same address, producing duplicate emails.
  const emailJobsEnabled = process.env.EMAIL_JOBS_ENABLED !== 'false';

  if (emailJobsEnabled) {
    // 8:00 AM daily — send email digest
    cron.schedule('0 8 * * *', async () => {
      console.log('[Scheduler] Sending morning digest...');
      try {
        await sendDigest();
      } catch (err) {
        console.error('[Scheduler] Digest error:', err);
      }
    });

    // 8:00 PM daily — posting reminder (after the day's content window has passed)
    cron.schedule('0 20 * * *', async () => {
      console.log('[Scheduler] Sending posting reminders...');
      try {
        await sendPostingReminders();
      } catch (err) {
        console.error('[Scheduler] Posting reminder error:', err);
      }
    });
  } else {
    console.log('[Scheduler] EMAIL_JOBS_ENABLED=false — skipping digest & posting reminders');
  }

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

  console.log(`[Scheduler] Cron jobs registered (cleanup, aggregation, email jobs ${emailJobsEnabled ? 'ON' : 'OFF'})`);
}

module.exports = { startScheduler };
