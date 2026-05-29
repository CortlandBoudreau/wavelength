import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toggleFavorite, toggleUsed, rateSource } from '../api/stories';
import { toggleGuestFavorite, toggleGuestUsed } from '../api/guestStorage';
import { useAuth } from '../context/AuthContext';
import './StoryCard.css';

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

function scoreColor(score) {
  if (score >= 8) return '#22c55e'; // green
  if (score >= 5) return '#f59e0b'; // amber
  return '#6b7280';                 // gray
}

function StarRating({ source, initialRating, disabled }) {
  const [rating, setRating] = useState(initialRating || 0);
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);

  async function handleClick(val) {
    if (disabled || saving) return;
    const next = rating === val ? 0 : val; // clicking same star toggles off
    setSaving(true);
    try {
      if (next === 0) {
        await fetch('/api/sources/rate', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('wl_token')}` },
          body: JSON.stringify({ source }),
        });
      } else {
        await rateSource(source, next);
      }
      setRating(next);
    } catch {
      // silently fail — UI stays as-is
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="source-rating" title={`Rate "${source}"`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className={`star-btn ${(hover || rating) >= n ? 'star-filled' : ''}`}
          onClick={() => handleClick(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          disabled={disabled || saving}
          aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export default function StoryCard({ story, onUpdate, sourceRatings }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleFavorite(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = user?.isGuest
        ? toggleGuestFavorite(story.id)
        : await toggleFavorite(story.id);
      onUpdate?.({ ...story, favorited: result.favorited });
    } finally {
      setLoading(false);
    }
  }

  async function handleUsed(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = user?.isGuest
        ? toggleGuestUsed(story.id)
        : await toggleUsed(story.id);
      onUpdate?.({ ...story, used: result.used });
    } finally {
      setLoading(false);
    }
  }

  const hashtags = typeof story.hashtags === 'string'
    ? JSON.parse(story.hashtags || '[]')
    : story.hashtags || [];

  const score = story.engagement_score;
  const mySourceRating = sourceRatings?.[story.source];

  return (
    <div className={`story-card card ${story.used ? 'story-card--used' : ''}`}>
      <div className="story-card-meta">
        <span className={`badge badge-${story.category}`}>
          {CATEGORY_LABELS[story.category] || story.category}
        </span>
        {story.angle && (
          <span className={`badge badge-${story.angle}`}>{story.angle}</span>
        )}
        {score != null && (
          <span
            className="score-badge"
            style={{ color: scoreColor(score), borderColor: scoreColor(score) }}
            title={`Instagram engagement score: ${score}/10`}
          >
            ⚡ {score}/10
          </span>
        )}
        <span className="story-source">{story.source}</span>
        <span className="story-date">
          {story.published_at ? new Date(story.published_at).toLocaleDateString() : ''}
        </span>
      </div>

      <Link to={`/stories/${story.id}`} className="story-title">
        {story.title}
      </Link>

      {story.summary && (
        <p className="story-summary">{story.summary}</p>
      )}

      {hashtags.length > 0 && (
        <p className="story-hashtags">{hashtags.join(' ')}</p>
      )}

      <div className="story-card-actions">
        <button
          className={`btn ${story.favorited ? 'btn-primary' : 'btn-ghost'}`}
          onClick={handleFavorite}
          disabled={loading}
        >
          {story.favorited ? '❤️ Saved' : '🤍 Save'}
        </button>
        <button
          className={`btn ${story.used ? 'btn-danger' : 'btn-ghost'}`}
          onClick={handleUsed}
          disabled={loading}
        >
          {story.used ? '✅ Posted' : '📌 Mark as Posted'}
        </button>
        <a href={story.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
          🔗 Source
        </a>
        <Link to={`/stories/${story.id}`} className="btn btn-ghost">
          Notes →
        </Link>
      </div>

      {!user?.isGuest && story.source && (
        <div className="story-source-rating">
          <span className="source-rating-label">Rate source:</span>
          <StarRating
            source={story.source}
            initialRating={mySourceRating}
            disabled={false}
          />
        </div>
      )}
    </div>
  );
}
