import { useState, useEffect } from 'react';
import { fetchAnalytics } from '../api/stories';
import './Analytics.css';

const CATEGORY_LABELS = {
  marine_science: '🌊 Marine Science',
  diversity_stem: '🔬 Diversity in STEM',
  science:        '🧪 Science',
  cool_facts:     '✨ Cool Facts',
  space:          '🚀 Space',
  climate:        '🌿 Climate',
  wildlife:       '🐾 Wildlife',
  health_science: '🧠 Health Science',
};

export default function Analytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAnalytics().then(setData).catch(console.error);
  }, []);

  if (!data) return <div className="loading-state">Loading analytics...</div>;

  const { totals, byCategory, topSources } = data;

  return (
    <div className="analytics">
      <h1>Analytics</h1>
      <p className="analytics-subtitle">Your engagement profile and content insights.</p>

      <div className="stats-row">
        <div className="stat-card card">
          <div className="stat-number">{totals.total_stories}</div>
          <div className="stat-label">Stories Surfaced</div>
        </div>
        <div className="stat-card card">
          <div className="stat-number">{totals.total_favorited}</div>
          <div className="stat-label">Saved</div>
        </div>
        <div className="stat-card card">
          <div className="stat-number">{totals.total_used}</div>
          <div className="stat-label">Posted</div>
        </div>
        <div className="stat-card card">
          <div className="stat-number">
            {totals.total_stories > 0
              ? Math.round((totals.total_used / totals.total_stories) * 100)
              : 0}%
          </div>
          <div className="stat-label">Conversion Rate</div>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="card">
          <h2>By Category</h2>
          <div className="category-bars">
            {byCategory.map((cat) => {
              const pct = cat.total > 0 ? Math.round((cat.favorited / cat.total) * 100) : 0;
              return (
                <div key={cat.category} className="cat-row">
                  <div className="cat-label">{CATEGORY_LABELS[cat.category] || cat.category}</div>
                  <div className="cat-bar-track">
                    <div className="cat-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="cat-stats">{cat.favorited} saved / {cat.total} total</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2>Top Sources</h2>
          <div className="sources-table-wrap"><table className="sources-table">
            <thead>
              <tr><th>Source</th><th>Stories</th><th>Saved</th></tr>
            </thead>
            <tbody>
              {topSources.map((s) => (
                <tr key={s.source}>
                  <td>{s.source || 'Unknown'}</td>
                  <td>{s.count}</td>
                  <td>{s.favorited}</td>
                </tr>
              ))}
              {topSources.length === 0 && (
                <tr><td colSpan={3} style={{ color: 'var(--muted)', textAlign: 'center' }}>No data yet</td></tr>
              )}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
