import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchStory, toggleFavorite, toggleUsed, updateNotes } from '../api/stories';
import {
  getGuestInteraction,
  toggleGuestFavorite,
  toggleGuestUsed,
  updateGuestNotes,
} from '../api/guestStorage';
import { useAuth } from '../context/AuthContext';
import './StoryDetail.css';

export default function StoryDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isGuest = user?.isGuest;

  const [story, setStory] = useState(null);
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetchStory(id).then((s) => {
      // For guests, overlay localStorage interactions on top of server data
      if (isGuest) {
        const g = getGuestInteraction(id);
        s = { ...s, favorited: g.favorited, used: g.used, notes: g.notes, tags: g.tags };
      }
      setStory(s);
      setNotes(s.notes || '');
      setTags(typeof s.tags === 'string' ? JSON.parse(s.tags || '[]') : s.tags || []);
    });
  }, [id, isGuest]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function handleFavorite() {
    const result = isGuest ? toggleGuestFavorite(id) : await toggleFavorite(id);
    setStory((s) => ({ ...s, favorited: result.favorited }));
  }

  async function handleUsed() {
    const result = isGuest ? toggleGuestUsed(id) : await toggleUsed(id);
    setStory((s) => ({ ...s, used: result.used }));
  }

  async function handleSaveNotes() {
    setSaving(true);
    try {
      if (isGuest) {
        updateGuestNotes(id, { notes, tags });
      } else {
        await updateNotes(id, { notes, tags });
      }
      showToast('✅ Notes saved!');
    } catch {
      showToast('❌ Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  function addTag(e) {
    if (e.key === 'Enter' && tagInput.trim()) {
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) setTags([...tags, newTag]);
      setTagInput('');
    }
  }

  if (!story) return <div className="loading-state">Loading...</div>;

  const bullets = typeof story.bullets === 'string' ? JSON.parse(story.bullets || '[]') : story.bullets || [];
  const hashtags = typeof story.hashtags === 'string' ? JSON.parse(story.hashtags || '[]') : story.hashtags || [];

  return (
    <div className="story-detail">
      <Link to="/" className="back-link">← Back to Dashboard</Link>

      {isGuest && (
        <div className="guest-notice">
          👀 You're in guest mode — your notes and saves are stored in this browser only.
        </div>
      )}

      <div className="detail-header">
        <div className="detail-badges">
          {story.category && <span className={`badge badge-${story.category}`}>{story.category.replace('_', ' ')}</span>}
          {story.angle && <span className={`badge badge-${story.angle}`}>{story.angle}</span>}
        </div>
        <h1 className="detail-title">{story.title}</h1>
        <p className="detail-meta">
          {story.source} · {story.published_at ? new Date(story.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
          &nbsp;· <a href={story.url} target="_blank" rel="noopener noreferrer">Read original ↗</a>
        </p>
        <div className="detail-actions">
          <button className={`btn ${story.favorited ? 'btn-primary' : 'btn-ghost'}`} onClick={handleFavorite}>
            {story.favorited ? '❤️ Saved' : '🤍 Save'}
          </button>
          <button className={`btn ${story.used ? 'btn-danger' : 'btn-ghost'}`} onClick={handleUsed}>
            {story.used ? '✅ Posted' : '📌 Mark as Posted'}
          </button>
        </div>
      </div>

      {story.summary && (
        <div className="detail-section card">
          <h2>AI Summary</h2>
          <p>{story.summary}</p>
        </div>
      )}

      {bullets.length > 0 && (
        <div className="detail-section card">
          <h2>Why this works on Instagram</h2>
          <ul className="bullets-list">
            {bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {hashtags.length > 0 && (
        <div className="detail-section card">
          <h2>Suggested Hashtags</h2>
          <p className="detail-hashtags">{hashtags.join(' ')}</p>
          <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => {
            navigator.clipboard.writeText(hashtags.join(' '));
            showToast('📋 Copied to clipboard!');
          }}>
            📋 Copy hashtags
          </button>
        </div>
      )}

      <div className="detail-section card">
        <h2>Your Notes</h2>
        <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Caption ideas, angle thoughts, reminders..." />
        <div className="tag-input-row">
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={addTag}
            placeholder="Add tag, press Enter" />
          <div className="tags">
            {tags.map((tag) => (
              <span key={tag} className="tag" onClick={() => setTags(tags.filter(t => t !== tag))}>
                {tag} ✕
              </span>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSaveNotes} disabled={saving} style={{ marginTop: 12 }}>
          {saving ? 'Saving...' : '💾 Save Notes'}
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
