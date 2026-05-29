import { useState, useEffect, useCallback } from 'react';
import StoryCard from '../components/StoryCard';
import { SkeletonGrid } from '../components/StoryCardSkeleton';
import { fetchStories, refreshStories, sendDigest, fetchTrendingHashtags, fetchSources } from '../api/stories';
import { mergeGuestInteractions } from '../api/guestStorage';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const CATEGORIES = [
  { value: '',               label: 'All' },
  { value: 'marine_science', label: '🌊 Marine Science' },
  { value: 'diversity_stem', label: '🔬 Diversity in STEM' },
  { value: 'science',        label: '🧪 Science' },
  { value: 'cool_facts',     label: '✨ Cool Facts' },
  { value: 'space',          label: '🚀 Space' },
  { value: 'climate',        label: '🌿 Climate' },
  { value: 'wildlife',       label: '🐾 Wildlife' },
  { value: 'health_science', label: '🧠 Health Science' },
];

const SORT_OPTIONS = [
  { value: 'date',       label: '📅 Newest' },
  { value: 'score',      label: '⚡ Top Score' },
  { value: 'favorited',  label: '❤️ Saved First' },
];

function applyHashtagFilters(stories, includes, excludes) {
  return stories.filter((story) => {
    const tags = (typeof story.hashtags === 'string'
      ? JSON.parse(story.hashtags || '[]')
      : story.hashtags || []
    ).map((t) => t.toLowerCase());

    if (excludes?.length && tags.some((t) => excludes.map(e => e.toLowerCase()).includes(t)))
      return false;

    if (includes?.length && tags.length > 0)
      return tags.some((t) => includes.map(i => i.toLowerCase()).includes(t));

    return true;
  });
}

function applySort(stories, sortBy) {
  const copy = [...stories];
  if (sortBy === 'score') {
    return copy.sort((a, b) => (b.engagement_score ?? 0) - (a.engagement_score ?? 0));
  }
  if (sortBy === 'favorited') {
    return copy.sort((a, b) => (b.favorited ? 1 : 0) - (a.favorited ? 1 : 0));
  }
  // default: date (already sorted by server)
  return copy;
}

/** Keep only the highest-scored story per cluster; pass through unclustered stories. */
function deduplicateClusters(stories) {
  const clusterBest = new Map(); // cluster_id → story with highest score
  const unclustered = [];

  for (const story of stories) {
    if (!story.cluster_id) {
      unclustered.push(story);
      continue;
    }
    const existing = clusterBest.get(story.cluster_id);
    if (!existing || (story.engagement_score ?? 0) > (existing.engagement_score ?? 0)) {
      clusterBest.set(story.cluster_id, story);
    }
  }

  return [...clusterBest.values(), ...unclustered];
}

