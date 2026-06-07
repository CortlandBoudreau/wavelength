const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const pool = require('../db/pool');

const CATEGORY_QUERIES = {
  marine_science:   '"marine science" OR "ocean research" OR "marine biology" OR "ocean discovery"',
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
  // ScienceDaily
  { url: 'https://www.sciencedaily.com/rss/earth_climate/oceanography.xml',                      category: 'marine_science' },
  { url: 'https://www.sciencedaily.com/rss/plants_animals/marine_and_freshwater_biology.xml',    category: 'marine_science' },
  { url: 'https://www.sciencedaily.com/rss/earth_climate/coral_reefs.xml',                       category: 'coral_reefs' },
  { url: 'https://www.sciencedaily.com/rss/plants_animals/wildlife.xml',                         category: 'wildlife' },
  { url: 'https://www.sciencedaily.com/rss/earth_climate.xml',                                   category: 'climate' },
  { url: 'https://www.sciencedaily.com/rss/space_time/astronomy.xml',                            category: 'space' },
  { url: 'https://www.sciencedaily.com/rss/health_medicine/brain_tumor.xml',                     category: 'health_science' },
  { url: 'https://www.sciencedaily.com/rss/plants_animals/extinction.xml',                       category: 'biodiversity' },
  // Phys.org — excellent research coverage
  { url: 'https://phys.org/rss-feed/biology-news/',                                              category: 'biodiversity' },
  { url: 'https://phys.org/rss-feed/space-news/',                                                category: 'space' },
  { url: 'https://phys.org/rss-feed/earth-news/',                                                category: 'climate' },
  // EurekAlert — press releases direct from research institutions
  { url: 'https://www.eurekalert.org/rss.xml',                                                   category: 'cool_facts' },
  // The Guardian Science
  { url: 'https://www.theguardian.com/science/rss',                                              category: 'cool_facts' },
  { url: 'https://www.theguardian.com/environment/rss',                                          category: 'environment' },
  // BBC Science & Environment
  { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',                        category: 'cool_facts' },
  // NASA Breaking News
  { url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',                                       category: 'space' },
  // NOAA
  { url: 'https://oceanservice.noaa.gov/rss/os.xml',                                             category: 'marine_science' },
  // ScienceAlert
  { url: 'https://feeds.feedburner.com/sciencealert/latest',                                     category: 'cool_facts' },
  // Woods Hole Oceanographic Institution
  { url: 'https://www.whoi.edu/press-room/news-releases/rss/',                                   category: 'marine_science' },
  // New Scientist
  { url: 'https://www.newscientist.com/feed/home/',                                              category: 'cool_facts' },
  // The Conversation — academics writing for general audiences, high quality
  { url: 'https://theconversation.com/articles.atom?language=en',                                category: 'cool_facts' },
  // Science Magazine (AAAS) — prestige general science
  { url: 'https://www.science.org/rss/news_current.xml',                                         category: 'cool_facts' },
  // Live Science — accessible science, strong surprising-facts angle
  { url: 'https://www.livescience.com/feeds/all',                                                category: 'cool_facts' },
  // NSF — press releases direct from the National Science Foundation
  { url: 'https://www.nsf.gov/rss/rss_www_news.xml',                                            category: 'cool_facts' },
  // ESA — European Space Agency
  { url: 'https://www.esa.int/rssfeed/Our_Activities/Space_Science',                             category: 'space' },
  // Smithsonian Magazine — science & nature
  { url: 'https://www.smithsonianmag.com/rss/science-nature/',                                   category: 'cool_facts' },
  // Popular Science
  { url: 'https://www.popsci.com/feed/',                                                         category: 'cool_facts' },
  // Hakai Magazine — coastal & ocean science journalism
  { url: 'https://hakaimagazine.com/feed/',                                                      category: 'marine_science' },
  // Undark — science journalism & ethics of science
  { url: 'https://undark.org/feed/',                                                             category: 'cool_facts' },
];

// Mastodon hashtag timelines — public, no auth, science community on fosstodon.org
const MASTODON_HASHTAGS = [
  { tag: 'marinebiology',  instance: 'fosstodon.org', category: 'marine_science' },
  { tag: 'oceanscience',   instance: 'fosstodon.org', category: 'marine_science' },
  { tag: 'scicomm',        instance: 'fosstodon.org', category: 'cool_facts' },
  { tag: 'ecology',        instance: 'fosstodon.org', category: 'ecology' },
  { tag: 'astronomy',      instance: 'fosstodon.org', category: 'space' },
  { tag: 'conservation',   instance: 'fosstodon.org', category: 'conservation' },
  { tag: 'wildlife',       instance: 'fosstodon.org', category: 'wildlife' },
  { tag: 'climate',        instance: 'fosstodon.org', category: 'climate' },
];

// arXiv preprint RSS — cutting-edge research before it hits mainstream news
const ARXIV_FEEDS = [
  { url: 'https://rss.arxiv.org/rss/q-bio.PE',  category: 'ecology' },          // Populations & Evolution
  { url: 'https://rss.arxiv.org/rss/q-bio.OT',  category: 'marine_science' },   // Other Quantitative Biology
  { url: 'https://rss.arxiv.org/rss/astro-ph',   category: 'space' },            // Astrophysics
  { url: 'https://rss.arxiv.org/rss/physics.ao-ph', category: 'climate' },       // Atmospheric & Oceanic Physics
];

// YouTube channel RSS feeds — no API key needed
// Format: youtube.com/feeds/videos.xml?channel_id=ID
const YOUTUBE_FEEDS = [
  // Verified working ✅
  { channelId: 'UCsXVk37bltHxD1rDPwtNM8Q', name: 'Kurzgesagt',            category: 'cool_facts' },
  { channelId: 'UCZYTClx2T1of7BRZ86-8fow', name: 'SciShow',               category: 'cool_facts' },
  { channelId: 'UCVoL__2BJ7nHSzyMSXTeXoQ', name: 'MinuteEarth',           category: 'environment' },
  { channelId: 'UC7DdEm33SyaTDtWYGO2CwdA', name: 'PBS Space Time',        category: 'space' },
  { channelId: 'UCHnyfMqiRRG1u-2MsSQLbXA', name: 'Veritasium',            category: 'cool_facts' },
  { channelId: 'UCUHW94eEFW7hkUMVaZz4eDg', name: 'PBS Eons',              category: 'biodiversity' },
  { channelId: 'UCpVm7bg6pXKo1Pr6k5kxG9A', name: 'National Geographic',   category: 'wildlife' },
  { channelId: 'UC6107grRI4m0o2-emgoDnAA', name: 'Smarter Every Day',     category: 'cool_facts' },
  { channelId: 'UCH4BNI0-FOK2dMXoFtViWHw', name: 'It\'s Okay To Be Smart', category: 'cool_facts' },
  { channelId: 'UCR1IuLEqb6UEA_zQ81kwXfg', name: 'Real Engineering',      category: 'cool_facts' },
  { channelId: 'UCFXww6CrLAHhyZQCDnJ2g2A', name: 'MBARI',                 category: 'deep_sea' },
  { channelId: 'UCrMePiHCWG4Vwqv3t7W9EFg', name: 'SciShow Space',         category: 'space' },
  { channelId: 'UC-3SbfTPJsL8fJAPKiVqBLg', name: 'Deep Look (KQED)',      category: 'wildlife' },
  { channelId: 'UCsooa4yRKGN_zEE8iknghZA', name: 'TED-Ed',               category: 'cool_facts' },
  { channelId: 'UCsZzBJJxffH6q1kWKyR1cZQ', name: 'Ocean Conservancy',   category: 'conservation' },
  { channelId: 'UCUdettijNYvLAm4AixZv4RA', name: 'SciShow Psych',        category: 'health_science' },
  { channelId: 'UCw6_AmGqKxQ8lPhXYzAhpcg', name: 'Scripps Oceanography', category: 'marine_science' },
  { channelId: 'UC1KOOWHthbQVXH2kZue3_xA', name: 'Ocean Exploration Trust (Nautilus)', category: 'deep_sea' },
  { channelId: 'UC1m5LdKP0m64n8nY3NhK6Zg', name: 'Schmidt Ocean Institute',          category: 'deep_sea' },
  { channelId: 'UCnM5iMGiKsZg-iOlIO2ZkdQ', name: 'Monterey Bay Aquarium',             category: 'marine_science' },
  { channelId: 'UCe9IxQeBttZIYl5c43ycf9g', name: 'NOAA',                              category: 'marine_science' },
  { channelId: 'UCfxsF5U3pXBZFuXc9vY9nPw', name: 'WHOI',                              category: 'marine_science' },
  { channelId: 'UCvgnBYJWaAm-wzZAlLJEsXQ', name: 'Coral Restoration Foundation',      category: 'coral_reefs' },
  { channelId: 'UCFR6sgrwIQDk8goDS3opuew', name: 'Australian Marine Science',         category: 'marine_science' },
  { channelId: 'UCpLQ0d6pzbGVuzlMo7Li40A', name: 'Scuba Diving Magazine',             category: 'marine_science' },
  { channelId: 'UCLim2vDyZBKJ3dHE5WendoA', name: 'Underwater360',                    category: 'marine_science' },
  { channelId: 'UCx4W5dZNjtvJaylHqqDdeXg', name: 'DIVEIN',                           category: 'marine_science' },
];

// Bluesky search queries mapped to categories
// Uses the public AT Protocol API — no auth required
const BLUESKY_QUERIES = [
  { q: 'marine biology OR ocean science OR marine research',  category: 'marine_science' },
  { q: 'coral reef OR coral bleaching OR reef conservation',  category: 'coral_reefs' },
  { q: 'deep sea OR deep ocean OR bioluminescence',           category: 'deep_sea' },
  { q: 'ocean conservation OR marine protected area',         category: 'conservation' },
  { q: 'ocean climate OR sea level rise OR ocean warming',    category: 'climate' },
  { q: 'microplastics OR ocean plastic OR marine debris',     category: 'plastic_pollution' },
  { q: 'new species discovery OR biodiversity science',       category: 'biodiversity' },
  { q: 'whale OR shark OR dolphin research OR sea turtle',    category: 'wildlife' },
  { q: 'space science OR astronomy discovery OR NASA',        category: 'space' },
  { q: 'neuroscience discovery OR brain research',            category: 'health_science' },
  { q: 'climate science OR environmental research',           category: 'environment' },
];

const REDDIT_SOURCES = [
  // Marine & ocean
  { subreddit: 'Oceanography',        category: 'marine_science' },
  { subreddit: 'marinebiology',       category: 'marine_science' },
  { subreddit: 'CoralReefs',          category: 'coral_reefs' },
  { subreddit: 'scuba',               category: 'coral_reefs' },
  { subreddit: 'DeepSeaFish',         category: 'deep_sea' },
  { subreddit: 'deepsea',             category: 'deep_sea' },
  { subreddit: 'whales',              category: 'wildlife' },
  { subreddit: 'sharks',              category: 'wildlife' },
  { subreddit: 'marine',              category: 'wildlife' },
  { subreddit: 'ZeroWaste',           category: 'plastic_pollution' },
  { subreddit: 'Fishing',             category: 'aquaculture' },
  // Broad science
  { subreddit: 'science',             category: 'cool_facts' },
  { subreddit: 'biology',             category: 'biodiversity' },
  { subreddit: 'evolution',           category: 'biodiversity' },
  { subreddit: 'Paleontology',        category: 'biodiversity' },
  { subreddit: 'neuroscience',        category: 'health_science' },
  { subreddit: 'geology',             category: 'environment' },
  { subreddit: 'AskScience',          category: 'cool_facts' },
  { subreddit: 'Astronomy',           category: 'space' },
  { subreddit: 'space',               category: 'space' },
  // Environment & climate
  { subreddit: 'conservation',        category: 'conservation' },
  { subreddit: 'ecology',             category: 'ecology' },
  { subreddit: 'environment',         category: 'environment' },
  { subreddit: 'climate',             category: 'climate' },
  { subreddit: 'ClimateScience',      category: 'climate' },
  { subreddit: 'RenewableEnergy',     category: 'environment' },
  // Viral science / high engagement
  { subreddit: 'todayilearned',       category: 'cool_facts' },
  { subreddit: 'NatureIsFuckingLit',  category: 'wildlife' },
  { subreddit: 'natureismetal',       category: 'wildlife' },
  { subreddit: 'Damnthatsinteresting',category: 'cool_facts' },
  { subreddit: 'awwducational',       category: 'cool_facts' },
  { subreddit: 'coolguides',          category: 'cool_facts' },
  // Marine/ocean additions
  { subreddit: 'ReefTank',            category: 'coral_reefs' },
  { subreddit: 'saltwater',           category: 'marine_science' },
  { subreddit: 'UnderwaterPhotography', category: 'marine_science' },
  { subreddit: 'diving',               category: 'marine_science' },
  { subreddit: 'freediving',           category: 'marine_science' },
  // Specific science topics
  { subreddit: 'mycology',            category: 'biodiversity' },
  { subreddit: 'Dinosaurs',           category: 'biodiversity' },
  { subreddit: 'primatology',         category: 'wildlife' },
  { subreddit: 'genetics',            category: 'health_science' },
  { subreddit: 'Anthropology',        category: 'cool_facts' },
  { subreddit: 'botany',              category: 'biodiversity' },
  { subreddit: 'Entomology',          category: 'biodiversity' },
  // Health & mind
  { subreddit: 'cogsci',              category: 'health_science' },
  { subreddit: 'Microbiome',          category: 'health_science' },
  // Future & tech
  { subreddit: 'Futurology',          category: 'cool_facts' },
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

async function fetchFromBluesky(query, category) {
  const response = await axios.get(
    'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts',
    {
      params: { q: query, limit: 25, sort: 'top' },
      timeout: 10000,
      headers: { 'Accept': 'application/json', 'User-Agent': 'WaveLength/1.0 (science content aggregator)' },
    }
  );

  const posts = response.data?.posts || [];
  return posts
    .filter((p) => {
      // Must have meaningful text and some engagement
      const engagement = (p.likeCount ?? 0) + (p.repostCount ?? 0);
      const text = p.record?.text ?? '';
      return engagement >= 5 && text.length >= 60;
    })
    .map((p) => {
      const handle = p.author?.handle ?? 'bsky.social';
      const rkey   = p.uri?.split('/').pop() ?? '';
      return {
        title:        (p.record?.text ?? '').slice(0, 200).replace(/\n+/g, ' '),
        source:       `Bluesky @${handle}`,
        url:          `https://bsky.app/profile/${handle}/post/${rkey}`,
        published_at: p.record?.createdAt ?? p.indexedAt ?? new Date().toISOString(),
        raw_body:     p.record?.text ?? '',
        category,
      };
    });
}

async function fetchFromMastodon(tag, instance, category) {
  const response = await axios.get(
    `https://${instance}/api/v1/timelines/tag/${encodeURIComponent(tag)}`,
    {
      params: { limit: 20 },
      timeout: 10000,
      headers: { 'Accept': 'application/json', 'User-Agent': 'WaveLength/1.0 (science content aggregator)' },
    }
  );

  const statuses = response.data || [];
  return statuses
    .filter((s) => {
      const engagement = (s.reblogs_count ?? 0) + (s.favourites_count ?? 0);
      // Strip HTML tags to measure real text length
      const text = (s.content ?? '').replace(/<[^>]+>/g, '');
      return engagement >= 3 && text.length >= 80 && !s.reblog; // skip reblogs (reposts)
    })
    .map((s) => {
      const text = (s.content ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      return {
        title:        text.slice(0, 200),
        source:       `Mastodon @${s.account?.acct ?? instance}`,
        url:          s.url ?? s.uri,
        published_at: s.created_at ?? new Date().toISOString(),
        raw_body:     text,
        category,
      };
    });
}

async function fetchFromArxiv(feedUrl, category) {
  const response = await axios.get(feedUrl, { timeout: 10000 });
  const parser = new XMLParser({ ignoreAttributes: false });
  const result = parser.parse(response.data);
  // arXiv uses Atom format: feed.entry[]
  const entries = result?.feed?.entry || [];
  return (Array.isArray(entries) ? entries : [entries]).slice(0, 8).map((e) => ({
    title:        (typeof e.title === 'string' ? e.title : e.title?.['#text'] ?? '').replace(/\s+/g, ' ').trim(),
    source:       'arXiv',
    url:          typeof e.id === 'string' ? e.id.replace('abs', 'pdf') : e.id,
    published_at: e.published ? new Date(e.published).toISOString() : new Date().toISOString(),
    raw_body:     typeof e.summary === 'string' ? e.summary.slice(0, 1000) : '',
    category,
  })).filter((s) => s.title && s.url);
}

async function fetchFromYouTube(channelId, channelName, category) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const response = await axios.get(url, { timeout: 10000 });
  const parser = new XMLParser({ ignoreAttributes: false });
  const result = parser.parse(response.data);
  const entries = result?.feed?.entry || [];
  return (Array.isArray(entries) ? entries : [entries]).slice(0, 5).map((e) => {
    const videoId = e['yt:videoId'] ?? '';
    return {
      title:        typeof e.title === 'string' ? e.title : '',
      source:       `YouTube: ${channelName}`,
      url:          `https://www.youtube.com/watch?v=${videoId}`,
      published_at: e.published ? new Date(e.published).toISOString() : new Date().toISOString(),
      raw_body:     e['media:group']?.['media:description']?.slice(0, 500) ?? '',
      category,
    };
  }).filter((s) => s.title && s.url);
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

  // Mastodon
  const mastodonResults = await Promise.allSettled(
    MASTODON_HASHTAGS.map(({ tag, instance, category }) =>
      fetchFromMastodon(tag, instance, category).then((posts) => {
        console.log(`[Aggregator] Mastodon #${tag}: ${posts.length} posts`);
        return posts;
      })
    )
  );
  for (const r of mastodonResults) {
    if (r.status === 'fulfilled') allStories.push(...r.value);
    else { const msg = `Mastodon: ${r.reason?.message}`; console.error('[Aggregator]', msg); errors.push(msg); }
  }

  // arXiv
  const arxivResults = await Promise.allSettled(
    ARXIV_FEEDS.map(({ url, category }) =>
      fetchFromArxiv(url, category).then((articles) => {
        console.log(`[Aggregator] arXiv ${url.split('/').pop()}: ${articles.length} papers`);
        return articles;
      })
    )
  );
  for (const r of arxivResults) {
    if (r.status === 'fulfilled') allStories.push(...r.value);
    else { const msg = `arXiv: ${r.reason?.message}`; console.error('[Aggregator]', msg); errors.push(msg); }
  }

  // YouTube
  const ytResults = await Promise.allSettled(
    YOUTUBE_FEEDS.map(({ channelId, name, category }) =>
      fetchFromYouTube(channelId, name, category).then((videos) => {
        console.log(`[Aggregator] YouTube ${name}: ${videos.length} videos`);
        return videos;
      })
    )
  );
  for (const r of ytResults) {
    if (r.status === 'fulfilled') allStories.push(...r.value);
    else { const msg = `YouTube: ${r.reason?.message}`; console.error('[Aggregator]', msg); errors.push(msg); }
  }

  // Bluesky
  const bskyResults = await Promise.allSettled(
    BLUESKY_QUERIES.map(({ q, category }) =>
      fetchFromBluesky(q, category).then((posts) => {
        console.log(`[Aggregator] Bluesky "${q.slice(0, 40)}…": ${posts.length} posts`);
        return posts;
      })
    )
  );
  for (const result of bskyResults) {
    if (result.status === 'fulfilled') allStories.push(...result.value);
    else { const msg = `Bluesky: ${result.reason?.message}`; console.error('[Aggregator]', msg); errors.push(msg); }
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
