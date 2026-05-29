const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const pool = require('../db/pool');

const CATEGORY_QUERIES = {
  marine_science:   'marine science OR ocean research OR marine biology OR sea discovery',
  coral_reefs:      'coral reef bleaching OR coral reef conservation OR reef ecosystem OR coral restoration',
  deep_sea:         'deep sea discovery OR deep ocean OR hydrothermal vent OR bioluminescence OR abyssal',
  conservation:     'marine conservation OR ocean protection OR endangered sea species OR marine reserve OR ocean sanctuary',
  ecology:          'marine ecology OR ocean ecosystem OR food web OR marine habitat OR trophic',
  coastal_science:  'coastal erosion OR sea level rise OR coastal ecosystem OR mangrove OR estuary',
  climate:          'ocean climate change OR ocean warming OR sea temperature OR ocean acidification effects',
  ocean_chemistry:  'ocean acidification OR ocean chemistry OR carbon dioxide ocean OR pH ocean',
  polar_science:    'arctic ocean OR antarctic science OR polar ice OR sea ice melting OR ice shelf',
  aquaculture:      'aquaculture OR sustainable fishing OR fisheries science OR fish farming OR seafood sustainability',
  plastic_pollution:'ocean plastic OR microplastics OR ocean pollution OR marine debris OR plastic ocean',
  biodiversity:     'marine biodiversity OR ocean species discovery OR new species ocean OR endangered marine',
  wildlife:         'whale OR shark OR dolphin OR sea turtle OR ocean animal behavior OR marine mammal',
  environment:      'ocean environment OR environmental science ocean OR blue carbon OR wetland coastal',
  cool_facts:       'amazing ocean fact OR weird sea creature OR surprising marine biology OR ocean record',
  ocean_tech:       'underwater technology OR ocean exploration robot OR marine robotics OR submersible OR sonar',
};

const RSS_FEEDS = [
  { url: 'https://www.sciencedaily.com/rss/earth_climate/oceanography.xml',                      category: 'marine_science' },
  { url: 'https://www.sciencedaily.com/rss/plants_animals/marine_and_freshwater_biology.xml',    category: 'marine_science' },
  { url: 'https://www.sciencedaily.com/rss/earth_climate/coral_reefs.xml',                       category: 'coral_reefs' },
  { url: 'https://www.sciencedaily.com/rss/plants_animals/wildlife.xml',                         category: 'wildlife' },
  { url: 'https://www.sciencedaily.com/rss/earth_climate.xml',                                   category: 'climate' },
  { url: 'https://feeds.feedburner.com/sciencealert/latest',                                     category: 'cool_facts' },
  { url: 'https://oceanservice.noaa.gov/rss/os.xml',                                             category: 'marine_science' },
];

const REDDIT_SOURCES = [
  { subreddit: 'Oceanography',        category: 'marine_science' },
  { subreddit: 'marinebiology',       category: 'marine_science' },
  { subreddit: 'CoralReefs',          category: 'coral_reefs' },
  { subreddit: 'scuba',               category: 'coral_reefs' },
  { subreddit: 'DeepSeaFish',         category: 'deep_sea' },
  { subreddit: 'deepsea',             category: 'deep_sea' },
  { subreddit: 'conservation',        category: 'conservation' },
  { subreddit: 'ecology',             category: 'ecology' },
  { subreddit: 'environment',         category: 'environment' },
  { subreddit: 'climate',             category: 'climate' },
  { subreddit: 'whales',              category: 'wildlife' },
  { subreddit: 'sharks',              category: 'wildlife' },
  { subreddit: 'marine',              category: 'wildlife' },
  { subreddit: 'ZeroWaste',           category: 'plastic_pollution' },
  { subreddit: 'Fishing',             category: 'aquaculture' },
  { subreddit: 'coolguides',          category: 'cool_facts' },
];

