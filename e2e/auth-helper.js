import { API_BASE } from './test-config.js';

// Test admin credentials — used for bootstrap and login
export const TEST_ADMIN = { username: 'testadmin', password: 'testpass123' };

let _cachedToken = null;

/**
 * Ensure an admin user exists and return an access token.
 * Tries bootstrap first (fresh DB); falls back to login.
 */
export async function getAdminToken() {
  if (_cachedToken) return _cachedToken;

  // Try bootstrap (only works when no users exist)
  const bootstrapRes = await fetch(`${API_BASE}/auth/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN.username, password: TEST_ADMIN.password }),
  });
  if (bootstrapRes.ok) {
    const data = await bootstrapRes.json();
    _cachedToken = data.access_token;
    return _cachedToken;
  }

  // Already initialized — login instead
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_ADMIN.username, password: TEST_ADMIN.password }),
  });
  if (!loginRes.ok) {
    throw new Error(`Admin login failed: ${loginRes.status} ${await loginRes.text()}`);
  }
  const data = await loginRes.json();
  _cachedToken = data.access_token;
  return _cachedToken;
}

/** Return headers object with Authorization + Content-Type for API calls. */
export async function authHeaders() {
  const token = await getAdminToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Log in as the test admin via the UI login form.
 * Call this after page.goto('/') when the login page is shown.
 */
export async function loginAsAdmin(page, expect) {
  await page.goto('/');
  // May see bootstrap form (first run) or login form
  const submitBtn = page.getByRole('button', { name: /登入|建立帳號並登入/ });
  await expect(submitBtn).toBeVisible({ timeout: 10_000 });

  await page.locator('input[type="text"]').fill(TEST_ADMIN.username);
  await page.locator('input[type="password"]').fill(TEST_ADMIN.password);
  await submitBtn.click();

  // Wait for the main app to appear
  await expect(page.getByRole('heading', { name: '專案管理 Burnup' })).toBeVisible({ timeout: 10_000 });
}

/**
 * Create a second user via the admin API. Returns the created user object.
 */
export async function createUserViaAPI(userData) {
  const headers = await authHeaders();
  const body = {
    username: userData.username,
    display_name: userData.display_name || userData.username,
    password: userData.password,
    role: userData.role || 'member',
  };
  const res = await fetch(`${API_BASE}/auth/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`createUser failed: ${res.status} ${await res.text()}`);
  return res.json();
}
