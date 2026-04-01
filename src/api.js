const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

let _getToken = () => null;
let _onUnauthorized = () => Promise.resolve(null);

export function setAuthHandlers({ getToken, onUnauthorized }) {
  _getToken = getToken;
  _onUnauthorized = onUnauthorized;
}

export async function requestJson(path, options = {}) {
  const token = _getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  let response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    const newToken = await _onUnauthorized();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function requestJsonNoAuth(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}
