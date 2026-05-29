import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { WaveMark } from '../App';
import './Auth.css';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: setUser, loginAsGuest } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(form);
      setUser(data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleGuest() {
    loginAsGuest();
    navigate('/');
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <Link to="/welcome" className="auth-brand">
          <WaveMark size={32} />
          <h1>WaveLength</h1>
        </Link>
        <h2>Sign in</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            Password
            <input type="password" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={handleGuest}>
          👀 Continue as Guest
        </button>

        <p className="auth-switch">
          No account? <Link to="/register">Create one free</Link>
        </p>
        <p className="guest-note">
          Guest mode saves your preferences in this browser only.
        </p>
      </div>
    </div>
  );
}
