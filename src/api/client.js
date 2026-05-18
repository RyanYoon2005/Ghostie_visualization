import { API } from './config';

export const AUTH_EXPIRED_EVENT = 'ghostie:auth-expired';

/**
 * Returns a fetch wrapper that:
 *  - attaches the JWT and routes through the middleware
 *  - on 401/403 responses, dispatches `ghostie:auth-expired` on the window so
 *    AuthContext can clear the active session and bounce the user to /signin
 *
 * Usage:
 *   const api = makeApiClient(token);
 *   const res = await api('/analyse?...');
 */
export function makeApiClient(token) {
  return async (path, options = {}) => {
    const url = `${API.middleware}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401 || res.status === 403) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
      }
    }
    return res;
  };
}
