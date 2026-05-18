import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { API } from '../api/config';
import { AUTH_EXPIRED_EVENT } from '../api/client';

const AuthContext = createContext(null);

function parseToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { email: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}

function loadAccounts() {
  try {
    return JSON.parse(localStorage.getItem('ghostie_accounts') || '[]');
  } catch {
    return [];
  }
}

function saveAccounts(accounts) {
  localStorage.setItem('ghostie_accounts', JSON.stringify(accounts));
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ghostie_token'));
  const [user, setUser] = useState(() => {
    const t = localStorage.getItem('ghostie_token');
    return t ? parseToken(t) : null;
  });
  const [accounts, setAccounts] = useState(loadAccounts);
  // Set to true when an API call comes back 401/403 — drives the "Session expired" banner.
  const [sessionExpired, setSessionExpired] = useState(false);
  // Latest token in a ref so the event handler always reads the current value
  // without depending on `token` and re-binding the listener.
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const _pushToExtension = (newToken) => {
    try {
      // eslint-disable-next-line no-undef
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        // eslint-disable-next-line no-undef
        chrome.runtime.sendMessage(
          undefined,
          { type: 'GHOSTIE_SET_TOKEN', token: newToken },
          () => { /* fire-and-forget */ },
        );
      }
    } catch { /* extension not installed */ }
  };

  const _activate = (newToken) => {
    const newUser = parseToken(newToken);
    localStorage.setItem('ghostie_token', newToken);
    setToken(newToken);
    setUser(newUser);
    _pushToExtension(newToken);

    setAccounts((prev) => {
      // Ensure the currently active account is saved before switching
      let base = [...prev];
      if (token && user && !base.find((a) => a.user.email === user.email)) {
        base = [{ token, user }, ...base];
      }
      // Upsert the new account at the front
      const filtered = base.filter((a) => a.user.email !== newUser.email);
      const updated = [{ token: newToken, user: newUser }, ...filtered];
      saveAccounts(updated);
      return updated;
    });
  };

  const login = async (email, password) => {
    const res = await fetch(`${API.middleware}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Login failed');
    }
    const data = await res.json();
    _activate(data.token);
  };

  const signup = async (email, username, password) => {
    const res = await fetch(`${API.middleware}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Signup failed');
    }
    const data = await res.json();
    _activate(data.token);
  };

  const switchAccount = (email) => {
    const account = accounts.find((a) => a.user.email === email);
    if (!account) return;
    localStorage.setItem('ghostie_token', account.token);
    setToken(account.token);
    setUser(account.user);
    // Move switched account to front
    setAccounts((prev) => {
      const updated = [account, ...prev.filter((a) => a.user.email !== email)];
      saveAccounts(updated);
      return updated;
    });
  };

  const removeAccount = (email) => {
    setAccounts((prev) => {
      const updated = prev.filter((a) => a.user.email !== email);
      saveAccounts(updated);
      // If we removed the active account, switch to next or logout
      if (user?.email === email) {
        if (updated.length > 0) {
          localStorage.setItem('ghostie_token', updated[0].token);
          setToken(updated[0].token);
          setUser(updated[0].user);
        } else {
          localStorage.removeItem('ghostie_token');
          setToken(null);
          setUser(null);
        }
      }
      return updated;
    });
  };

  const logout = () => {
    removeAccount(user?.email);
  };

  // Listen for 401/403 events from the API client. Clearing the active token
  // flips ProtectedRoute → /signin, where the `sessionExpired` flag triggers a
  // "session expired, please log in again" banner.
  useEffect(() => {
    const onExpired = () => {
      if (!tokenRef.current) return; // already signed out — ignore stragglers
      setSessionExpired(true);
      // Inline the logout so we don't capture a stale `user` from closure.
      const currentEmail = parseToken(tokenRef.current)?.email;
      setAccounts((prev) => {
        const updated = prev.filter((a) => a.user.email !== currentEmail);
        saveAccounts(updated);
        if (updated.length > 0) {
          // Promote next saved account silently — fail open rather than kicking
          // the user fully when they have multiple sessions.
          localStorage.setItem('ghostie_token', updated[0].token);
          setToken(updated[0].token);
          setUser(updated[0].user);
        } else {
          localStorage.removeItem('ghostie_token');
          setToken(null);
          setUser(null);
        }
        return updated;
      });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  // Clear the banner once any login/signup completes successfully.
  const wrappedLogin = async (...args) => {
    await login(...args);
    setSessionExpired(false);
  };
  const wrappedSignup = async (...args) => {
    await signup(...args);
    setSessionExpired(false);
  };

  return (
    <AuthContext.Provider value={{
      token, user, accounts,
      login: wrappedLogin, signup: wrappedSignup,
      logout, switchAccount, removeAccount,
      isAuthenticated: !!token,
      sessionExpired,
      clearSessionExpired: () => setSessionExpired(false),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
