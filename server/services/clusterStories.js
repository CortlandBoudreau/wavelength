const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

const STOP_WORDS = new Set([
  'the','a','an','in','on','at','to','for','of','and','or','is','are','was','were',
  'has','have','had','that','this','with','from','by','about','as','it','its','be',
  'been','will','can','could','may','might','new','study','shows','found','say','says',
  'scientists','researchers','research','report','reports','first','more','than','into',
  'how','why','what','who','when','where','after','before','over','just','but','not',
]);

function tokenize(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

function jaccardSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

// Cluster stories published within the last 72 hours that share a similar title
async function clusterRecentStories() {
  const { rows: stories } = await pool.query(`
    SELECT id, title, cluster_id
    FROM stories
    WHERE published_at > NOW() - INTERVAL '72 hours'
    ORDER BY published_at DESC
  `);

  if (stories.length === 0) return 0;

  // Build clusters in memory
  const clusters = []; // each entry: { cluster_id, tokens }
  const updates = [];  // { id, cluster_id }

  for (const story of stories) {
    const tokens = tokenize(story.title);
    let matched = null;

    for (const cluster of clusters) {
      if (jaccardSimilarity(tokens, cluster.tokens) >= 0.3) {
        matched = cluster;
        break;
      }
    }

    if (matched) {
      updates.push({ id: story.id, cluster_id: matched.cluster_id });
      // Merge tokens so cluster representation grows
      matched.tokens = [...new Set([...matched.tokens, ...tokens])];
    } else {
      const cluster_id = story.cluster_id || uuidv4();
      clusters.push({ cluster_id, tokens });
      updates.push({ id: story.id, cluster_id });
    }
  }

  // Only write rows that changed
  let changed = 0;
  for (const { id, cluster_id } of updates) {
    const original = stories.find((s) => s.id === id);
    if (original?.cluster_id !== cluster_id) {
      await pool.query('UPDATE stories SET cluster_id = $1 WHERE id = $2', [cluster_id, id]);
      changed++;
    }
  }

  console.log(`[Cluster] ${changed} stories re-clustered across ${clusters.length} clusters.`);
  return clusters.length;
}

module.exports = { clusterRecentStories };
