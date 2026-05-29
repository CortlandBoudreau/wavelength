import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/auth';
import './Profile.css';

const ALL_CATEGORIES = [
  { value: 'marine_science', label: '🌊 Marine Science' },
  { value: 'diversity_stem', label: '🔬 Diversity in STEM' },
  { value: 'science',        label: '🧪 Science Discoveries' },
  { value: 'cool_facts',     label: '✨ Cool Facts' },
  { value: 'space',          label: '🚀 Space & Astronomy' },
  { value: 'climate',        label: '🌿 Climate & Environment' },
  { value: 'wildlife',       label: '🐾 Wildlife & Animals' },
  { value: 'health_science', label: '🧠 Health Science' },
];

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const isWelcome = searchParams.get('welcome') === '1';

  const [interests, setInterests] = useState(user?.interests || ALL_CATEGORIES.map(c => c.value));
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [includes, setIncludes] = useState(user?.hashtag_includes || []);
  const [excludes, setExcludes] = useState(user?.hashtag_excludes || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleInterest(cat) {
    setInterests((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function normalizeTag(t) {
    const clean = t.trim().replace(/^#*/, '');
    return clean ? `#${clean}` : '';
  }

  function addTag(input, setInput, list, setList) {
    const tag = normalizeTag(input);
    if (tag && !list.includes(tag)) setList([...list, tag]);
    setInput('');
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updates = { interests, hashtag_includes: includes, hashtag_excludes: excludes };
      if (user?.isGuest) {
        // updateUser already calls saveGuestProfile for guests
        updateUser(updates);
      } else {
        const updated = await updateProfile(updates);
        updateUser(updated);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page">
      {isWelcome && (
        <div className="welcome-banner">
          👋 Welcome to WaveLength! Set your interests below so we can personalize your feed.
        </div>
      )}

      <div className="profile-header">
        <h1>Your Profile</h1>
        {user?.isGuest
          ? <p className="profile-subtitle">👀 Guest — preferences saved in this browser · <a href="/register">Create account to keep them</a></p>
          : <p className="profile-subtitle">{user?.email}</p>
        }
      </div>

      <div className="profile-section card">
        <h2>Content Interests</h2>
        <p className="section-hint">Choose which categories appear in your dashboard.</p>
        <div className="interest-grid">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              className={`interest-btn ${interests.includes(cat.value) ? 'active' : ''}`}
              onClick={() => toggleInterest(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="profile-section card">
        <h2>Hashtag Filters</h2>
        <p className="section-hint">
          Control which stories appear based on hashtags. Prioritize topics you love or filter out ones you'd rather skip.
        </p>

        <div className="hashtag-block">
          <h3>✅ Always show stories with these hashtags</h3>
          <p className="section-hint">e.g. #BlackInSTEM, #OceanConservation, #AutismAwareness</p>
          <div className="tag-row">
            <input
              value={includeInput}
              onChange={(e) => setIncludeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag(includeInput, setIncludeInput, includes, setIncludes)}
              placeholder="Type a hashtag, press Enter"
            />
            <button className="btn btn-ghost" onClick={() => addTag(includeInput, setIncludeInput, includes, setIncludes)}>Add</button>
          </div>
          <div className="tags">
            {includes.map((tag) => (
              <span key={tag} className="tag tag-include" onClick={() => setIncludes(includes.filter(t => t !== tag))}>
                {tag} ✕
              </span>
            ))}
            {includes.length === 0 && <span className="tag-empty">None set</span>}
          </div>
        </div>

        <div className="hashtag-block">
          <h3>🚫 Hide stories with these hashtags</h3>
          <p className="section-hint">e.g. #Politics, #Entertainment</p>
          <div className="tag-row">
            <input
              value={excludeInput}
              onChange={(e) => setExcludeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag(excludeInput, setExcludeInput, excludes, setExcludes)}
              placeholder="Type a hashtag, press Enter"
            />
            <button className="btn btn-ghost" onClick={() => addTag(excludeInput, setExcludeInput, excludes, setExcludes)}>Add</button>
          </div>
          <div className="tags">
            {excludes.map((tag) => (
              <span key={tag} className="tag tag-exclude" onClick={() => setExcludes(excludes.filter(t => t !== tag))}>
                {tag} ✕
              </span>
            ))}
            {excludes.length === 0 && <span className="tag-empty">None set</span>}
          </div>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ alignSelf: 'flex-start' }}>
        {saving ? 'Saving...' : saved ? '✅ Saved!' : '💾 Save Preferences'}
      </button>
    </div>
  );
}
