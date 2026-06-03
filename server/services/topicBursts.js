/**
 * Topic Burst Detector
 *
 * Identifies "content moments" — groups of 4+ stories sharing key topic tokens
 * published within the last 24 hours.  When a new burst is found:
 *   1. Written to `trending_topics`
 *   2. An Expo push notification is sent to every user who has a push_token
 *
 * Algorithm:
 *   - Tokenize all titles from the last 24 hours (same stop-word list as clusterStories)
 *   - Count token frequency across all titles
 *   - Tokens appearing in 3+ titles are "topic signals"
 *   - Stories sharing a topic signal are grouped into burst candidates
 *   - Candidates with 4+ stories become a topic moment
 *   - Overlapping candidates (>60% shared story IDs) are merged
 *   - Topic label = the 3 highest-frequency tokens from the burst's stories
 *
 * Deduplication: a burst is skipped if a `trending_topics` row already exists
 * with the same label in the last 36 hours.
 */

const pool = require('../db/pool');

// --- Tokenizer (mirrors clusterStories.js) ---
const STOP_WORDS = new Set([
  'the','a','an','in','on','at','to','for','of','and','or','is','are','was','were',
  'has','have','had','that','this','with','from','by','about','as','it','its','be',
  'been','will','can','could','may','might','new','study','shows','found','say','says',
  'scientists','researchers','research','report','reports','first','more','than','into',
  'how','why','what','who','when','where','after','before','over','just','but','not',
  'also','using','used','make','made','like','than','one','two','three','four','five',
  'year','years','day','days','week','weeks','month','months','time','times',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

// --- Expo Push ---
async function sendExpoPush(tokens, title, body, data = {}) {
  if (!tokens.length) return;

  const messages = tokens.map((to) => ({ to, title, body, data, sound: 'default' }));

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[TopicBursts] Expo push API error:', res.status, text.slice(0, 200));
    } else {
      console.log(`[TopicBursts] Sent push to ${tokens.length} device(s).`);
    }
  } catch (err) {
    console.warn('[TopicBursts] Push send failed:', err.message);
  }
}

// --- Main ---
async function detectAndNotify() {
  // 1. Load stories from the last 24 hours
  const { rows: stories } = await pool.query(`
    SELECT s.id, s.title, sum.engagement_score
    FROM stories s
    INNER JOIN summaries sum ON sum.story_id = s.id
    WHERE s.published_at > NOW() - INTERVAL '24 hours'
      AND s.deleted_at IS NULL
    ORDER BY s.published_at DESC
  `);

  if (stories.length < 4) {
    console.log('[TopicBursts] Not enough recent stories to detect bursts.');
    return 0;
  }

  // 2. Tokenize each title and build token → [story_ids] index
  const tokenIndex = new Map(); // token → Set of story IDs
  const storyTokens = new Map(); // story_id → tokens[]

  for (const story of stories) {
    const tokens = tokenize(story.title);
    storyTokens.set(story.id, tokens);
    for (const token of tokens) {
      if (!tokenIndex.has(token)) tokenIndex.set(token, new Set());
      tokenIndex.get(token).add(story.id);
    }
  }

  // 3. Find tokens appearing in 3+ stories
  const burstTokens = [...tokenIndex.entries()]
    .filter(([, ids]) => ids.size >= 3)
    .sort((a, b) => b[1].size - a[1].size);

  if (!burstTokens.length) {
    console.log('[TopicBursts] No burst-signal tokens found.');
    return 0;
  }

  // 4. Build burst candidates (story groups per token, min 4 stories)
  const candidates = [];
  for (const [, storyIds] of burstTokens) {
    if (storyIds.size >= 4) {
      candidates.push(new Set(storyIds));
    }
  }

  if (!candidates.length) {
    console.log('[TopicBursts] No bursts with 4+ stories.');
    return 0;
  }

  // 5. Merge overlapping candidates (>60% Jaccard overlap)
  const merged = [];
  for (const candidate of candidates) {
    let absorbed = false;
    for (const existing of merged) {
      const intersection = [...candidate].filter((id) => existing.has(id)).length;
      const union = new Set([...candidate, ...existing]).size;
      if (intersection / union > 0.6) {
        for (const id of candidate) existing.add(id);
        absorbed = true;
        break;
      }
    }
    if (!absorbed) merged.push(new Set(candidate));
  }

  // 6. For each merged burst, derive a topic label
  let newBursts = 0;
  for (const storyIdSet of merged) {
    const burstStoryIds = [...storyIdSet];
    const storyCount = burstStoryIds.length;

    // Aggregate tokens across all stories in this burst, rank by frequency
    const tokenFreq = new Map();
    for (const storyId of burstStoryIds) {
      for (const token of (storyTokens.get(storyId) ?? [])) {
        tokenFreq.set(token, (tokenFreq.get(token) ?? 0) + 1);
      }
    }
    const topTokens = [...tokenFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);

    const topicLabel = topTokens.join(' ');
    if (!topicLabel) continue;

    // 7. Skip if this burst already exists in the last 36 hours
    const { rows: existing } = await pool.query(
      `SELECT id FROM trending_topics
       WHERE topic_label = $1
         AND first_seen_at > NOW() - INTERVAL '36 hours'`,
      [topicLabel]
    );
    if (existing.length) continue;

    // 8. Write the new burst
    const expiresAt = new Date(Date.now() + 36 * 60 * 60 * 1000);
    const { rows: [inserted] } = await pool.query(
      `INSERT INTO trending_topics (topic_label, story_ids, story_count, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [topicLabel, JSON.stringify(burstStoryIds), storyCount, expiresAt]
    );
    newBursts++;

    console.log(`[TopicBursts] New burst: "${topicLabel}" (${storyCount} stories)`);

    // 9. Send push notification to all users with a push token
    const { rows: tokenRows } = await pool.query(
      `SELECT push_token FROM users WHERE push_token IS NOT NULL`
    );
    const pushTokens = tokenRows.map((r) => r.push_token);

    if (pushTokens.length) {
      const label = topTokens.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      await sendExpoPush(
        pushTokens,
        `🔥 Topic moment: ${label}`,
        `${storyCount} stories in the last 24 hours — great time to post`,
        { type: 'topic_burst', topic_id: inserted.id }
      );

      // Mark as notified
      await pool.query(
        `UPDATE trending_topics SET notified = TRUE WHERE id = $1`,
        [inserted.id]
      );
    }
  }

  console.log(`[TopicBursts] ${newBursts} new burst(s) written.`);
  return newBursts;
}

// Expire old topic moments (called nightly)
async function expireOldTopics() {
  const { rowCount } = await pool.query(
    `DELETE FROM trending_topics WHERE expires_at < NOW()`
  );
  if (rowCount) console.log(`[TopicBursts] Expired ${rowCount} old topic(s).`);
}

module.exports = { detectAndNotify, expireOldTopics };
