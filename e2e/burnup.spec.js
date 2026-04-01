import { test, expect } from '@playwright/test';
import { API_BASE } from './test-config.js';
import { authHeaders, loginAsAdmin } from './auth-helper.js';

let _headers;

/** Get cached auth headers (initialized in beforeAll). */
function headers() {
  if (!_headers) throw new Error('Auth headers not initialized — did beforeAll run?');
  return _headers;
}

/** Create a project via API and return its id. */
async function createProjectViaAPI(name) {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Seed project failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

/** Create a task under a project via API and return its id. */
async function createTaskViaAPI(projectId, task) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error(`Seed task failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

/** Delete all projects via API to reset DB state. */
async function deleteAllProjects() {
  const res = await fetch(`${API_BASE}/projects`, { headers: headers() });
  if (!res.ok) return;
  const projects = await res.json();
  const results = await Promise.all(
    projects.map((p) => fetch(`${API_BASE}/projects/${p.id}`, { method: 'DELETE', headers: headers() })),
  );
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    throw new Error(`Failed to delete ${failed.length} project(s) during cleanup`);
  }
}

/** Enter merged view via UI: click tab → select projects → confirm. */
async function enterMergedViewViaUI(page) {
  await page.getByText('合併檢視').click();
  await expect(page.getByText('選擇要合併的專案')).toBeVisible();
  // Check all project checkboxes
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).check();
  }
  await page.getByRole('button', { name: '確認並檢視' }).click();
  await expect(page.getByText('合併範圍：')).toBeVisible();
}

// Initialize auth before all tests
test.beforeAll(async () => {
  _headers = await authHeaders();
});

// Clean DB before each test so tests are fully isolated
test.beforeEach(async () => {
  await deleteAllProjects();
});

test.describe('Burnup Chart App 完整流程測試', () => {
  const getTaskRowByName = (page, taskName) =>
    page.locator(`tr[data-task-name="${taskName}"]`);

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, expect);
  });

  test('Scenario: 建立新專案並驗證工作日推算邏輯', async ({ page }) => {
    await page.getByRole('button', { name: '新增專案' }).click();
    const projectNameInput = page.getByPlaceholder('專案名稱');
    await projectNameInput.fill('Playwright Demo');
    await projectNameInput.press('Enter');

    await expect(
      page.getByRole('heading', { name: 'Playwright Demo - 進度趨勢' })
    ).toBeVisible();

    // showAddTask defaults to true, so the add panel is already open
    await page.getByPlaceholder('例如：實作 API').fill('基底任務');
    await page.locator('input[type="number"]').first().fill('3');
    await page.getByPlaceholder('Name').fill('Alice');
    await page.locator('input[title="預期開始"]').fill('2024-01-05');
    await page.locator('input[title="預期開始"]').blur();

    await page.getByRole('button', { name: '加入任務' }).click();

    const row = getTaskRowByName(page, '基底任務');
    await expect(row).toBeVisible();

    const expectedEndInput = row
      .locator('td.bg-blue-50\\/10')
      .locator('input[type="date"]')
      .nth(1);
    await expect(expectedEndInput).not.toHaveValue('');
  });

  test('Scenario: 驗證多人任務重疊的紅色警戒 (Red Alert)', async ({ page }) => {
    await page.getByRole('button', { name: '新增專案' }).click();
    const projectNameInput = page.getByPlaceholder('專案名稱');
    await projectNameInput.fill('Overload Test');
    await projectNameInput.press('Enter');

    await expect(
      page.getByRole('heading', { name: 'Overload Test - 進度趨勢' })
    ).toBeVisible();

    // showAddTask defaults to true, so the add panel is already open

    const addTask = async (taskName, person, startDate) => {
      await page.getByPlaceholder('例如：實作 API').fill(taskName);
      await page.locator('input[type="number"]').first().fill('5');
      await page.getByPlaceholder('Name').fill(person);
      await page.locator('input[title="預期開始"]').fill(startDate);
      await page.getByRole('button', { name: '加入任務' }).click();
    };

    const targetStartDate = '2024-06-03';

    await addTask('Task A', 'Alice', targetStartDate);
    const rowA = getTaskRowByName(page, 'Task A');
    await expect(rowA).toHaveClass(/bg-white/);

    await addTask('Task B', 'Alice', targetStartDate);
    const rowB = getTaskRowByName(page, 'Task B');
    await expect(rowB).toHaveClass(/bg-orange-50/);
    await expect(rowB).toHaveClass(/border-l-orange-400/);

    await addTask('Task C', 'Alice', targetStartDate);
    const rowC = getTaskRowByName(page, 'Task C');

    await expect(rowC).toHaveClass(/bg-red-50/);
    await expect(rowC).toHaveClass(/border-l-red-500/);
    await expect(rowC.locator('svg.text-red-500')).toBeVisible();
  });

  test('Scenario: 圖表互動與 Log 功能', async ({ page }) => {
    // Seed a project with a task via API so the Log button exists
    const projId = await createProjectViaAPI('Log Test Project');
    await createTaskViaAPI(projId, {
      name: 'Log 測試任務',
      points: 3,
      people: 'Bob',
      expectedStart: '2024-03-01',
    });

    // Reload to pick up the seeded data (refresh token in localStorage enables auto-login)
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: '專案管理 Burnup' })).toBeVisible({ timeout: 15_000 });

    // Switch to the seeded project tab
    await page.getByText('Log Test Project').click();

    const logBtn = page.locator('button[title="紀錄"]').first();
    await logBtn.click();

    await expect(
      page.getByRole('heading', { name: /任務紀錄：/ })
    ).toBeVisible();

    const logContent = '這是一個測試 Log: 遇到 Bug';
    await page.locator('textarea').fill(logContent);
    await page.getByRole('button', { name: '新增紀錄' }).click();
    await expect(page.getByText(logContent)).toBeVisible();

    const logModal = page.locator('div.fixed.inset-0.bg-black\\/50');
    await logModal
      .locator('button')
      .filter({ has: page.locator('svg.lucide-x') })
      .click();
    await expect(logModal).not.toBeVisible();

    const fullscreenBtn = page.locator('button[title="全螢幕顯示"]');
    await fullscreenBtn.click();

    const fullscreenPanel = page.locator('div.fixed.inset-0.bg-white.z-\\[100\\]');
    await expect(fullscreenPanel).toBeVisible();

    await page.locator('button[title="關閉全螢幕"]').click();
    await expect(fullscreenPanel).not.toBeVisible();
  });
});

test.describe('合併檢視', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, expect);
  });

  test('Scenario: 首次進入合併 tab 應出現 Modal，確認後顯示 banner', async ({ page }) => {
    // Seed a project so there's something to merge
    await createProjectViaAPI('Merge Seed A');

    await page.evaluate(() => localStorage.removeItem('burnup_merged_project_ids'));
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: '專案管理 Burnup' })).toBeVisible({ timeout: 15_000 });

    // 點擊合併 tab → Modal 出現
    await page.getByText('合併檢視').click();
    await expect(page.getByText('選擇要合併的專案')).toBeVisible();

    // 勾選第一個 checkbox（至少一個）
    await page.locator('input[type="checkbox"]').first().check();

    // 點確認
    await page.getByRole('button', { name: '確認並檢視' }).click();

    // Modal 消失，banner 出現
    await expect(page.getByText('選擇要合併的專案')).not.toBeVisible();
    await expect(page.getByText('合併範圍：')).toBeVisible();
  });

  test('Scenario: 再次進入合併 tab 不再出現 Modal（localStorage 已設定）', async ({ page }) => {
    await createProjectViaAPI('Merge Seed B');

    await page.evaluate(() => localStorage.removeItem('burnup_merged_project_ids'));
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: '專案管理 Burnup' })).toBeVisible({ timeout: 15_000 });

    // Set up merged view through UI first
    await enterMergedViewViaUI(page);

    // Navigate away to the seeded project tab
    await page.getByText('Merge Seed B').first().click();
    await expect(page.getByText('合併範圍：')).not.toBeVisible();

    // Re-enter merged tab — should NOT show modal
    await page.getByText('合併檢視').click();
    await expect(page.getByText('選擇要合併的專案')).not.toBeVisible();
    await expect(page.getByText('合併範圍：')).toBeVisible();
  });

  test('Scenario: 合併 tab 唯讀 — 無新增表單、無刪除按鈕', async ({ page }) => {
    await createProjectViaAPI('Merge Seed C');

    await page.evaluate(() => localStorage.removeItem('burnup_merged_project_ids'));
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: '專案管理 Burnup' })).toBeVisible({ timeout: 15_000 });

    // Set up merged view through UI
    await enterMergedViewViaUI(page);

    // 無新增任務表單的 submit 按鈕
    await expect(page.getByRole('button', { name: '加入任務' })).not.toBeVisible();

    // 無 CSV 匯入按鈕（title 屬性辨識）
    await expect(page.locator('button[title="匯入 CSV"]')).not.toBeVisible();
  });

  test('Scenario: 取消 Modal 應切回上一個 tab', async ({ page }) => {
    await createProjectViaAPI('Cancel Test');

    await page.evaluate(() => localStorage.removeItem('burnup_merged_project_ids'));
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: '專案管理 Burnup' })).toBeVisible({ timeout: 15_000 });

    // 點合併 tab → Modal 出現
    await page.getByText('合併檢視').click();
    await expect(page.getByText('選擇要合併的專案')).toBeVisible();

    // 取消
    await page.getByRole('button', { name: '取消' }).click();

    // Modal 消失，合併 tab 不再是 active
    await expect(page.getByText('選擇要合併的專案')).not.toBeVisible();
    // Verify we're back on a regular project tab by checking banner is not visible
    await expect(page.getByText('合併範圍：')).not.toBeVisible();
  });

  test('Scenario: 重新設定可更改合併的專案', async ({ page }) => {
    await createProjectViaAPI('Merge Seed D');

    await page.evaluate(() => localStorage.removeItem('burnup_merged_project_ids'));
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: '專案管理 Burnup' })).toBeVisible({ timeout: 15_000 });

    // Set up merged view through UI
    await enterMergedViewViaUI(page);

    // 點重新設定
    await page.getByRole('button', { name: '重新設定' }).click();
    await expect(page.getByText('選擇要合併的專案')).toBeVisible();

    // 取消重新設定 → Modal 消失，仍留在合併檢視（banner 仍可見）
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByText('選擇要合併的專案')).not.toBeVisible();
    await expect(page.getByText('合併範圍：')).toBeVisible();
  });
});
