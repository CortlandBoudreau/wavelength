const sgMail = require('@sendgrid/mail');
const pool = require('../db/pool');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const CATEGORY_LABELS = {
  marine_science: '🌊 Marine Science',
  diversity_stem: '🔬 Diversity in STEM',
  science:        '🧪 Science Discoveries',
  cool_facts:     '✨ Cool Facts',
  space:          '🚀 Space & Astronomy',
  climate:        '🌿 Climate & Environment',
  wildlife:       '🐾 Wildlife & Animals',
  health_science: '🧠 Health Science',
};

// Fallback for categories without an explicit label (e.g. ecology, conservation,
// deep_sea): replace underscores with spaces and Title Case each word.
function formatCategory(cat) {
  if (CATEGORY_LABELS[cat]) return CATEGORY_LABELS[cat];
  return String(cat || '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Escape all user/external-sourced content before inserting into HTML
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Only allow https:// URLs in href attributes to block javascript: URIs
function safeHref(url) {
  if (typeof url !== 'string') return '#';
  const trimmed = url.trim();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://') ? esc(trimmed) : '#';
}

function buildHtml(stories) {
  const byCategory = {};
  for (const story of stories) {
    if (!byCategory[story.category]) byCategory[story.category] = [];
    byCategory[story.category].push(story);
  }

  const sections = Object.entries(byCategory).map(([cat, catStories]) => {
    const items = catStories.map((s) => {
      const bulletsArr = Array.isArray(s.bullets)
        ? s.bullets
        : JSON.parse(s.bullets || '[]');
      const hashtagsArr = Array.isArray(s.hashtags)
        ? s.hashtags
        : JSON.parse(s.hashtags || '[]');

      const bullets = bulletsArr.map((b) => `<li>${esc(b)}</li>`).join('');
      const hashtags = hashtagsArr.map(esc).join(' ');

      return `
        <div style="margin-bottom:24px;border-left:3px solid #4A9EDB;padding-left:16px;">
          <h3 style="margin:0 0 6px;font-size:16px;">
            <a href="${safeHref(s.url)}" style="color:#1a1a1a;text-decoration:none;">${esc(s.title)}</a>
          </h3>
          <p style="margin:0 0 8px;color:#444;font-size:14px;">${esc(s.source)} · ${esc(new Date(s.published_at).toLocaleDateString())}</p>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">${esc(s.summary)}</p>
          <ul style="margin:0 0 8px;padding-left:20px;font-size:13px;color:#555;">${bullets}</ul>
          <p style="margin:0;font-size:12px;color:#888;">
            <strong>Angle:</strong> ${esc(s.angle)} &nbsp;|&nbsp; ${hashtags}
          </p>
        </div>`;
    }).join('');

    return `
      <h2 style="color:#4A9EDB;border-bottom:1px solid #eee;padding-bottom:8px;">${esc(formatCategory(cat))}</h2>
      ${items}`;
  }).join('');

  const dashboardUrl = safeHref(process.env.CLIENT_URL || 'http://localhost:5173');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body style="font-family:Georgia,serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a;background:#fafafa;">
      <header style="text-align:center;margin-bottom:32px;">
        <h1 style="color:#4A9EDB;font-size:28px;margin:0;">🌊 WaveLength</h1>
        <p style="color:#888;font-size:13px;margin:4px 0 0;">Your daily science content digest · ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </header>
      ${sections}
      <footer style="margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#aaa;text-align:center;">
        Powered by WaveLength · <a href="${dashboardUrl}" style="color:#4A9EDB;">Open Dashboard</a>
      </footer>
    </body>
    </html>`;
}

async function getDigestStories(limit = 12) {
  const { rows } = await pool.query(`
    SELECT s.*, sum.summary, sum.bullets, sum.angle, sum.hashtags
    FROM stories s
    JOIN summaries sum ON sum.story_id = s.id
    LEFT JOIN interactions i ON i.story_id = s.id
    WHERE (i.used IS NULL OR i.used = FALSE)
      AND s.published_at > NOW() - INTERVAL '48 hours'
    ORDER BY s.published_at DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

// toEmail: recipient address. Defaults to EMAIL_TO (admin) for the scheduled
// daily run; the user-facing /api/digest/send route passes the user's own email.
async function sendDigest(toEmail = process.env.EMAIL_TO) {
  const stories = await getDigestStories();
  if (!stories.length) {
    console.log('[Digest] No stories to send.');
    return;
  }

  const html = buildHtml(stories);
  const storyIds = stories.map((s) => s.id);

  const msg = {
    to: toEmail,
    from: process.env.EMAIL_FROM,
    subject: `WaveLength Digest — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    html,
  };

  try {
    await sgMail.send(msg);
    await pool.query(
      `INSERT INTO digests (sent_at, story_ids, status) VALUES (NOW(), $1, 'sent')`,
      [JSON.stringify(storyIds)]
    );
    console.log(`[Digest] Sent digest with ${stories.length} stories to ${toEmail}`);
  } catch (err) {
    await pool.query(
      `INSERT INTO digests (sent_at, story_ids, status) VALUES (NOW(), $1, 'failed')`,
      [JSON.stringify(storyIds)]
    );
    throw err;
  }
}

async function previewDigest() {
  const stories = await getDigestStories();
  return { stories, html: buildHtml(stories) };
}

module.exports = { sendDigest, previewDigest };
