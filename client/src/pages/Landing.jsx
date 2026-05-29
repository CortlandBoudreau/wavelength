import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI-Powered Summaries',
    body: 'Claude reads each article and writes a plain-language summary plus Instagram caption bullets — ready to post.',
  },
  {
    icon: '🌊',
    title: 'Curated for Science Creators',
    body: 'Stories from marine biology, space, climate, diversity in STEM, and more — filtered to match your niche.',
  },
  {
    icon: '⚡',
    title: 'Engagement Score',
    body: 'Every story gets an Instagram potential score so you spend time on content your audience will actually love.',
  },
  {
    icon: '🔥',
    title: 'Trending Hashtags',
    body: 'See which hashtags are gaining traction in science this week so you can reach the right audience at the right moment.',
  },
  {
    icon: '🎯',
    title: 'Personalized Feed',
    body: 'Pin the categories and hashtags you care about. Mute the ones you don\'t. You decide exactly what you see.',
  },
  {
    icon: '📧',
    title: 'Daily Email Digest',
    body: 'Wake up to the top stories in your inbox every morning — with summaries already written.',
  },
];

export default function Landing() {
  const { loginAsGuest } = useAuth();
  const navigate = useNavigate();

  function handleGuest() {
    loginAsGuest();
    navigate('/');
  }

  return (
    <div className="landing">
      {/* ── Nav ── */}
      <header className="landing-nav">
        <div className="landing-logo">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="7" fill="#1a2a3a"/>
            <path d="M3 18 Q7.5 11.5 12 18 Q16.5 24.5 21 18 Q25.5 11.5 29 18"
                  stroke="#4A9EDB" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
            <path d="M3 23 Q7.5 16.5 12 23 Q16.5 29.5 21 23 Q25.5 16.5 29 23"
                  stroke="#4A9EDB" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.4"/>
          </svg>
          <span>WaveLength</span>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="btn btn-ghost">Sign in</Link>
          <Link to="/register" className="btn btn-primary">Get started</Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="hero-waves" aria-hidden="true">
          <svg className="wave wave-1" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0,60 C240,100 480,20 720,60 C960,100 1200,20 1440,60 L1440,120 L0,120 Z" fill="rgba(74,158,219,0.12)"/>
          </svg>
          <svg className="wave wave-2" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0,80 C360,30 720,110 1080,60 C1260,35 1380,80 1440,80 L1440,120 L0,120 Z" fill="rgba(74,158,219,0.07)"/>
          </svg>
        </div>

        <div className="hero-content">
          <div className="hero-badge">✨ Science content, simplified</div>
          <h1 className="hero-title">
            Your daily<br />
            <span className="hero-accent">science content studio</span>
          </h1>
          <p className="hero-sub">
            WaveLength aggregates the latest science stories, writes your Instagram captions with AI, and scores each story's engagement potential — so you can focus on creating, not searching.
          </p>
          <div className="hero-ctas">
            <Link to="/register" className="btn btn-hero-primary">
              🚀 Get started for free
            </Link>
            <button className="btn btn-hero-ghost" onClick={handleGuest}>
              👀 Try as guest
            </button>
          </div>
          <p className="hero-note">No credit card required · Guest mode saves to your browser</p>
        </div>

        {/* Mock story card preview */}
        <div className="hero-preview" aria-hidden="true">
          <div className="preview-card">
            <div className="preview-meta">
              <span className="preview-badge">🌊 Marine Science</span>
              <span className="preview-score">⚡ 9/10</span>
            </div>
            <p className="preview-title">Scientists Discover Deep-Sea Coral Reef the Size of a Mountain off Galápagos</p>
            <p className="preview-summary">A thriving cold-water coral ecosystem stretching over 800 km² was mapped by researchers — one of the largest ever found in the Pacific.</p>
            <div className="preview-tags">#OceanScience #CoralReef #MarineBiology #DeepSea #Conservation</div>
            <div className="preview-actions">
              <span>🤍 Save</span>
              <span>📌 Mark used</span>
              <span>🔗 Source</span>
            </div>
          </div>
          <div className="preview-card preview-card--behind" />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-features">
        <h2 className="section-title">Everything a science creator needs</h2>
        <p className="section-sub">From the latest research headlines to ready-to-post captions in seconds.</p>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="landing-cta">
        <h2>Ready to ride the wave?</h2>
        <p>Join and start surfacing your best science content today.</p>
        <div className="hero-ctas">
          <Link to="/register" className="btn btn-hero-primary">Create your account</Link>
          <Link to="/login" className="btn btn-hero-ghost">Sign in</Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-logo" style={{ opacity: 0.5 }}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="7" fill="#1a2a3a"/>
            <path d="M3 18 Q7.5 11.5 12 18 Q16.5 24.5 21 18 Q25.5 11.5 29 18" stroke="#4A9EDB" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
          </svg>
          <span>WaveLength</span>
        </div>
        <p>Built for science communicators · Powered by Claude AI</p>
      </footer>
    </div>
  );
}
