import { test, expect } from '@playwright/test';
import { API_BASE } from './test-config.js';
import { TEST_ADMIN, authHeaders, loginAsAdmin, createUserViaAPI } from './auth-helper.js';

// ---------------------------------------------------------------------------
// Auth E2E Tests
// ---------------------------------------------------------------------------

test.describe('認證與授權', () => {
  test('bootstrap: 首次使用顯示建立管理員帳號頁面', async ({ page }) => {
    await page.goto('/');

    // Should show bootstrap mode text
    await expect(page.getByText('建立管理員帳號')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '建立帳號並登入' })).toBeVisible();
  });

  test('bootstrap: 建立管理員後自動登入', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /建立帳號並登入|登入/ })).toBeVisible({ timeout: 10_000 });

    await page.locator('input[type="text"]').fill(TEST_ADMIN.username);
    await page.locator('input[type="password"]').fill(TEST_ADMIN.password);

    // Click whatever button is visible (bootstrap or login)
    await page.getByRole('button', { name: /建立帳號並登入|登入/ }).click();

    // Should see the main app
    await expect(page.getByRole('heading', { name: '專案管理 Burnup' })).toBeVisible({ timeout: 10_000 });

    // Should see user menu with admin's name
    await expect(page.getByText(TEST_ADMIN.username)).toBeVisible();
    await expect(page.getByText('管理員')).toBeVisible();
  });

  test('login: 錯誤的密碼顯示錯誤訊息', async ({ page }) => {
    // Ensure admin exists
    await authHeaders();

    await page.goto('/');
    await expect(page.getByRole('button', { name: '登入' })).toBeVisible({ timeout: 10_000 });

    await page.locator('input[type="text"]').fill(TEST_ADMIN.username);
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: '登入' }).click();

    await expect(page.getByText('帳號或密碼錯誤')).toBeVisible();
  });

  test('login: 不存在的帳號顯示錯誤訊息', async ({ page }) => {
    await authHeaders();

    await page.goto('/');
    await expect(page.getByRole('button', { name: '登入' })).toBeVisible({ timeout: 10_000 });

    await page.locator('input[type="text"]').fill('nonexistentuser');
    await page.locator('input[type="password"]').fill('somepassword');
    await page.getByRole('button', { name: '登入' }).click();

    await expect(page.getByText('帳號或密碼錯誤')).toBeVisible();
  });

  test('logout: 登出後回到登入頁', async ({ page }) => {
    await loginAsAdmin(page, expect);

    // Click user menu
    await page.getByText(TEST_ADMIN.username).click();

    // Click logout
    await page.getByText('登出').click();

    // Should be back on login page
    await expect(page.getByRole('button', { name: '登入' })).toBeVisible({ timeout: 10_000 });
  });

  test('session: 頁面重新載入後仍保持登入', async ({ page }) => {
    await loginAsAdmin(page, expect);

    // Reload the page
    await page.reload();

    // Should still be logged in (main app visible, not login page)
    await expect(page.getByRole('heading', { name: '專案管理 Burnup' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(TEST_ADMIN.username)).toBeVisible();
  });

  test('admin: 管理員可以看到使用者管理選單', async ({ page }) => {
    await loginAsAdmin(page, expect);

    // Open user menu
    await page.getByText(TEST_ADMIN.username).click();

    // Should see "使用者管理" option
    await expect(page.getByText('使用者管理')).toBeVisible();
  });

  test('admin: 管理員可以建立新使用者', async ({ page }) => {
    await loginAsAdmin(page, expect);

    // Open user menu → click 使用者管理
    await page.getByText(TEST_ADMIN.username).click();
    await page.getByText('使用者管理').click();

    // Admin panel should open
    await expect(page.getByRole('heading', { name: '使用者管理' })).toBeVisible();

    // Click "新增使用者"
    await page.getByText('新增使用者').click();

    // Fill the create user form (within the admin panel modal)
    const adminPanel = page.locator('.fixed.inset-0').filter({ hasText: '使用者管理' });
    const form = adminPanel.locator('form');
    const textInputs = form.locator('input[type="text"]');
    await textInputs.first().fill('newmember');       // 帳號
    await textInputs.nth(1).fill('New Member');        // 顯示名稱
    await form.locator('input[type="password"]').fill('memberpass123');

    // Submit
    await page.getByRole('button', { name: '建立' }).click();

    // New user should appear in the list
    await expect(page.getByText('New Member')).toBeVisible();
    await expect(page.getByText('@newmember')).toBeVisible();
  });

  test('viewer: 檢視者可以登入並瀏覽', async ({ page }) => {
    // Create a viewer user via API
    await authHeaders();
    await createUserViaAPI({
      username: 'testviewer',
      display_name: 'Test Viewer',
      password: 'viewerpass123',
      role: 'viewer',
    });

    // Login as viewer
    await page.goto('/');
    await expect(page.getByRole('button', { name: '登入' })).toBeVisible({ timeout: 10_000 });
    await page.locator('input[type="text"]').fill('testviewer');
    await page.locator('input[type="password"]').fill('viewerpass123');
    await page.getByRole('button', { name: '登入' }).click();

    await expect(page.getByRole('heading', { name: '專案管理 Burnup' })).toBeVisible({ timeout: 10_000 });

    // Viewer should see their name and role badge
    await expect(page.getByText('Test Viewer')).toBeVisible();
    await expect(page.getByText('檢視者')).toBeVisible();
  });

  test('viewer: 檢視者看不到使用者管理選單', async ({ page }) => {
    // Ensure viewer exists
    await authHeaders();
    try {
      await createUserViaAPI({
        username: 'testviewer2',
        display_name: 'Test Viewer 2',
        password: 'viewerpass123',
        role: 'viewer',
      });
    } catch {
      // user may already exist
    }

    // Login as viewer
    await page.goto('/');
    await expect(page.getByRole('button', { name: '登入' })).toBeVisible({ timeout: 10_000 });
    await page.locator('input[type="text"]').fill('testviewer2');
    await page.locator('input[type="password"]').fill('viewerpass123');
    await page.getByRole('button', { name: '登入' }).click();

    await expect(page.getByRole('heading', { name: '專案管理 Burnup' })).toBeVisible({ timeout: 10_000 });

    // Open user menu
    await page.getByText('Test Viewer 2').click();

    // Should NOT see "使用者管理"
    await expect(page.getByText('使用者管理')).not.toBeVisible();

    // Should see "登出"
    await expect(page.getByText('登出')).toBeVisible();
  });

  test('API: 未認證的請求回傳 401', async () => {
    const res = await fetch(`${API_BASE}/projects`, {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  test('API: viewer 無法透過 API 建立專案', async () => {
    const headers = await authHeaders();

    // Create a viewer
    let viewerToken;
    try {
      await createUserViaAPI({
        username: 'apiviewer',
        display_name: 'API Viewer',
        password: 'viewerpass123',
        role: 'viewer',
      });
    } catch {
      // may exist
    }

    // Login as viewer to get their token
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'apiviewer', password: 'viewerpass123' }),
    });
    const loginData = await loginRes.json();
    viewerToken = loginData.access_token;

    // Try to create a project as viewer
    const createRes = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({ name: 'Should Fail' }),
    });

    expect(createRes.status).toBe(403);
  });
});