function scoreColor(count, max) {
  const pct = max > 0 ? count / max : 0;
  if (pct > 0.6) return '#22c55e';
  if (pct > 0.3) return '#f59e0b';
  return '#6b7280';
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [category, setCategory] = useState('');
  const [favoritedOnly, setFavoritedOnly] = useState(false);
  const [hashtagSearch, setHashtagSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [clusterDedup, setClusterDedup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [toast, setToast] = useState('');

  // Trending hashtags sidebar
  const [trending, setTrending] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  // Source ratings map: { [source]: rating }
  const [sourceRatings, setSourceRatings] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data = await fetchStories({ category, favorited: favoritedOnly });
      if (user?.isGuest) data = mergeGuestInteractions(data);
      setStories(data);
    } catch {
      showToast('Failed to load stories.');
    } finally {
      setLoading(false);
    }
  }, [category, favoritedOnly]);

  useEffect(() => { load(); }, [load]);

  // Load trending hashtags once on mount
  useEffect(() => {
    fetchTrendingHashtags({ days: 7, limit: 15 })
      .then(setTrending)
      .catch(() => {})
      .finally(() => setTrendingLoading(false));
  }, []);

  // Load source ratings for logged-in users
  useEffect(() => {
    if (!user?.isGuest) {
      fetchSources()
        .then((sources) => {
          const map = {};
          for (const s of sources) {
            if (s.my_rating) map[s.source] = s.my_rating;
          }
          setSourceRatings(map);
        })
        .catch(() => {});
    }
  }, [user]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await refreshStories();
      if (result.errors?.length) {
        showToast(`⚠️ ${result.saved} saved — source error: ${result.errors[0]}`);
      } else if (result.saved === 0 && result.fetched === 0) {
        showToast('⚠️ No stories fetched — check NEWS_API_KEY in .env');
      } else if (result.saved === 0) {
        showToast(`ℹ️ ${result.fetched} fetched, all already in database.`);
      } else {
        showToast(`✅ ${result.saved} new stories added, ${result.summarized} summarized, ${result.clusters ?? 0} topic clusters.`);
      }
      await load();
      // Refresh trending after new stories arrive
      fetchTrendingHashtags({ days: 7, limit: 15 }).then(setTrending).catch(() => {});
    } catch (err) {
      showToast(`❌ Refresh failed: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSendDigest() {
    setSendingDigest(true);
    try {
      await sendDigest();
      showToast('✅ Digest sent!');
    } catch {
      showToast('❌ Digest send failed.');
    } finally {
      setSendingDigest(false);
    }
  }

  function handleUpdate(updated) {
    setStories((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
  }

  function handleTrendingClick(tag) {
    setHashtagSearch(tag.replace(/^#/, ''));
  }

  // Apply filters + dedup + sort
  const searchTag = hashtagSearch.trim()
    ? [`#${hashtagSearch.trim().replace(/^#/, '')}`]
    : [];

  let visibleStories = applyHashtagFilters(
    stories,
    searchTag.length ? searchTag : user?.hashtag_includes,
    user?.hashtag_excludes
  );

  if (clusterDedup) visibleStories = deduplicateClusters(visibleStories);
  visibleStories = applySort(visibleStories, sortBy);

  const maxTrend = trending.length ? trending[0].count : 1;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Content Dashboard</h1>
          <p className="dashboard-subtitle">
            Hi {user?.name?.split(' ')[0]} 👋 — your curated science stories.
          </p>
        </div>
        {!user?.isGuest && (
          <div className="dashboard-actions">
            <button className="btn btn-ghost" onClick={handleSendDigest} disabled={sendingDigest}>
              {sendingDigest ? 'Sending...' : '📧 Send Digest'}
            </button>
            <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : '🔄 Refresh Stories'}
            </button>
          </div>
        )}
      </div>

      <div className="dashboard-filters">
        <div className="filter-tabs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              className={`filter-tab ${category === cat.value ? 'active' : ''}`}
              onClick={() => setCategory(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="filter-right">
          <input
            className="hashtag-search"
            value={hashtagSearch}
            onChange={(e) => setHashtagSearch(e.target.value)}
            placeholder="Filter by #hashtag"
          />
          <label className="favorites-toggle">
            <input type="checkbox" checked={favoritedOnly}
              onChange={(e) => setFavoritedOnly(e.target.checked)} />
            ❤️ Saved only
          </label>
        </div>
      </div>

      {/* Second filter row: sort + cluster */}
      <div className="filter-toolbar">
        <div className="sort-group">
          <span className="toolbar-label">Sort:</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`filter-tab ${sortBy === opt.value ? 'active' : ''}`}
              onClick={() => setSortBy(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="cluster-toggle">
          <input
            type="checkbox"
            checked={clusterDedup}
            onChange={(e) => setClusterDedup(e.target.checked)}
          />
          🗂 One per topic
        </label>
      </div>

      {user?.isGuest && (
        <div className="guest-banner">
          👀 Guest mode — saves and notes live in this browser.{' '}
          <a href="/register">Create a free account</a> to keep them.
        </div>
      )}

      {user?.hashtag_excludes?.length > 0 && (
        <p className="filter-note">
          🚫 Hiding stories tagged: {user.hashtag_excludes.join(', ')}
        </p>
      )}

      <div className="dashboard-layout">
        <div className="dashboard-main">
          {loading ? (
            <SkeletonGrid count={6} />
          ) : visibleStories.length === 0 ? (
            <div className="empty-state">
              <p>{stories.length > 0 ? 'No stories match your current filters.' : 'No stories yet.'}</p>
              {stories.length === 0 && (
                <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? 'Fetching...' : '🔄 Fetch Stories Now'}
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="results-count">
                {visibleStories.length} stories
                {clusterDedup && <span className="dedup-note"> · 1 per topic</span>}
              </p>
              <div className="stories-grid">
                {visibleStories.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    onUpdate={handleUpdate}
                    sourceRatings={sourceRatings}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Trending hashtags sidebar */}
        <aside className="dashboard-sidebar">
          <div className="trending-widget card">
            <h3 className="trending-title">🔥 Trending This Week</h3>
            {trendingLoading ? (
              <p className="trending-empty">Loading...</p>
            ) : trending.length === 0 ? (
              <p className="trending-empty">No data yet — refresh to populate.</p>
            ) : (
              <ul className="trending-list">
                {trending.map(({ hashtag, count }) => (
                  <li key={hashtag} className="trending-item">
                    <button
                      className="trending-tag"
                      onClick={() => handleTrendingClick(hashtag)}
                      title={`Filter by ${hashtag}`}
                    >
                      {hashtag}
                    </button>
                    <span
                      className="trending-bar"
                      style={{
                        width: `${Math.max(8, Math.round((count / maxTrend) * 80))}px`,
                        background: scoreColor(count, maxTrend),
                      }}
                    />
                    <span className="trending-count">{count}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="trending-hint">Click a tag to filter stories</p>
          </div>
        </aside>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
