import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import StoryDetail from './pages/StoryDetail';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';
import './App.css';

/* Standalone wave icon (used on landing + auth pages) */
export function WaveMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="#1a2a3a"/>
      <path d="M3 18 Q7.5 11.5 12 18 Q16.5 24.5 21 18 Q25.5 11.5 29 18"
            stroke="#4A9EDB" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
      <path d="M3 23 Q7.5 16.5 12 23 Q16.5 29.5 21 23 Q25.5 16.5 29 23"
            stroke="#4A9EDB" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.4"/>
    </svg>
  );
}

/* Full horizontal logo lockup — all SVG so nothing can underline */
function SidebarLogo() {
  return (
    <svg width="168" height="36" viewBox="0 0 168 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Icon tile */}
      <rect width="36" height="36" rx="8" fill="#0f1e2d"/>
      <path d="M4 20 Q9 13 14 20 Q19 27 24 20 Q29 13 32 20"
            stroke="#4A9EDB" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
      <path d="M4 25.5 Q9 18.5 14 25.5 Q19 32.5 24 25.5 Q29 18.5 32 25.5"
            stroke="#4A9EDB" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.38"/>
      {/* Wordmark */}
      <text x="44" y="22"
            fontFamily="'Playfair Display', Georgia, serif"
            fontSize="16" fontWeight="700" fill="#4A9EDB"
            letterSpacing="0.3">
        WaveLength
      </text>
      {/* Tagline */}
      <text x="45" y="32"
            fontFamily="'Inter', system-ui, sans-serif"
            fontSize="8.5" fontWeight="500" fill="#6a9ab8"
            letterSpacing="1.4">
        SCIENCE · CREATOR
      </text>
    </svg>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="app-spinner" />
    </div>
  );
  if (!user) return <Navigate to="/welcome" replace />;
  return children;
}

function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="app-layout">
      {/* ── Bottom nav (mobile only) ── */}
      <nav className="mobile-nav">
        <NavLink to="/" end className="mobile-nav-item">
          <span className="mobile-nav-icon">📰</span>
          <span>Dashboard</span>
        </NavLink>
        {!user?.isGuest && (
          <NavLink to="/analytics" className="mobile-nav-item">
            <span className="mobile-nav-icon">📊</span>
            <span>Analytics</span>
          </NavLink>
        )}
        <NavLink to="/profile" className="mobile-nav-item">
          <span className="mobile-nav-icon">⚙️</span>
          <span>Profile</span>
        </NavLink>
        <button className="mobile-nav-item mobile-nav-btn" onClick={logout}>
          <span className="mobile-nav-icon">🚪</span>
          <span>Sign out</span>
        </button>
      </nav>

      <nav className="sidebar">
        <NavLink to="/" className="sidebar-brand">
          <SidebarLogo />
        </NavLink>

        <ul className="nav-links">
          <li><NavLink to="/" end>📰 Dashboard</NavLink></li>
          {!user?.isGuest && <li><NavLink to="/analytics">📊 Analytics</NavLink></li>}
          <li><NavLink to="/profile">⚙️ Profile</NavLink></li>
        </ul>

        <div className="sidebar-footer">
          <div className="sidebar-user-row">
            <div className="sidebar-avatar">{(user?.name?.[0] || '?').toUpperCase()}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name}</span>
              {user?.isGuest && <span className="sidebar-guest-tag">Guest</span>}
            </div>
          </div>
          <button className="btn btn-ghost sidebar-logout" onClick={logout}>Sign out</button>
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stories/:id" element={<StoryDetail />} />
          <Route path="/analytics" element={user?.isGuest ? <Navigate to="/" replace /> : <Analytics />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
    </div>
  );
}

/* Route guard: redirect already-authed users away from welcome/login/register */
function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/welcome" element={<PublicOnly><Landing /></PublicOnly>} />
        <Route path="/login"   element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  );
}
