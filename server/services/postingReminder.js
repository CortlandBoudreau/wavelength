/**
 * Posting Reminder Service
 *
 * Runs nightly. For each user who has:
 *   - posting_reminder: true in their notification_prefs
 *   - a push_token on file
 *   - NOT marked any story as `used` in the last N days
 *     (where N = notification_prefs.posting_reminder_days, default 5)
 *
 * ...sends an Expo push notification nudging them to post.
 *
 * Also checks how many high-quality stories are waiting (score ≥ 7, unused)
 * so the notification body can be specific: "3 strong stories are waiting."
 */

const pool = require('../db/pool');

async function sendPostingReminders() {
  // Find users who are overdue and want a reminder
  const { rows: users } = await pool.query(`
    SELECT
      u.id,
      u.push_token,
      (u.notification_prefs->>'posting_reminder_days')::int AS reminder_days,
      MAX(i.updated_at) FILTER (WHERE i.used = TRUE) AS last_posted_at
    FROM users u
    LEFT JOIN interactions i ON i.user_id = u.id
    WHERE u.push_token IS NOT NULL
      AND (u.notification_prefs->>'posting_reminder')::boolean = TRUE
    GROUP BY u.id, u.push_token, reminder_days
  `);

  if (!users.length) return 0;

  let sent = 0;

  for (const user of users) {
    const reminderDays = user.reminder_days ?? 5;
    const lastPosted = user.last_posted_at ? new Date(user.last_posted_at) : null;
    const daysSincePosted = lastPosted
      ? (Date.now() - lastPosted.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    // Only nudge if overdue
    if (daysSincePosted < reminderDays) continue;

    // Count waiting high-quality stories this user hasn't used
    const { rows: [{ count }] } = await pool.query(`
      SELECT COUNT(*) AS count
      FROM stories s
      INNER JOIN summaries sum ON sum.story_id = s.id
      LEFT JOIN interactions i ON i.story_id = s.id AND i.user_id = $1
      WHERE s.deleted_at IS NULL
        AND s.published_at > NOW() - INTERVAL '7 days'
        AND sum.engagement_score >= 7
        AND (i.used IS NULL OR i.used = FALSE)
    `, [user.id]);

    const waitingCount = parseInt(count, 10);
    const body = waitingCount > 0
      ? `${waitingCount} strong stor${waitingCount === 1 ? 'y' : 'ies'} waiting to be posted.`
      : "Your feed has fresh science stories ready.";

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          to: user.push_token,
          title: "Time to post! 📱",
          body,
          data: { type: 'posting_reminder' },
          sound: 'default',
        }),
      });
      if (res.ok) sent++;
      else console.warn('[PostingReminder] Push failed for user', user.id, res.status);
    } catch (err) {
      console.warn('[PostingReminder] Push error for user', user.id, err.message);
    }
  }

  console.log(`[PostingReminder] Sent ${sent} reminder(s).`);
  return sent;
}

module.exports = { sendPostingReminders };