async function fetchFromNewsAPI(category, query) {
  const response = await axios.get('https://newsapi.org/v2/everything', {
    params: {
      q: query,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: 10,
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    headers: { 'X-Api-Key': process.env.NEWS_API_KEY },
  });

  if (response.data.status === 'error') {
    throw new Error(response.data.message || 'NewsAPI error');
  }

  return (response.data.articles || []).map((a) => ({
    title: a.title,
    source: a.source?.name,
    url: a.url,
    published_at: a.publishedAt,
    raw_body: a.description || a.content || '',
    category,
  }));
}

async function fetchFromRSS(feedUrl, category) {
  const response = await axios.get(feedUrl, { timeout: 8000 });
  const parser = new XMLParser();
  const result = parser.parse(response.data);
  const items = result?.rss?.channel?.item || [];
  return (Array.isArray(items) ? items : [items]).slice(0, 5).map((item) => ({
    title: item.title,
    source: result?.rss?.channel?.title || feedUrl,
    url: item.link,
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    raw_body: item.description || '',
    category,
  }));
}

async function fetchFromReddit(subreddit, category) {
  const response = await axios.get(
    `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=8`,
    {
      timeout: 8000,
      headers: { 'User-Agent': 'WaveLength/1.0 (ocean science content aggregator)' },
    }
  );

  const posts = response.data?.data?.children || [];
  return posts
    .map((p) => p.data)
    .filter((p) => !p.is_self && p.url && p.title && p.score > 50)
    .map((p) => ({
      title: p.title,
      source: `Reddit r/${subreddit}`,
      url: p.url.startsWith('/r/') ? `https://reddit.com${p.url}` : p.url,
      published_at: new Date(p.created_utc * 1000).toISOString(),
      raw_body: p.selftext?.slice(0, 500) || '',
      category,
      reddit_score: p.score,
    }));
}

async function saveStories(stories) {
  let saved = 0;
  for (const story of stories) {
    if (!story.title || !story.url) continue;
    try {
      const result = await pool.query(
        `INSERT INTO stories (title, source, url, published_at, category, raw_body)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (url) DO NOTHING
         RETURNING id`,
        [story.title, story.source, story.url, story.published_at, story.category, story.raw_body]
      );
      if (result.rowCount > 0) saved++;
    } catch (err) {
      console.error('Failed to save story:', story.title, err.message);
    }
  }
  return saved;
}

async function runAggregation() {
  console.log('[Aggregator] Starting ocean-focused aggregation...');
  const allStories = [];
  const errors = [];

  // NewsAPI
  for (const [category, query] of Object.entries(CATEGORY_QUERIES)) {
    try {
      const articles = await fetchFromNewsAPI(category, query);
      console.log(`[Aggregator] NewsAPI ${category}: ${articles.length} articles`);
      allStories.push(...articles);
    } catch (err) {
      const msg = `NewsAPI [${category}]: ${err.response?.data?.message || err.message}`;
      console.error('[Aggregator]', msg);
      errors.push(msg);
    }
  }

  // RSS
  for (const feed of RSS_FEEDS) {
    try {
      const articles = await fetchFromRSS(feed.url, feed.category);
      console.log(`[Aggregator] RSS ${feed.url}: ${articles.length} articles`);
      allStories.push(...articles);
    } catch (err) {
      const msg = `RSS [${feed.url}]: ${err.message}`;
      console.error('[Aggregator]', msg);
      errors.push(msg);
    }
  }

  // Reddit
  const redditResults = await Promise.allSettled(
    REDDIT_SOURCES.map(({ subreddit, category }) =>
      fetchFromReddit(subreddit, category).then((articles) => {
        console.log(`[Aggregator] Reddit r/${subreddit}: ${articles.length} posts`);
        return articles;
      })
    )
  );

  for (const result of redditResults) {
    if (result.status === 'fulfilled') {
      allStories.push(...result.value);
    } else {
      const msg = `Reddit: ${result.reason?.message}`;
      console.error('[Aggregator]', msg);
      errors.push(msg);
    }
  }

  const fetched = allStories.length;
  const saved = await saveStories(allStories);
  const skipped = fetched - saved;

  console.log(`[Aggregator] Done. Fetched: ${fetched}, New: ${saved}, Duplicates skipped: ${skipped}`);
  return { saved, fetched, skipped, errors };
}

module.exports = { runAggregation };
