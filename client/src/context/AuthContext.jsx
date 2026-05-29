import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, logout as apiLogout } from '../api/auth';
import { getGuestProfile, saveGuestProfile } from '../api/guestStorage';

const AuthContext = createContext(null);

const GUEST_KEY = 'wl_is_guest';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for guest session first
    if (localStorage.getItem(GUEST_KEY) === '1') {
      const profile = getGuestProfile();
      setUser({ ...profile, name: 'Guest', isGuest: true });
      setLoading(false);
      return;
    }
    // Otherwise try JWT auth
    getMe().then((u) => {
      setUser(u || null);
      setLoading(false);
    });
  }, []);

  function login(userData) {
    localStorage.removeItem(GUEST_KEY);
    setUser(userData);
  }

  function loginAsGuest() {
    localStorage.setItem(GUEST_KEY, '1');
    const profile = getGuestProfile();
    setUser({ ...profile, name: 'Guest', isGuest: true });
  }

  function logout() {
    apiLogout();
    localStorage.removeItem(GUEST_KEY);
    setUser(null);
  }

  function updateUser(updates) {
    setUser((prev) => {
      const merged = { ...prev, ...updates };
      // Persist guest profile changes to localStorage
      if (prev?.isGuest) saveGuestProfile(updates);
      return merged;
    });
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsGuest, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
