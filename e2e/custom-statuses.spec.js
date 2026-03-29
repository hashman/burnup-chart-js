import { test, expect } from '@playwright/test';
import { API_BASE } from './test-config.js';

// ---------------------------------------------------------------------------
// API Helpers
// ---------------------------------------------------------------------------

async function getStatuses() {
  const res = await fetch(`${API_BASE}/statuses`);
  if (!res.ok) throw new Error(`getStatuses failed: ${res.status}`);
  return res.json();
}

async function deleteAllTodos() {
  const res = await fetch(`${API_BASE}/todos`);
  if (!res.ok) return;
  const todos = await res.json();
  await Promise.all(
    todos.map((t) => fetch(`${API_BASE}/todos/${t.id}`, { method: 'DELETE' })),
  );
}

/**
 * Reset statuses back to default 3: 待辦 (start), 進行中 (middle), 已完成 (end).
 * Deletes any extra custom statuses and restores default names if renamed.
 */
async function resetCustomStatuses() {
  const statuses = await getStatuses();

  // Delete non-default statuses that are extra (not start, not end, and more than 1 middle)
  const starts = statuses.filter((s) => s.isDefaultStart);
  const ends = statuses.filter((s) => s.isDefaultEnd);
  const middles = statuses.filter((s) => !s.isDefaultStart && !s.isDefaultEnd);

  // Keep only one middle status; delete the rest
  if (middles.length > 1) {
    for (let i = 1; i < middles.length; i++) {
      await fetch(`${API_BASE}/statuses/${middles[i].id}`, { method: 'DELETE' });
    }
  }

  // If there's no middle status (unlikely), create one
  if (middles.length === 0) {
    await fetch(`${API_BASE}/statuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '進行中', sortOrder: 1 }),
    });
  }

  // Restore default names
  const refreshed = await getStatuses();
  for (const s of refreshed) {
    if (s.isDefaultStart && s.name !== '待辦') {
      await fetch(`${API_BASE}/statuses/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '待辦' }),
      });
    }
    if (s.isDefaultEnd && s.name !== '已完成') {
      await fetch(`${API_BASE}/statuses/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '已完成' }),
      });
    }
    if (!s.isDefaultStart && !s.isDefaultEnd && s.name !== '進行中') {
      await fetch(`${API_BASE}/statuses/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '進行中' }),
      });
    }
  }
}

async function createTodoViaAPI(title, statusId) {
  const body = { title };
  if (statusId) body.status = statusId;
  const res = await fetch(`${API_BASE}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`createTodo failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function createStatusViaAPI(name, sortOrder) {
  const body = { name };
  if (sortOrder !== undefined) body.sortOrder = sortOrder;
  const res = await fetch(`${API_BASE}/statuses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`createStatus failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Navigate to the Todo tab and wait for the Kanban board to render. */
async function navigateToTodoTab(page) {
  await page.goto('/');
  // The Todo tab is a button/tab at the bottom of the tab bar
  await page.getByText('Todo', { exact: true }).click();
  // Wait for the default "待辦" column header to appear
  await expect(page.locator('h3', { hasText: '待辦' })).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Todo + Custom Statuses', () => {
  test.beforeEach(async () => {
    await deleteAllTodos();
    await resetCustomStatuses();
  });

  test('displays default 3 status columns', async ({ page }) => {
    await navigateToTodoTab(page);

    await expect(page.locator('h3', { hasText: '待辦' })).toBeVisible();
    await expect(page.locator('h3', { hasText: '進行中' })).toBeVisible();
    await expect(page.locator('h3', { hasText: '已完成' })).toBeVisible();
  });

  test('create and display a todo', async ({ page }) => {
    await navigateToTodoTab(page);

    // Click the "新增 Todo" button to open the form modal
    await page.getByText('新增 Todo').click();

    // Fill the title field
    await page.getByPlaceholder('輸入待辦事項').fill('E2E 測試任務');

    // Submit the form
    await page.getByRole('button', { name: '新增', exact: true }).click();

    // Verify the card appears on the Kanban board
    await expect(page.getByText('E2E 測試任務')).toBeVisible();
  });

  test('inline rename a status column', async ({ page }) => {
    await navigateToTodoTab(page);

    const columnHeader = page.locator('h3', { hasText: '進行中' });
    await expect(columnHeader).toBeVisible();

    // Double-click the header to start inline editing
    await columnHeader.dblclick();

    // An inline input should appear with the current name
    const input = page.locator('input.text-sm.font-bold');
    await expect(input).toBeVisible();
    await input.fill('開發中');
    await input.press('Enter');

    // Verify the new name is rendered
    await expect(page.locator('h3', { hasText: '開發中' })).toBeVisible();
    await expect(page.locator('h3', { hasText: '進行中' })).not.toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await page.getByText('Todo', { exact: true }).click();
    await expect(page.locator('h3', { hasText: '開發中' })).toBeVisible({ timeout: 10_000 });
  });

  test('add a new status column via + button', async ({ page }) => {
    await navigateToTodoTab(page);

    // Click the "+" button (title="新增狀態")
    await page.locator('button[title="新增狀態"]').click();

    // An inline input appears with default name "新狀態" — rename it
    const input = page.locator('input.text-sm.font-bold');
    await expect(input).toBeVisible();
    await input.fill('審核中');
    await input.press('Enter');

    // Verify the new column appears
    await expect(page.locator('h3', { hasText: '審核中' })).toBeVisible();
  });

  test('cannot delete start/end statuses', async ({ page }) => {
    await navigateToTodoTab(page);

    // Delete buttons are only rendered for non-default-start/end columns (canDelete).
    // The buttons for "待辦" and "已完成" should not exist in the DOM at all.
    await expect(page.locator('button[title="刪除「待辦」"]')).toHaveCount(0);
    await expect(page.locator('button[title="刪除「已完成」"]')).toHaveCount(0);

    // But the middle column "進行中" should have a delete button
    await expect(page.locator('button[title="刪除「進行中」"]')).toHaveCount(1);
  });

  test('delete a custom status with no todos', async ({ page }) => {
    // Create a custom status via API
    await createStatusViaAPI('待刪除', 1.5);

    await navigateToTodoTab(page);
    await expect(page.locator('h3', { hasText: '待刪除' })).toBeVisible();

    // Set up dialog handler to auto-confirm the deletion prompt
    page.on('dialog', (dialog) => dialog.accept());

    // Click delete button (force: true because it is opacity-0 until hover)
    await page.locator('button[title="刪除「待刪除」"]').click({ force: true });

    // Verify the column is gone
    await expect(page.locator('h3', { hasText: '待刪除' })).not.toBeVisible();
  });

  test('drag todo to different column updates status', async ({ page }) => {
    // Get status IDs
    const statuses = await getStatuses();
    const startStatus = statuses.find((s) => s.isDefaultStart);
    const middleStatus = statuses.find((s) => !s.isDefaultStart && !s.isDefaultEnd);

    // Create a todo in the start column
    const todo = await createTodoViaAPI('拖曳測試', startStatus.id);

    await navigateToTodoTab(page);
    await expect(page.getByText('拖曳測試')).toBeVisible();

    // Perform drag via Playwright's dragTo — target the middle column header area
    const card = page.getByText('拖曳測試');
    const targetColumnHeader = page.locator('h3', { hasText: middleStatus.name });

    await card.dragTo(targetColumnHeader);

    // Allow time for the optimistic update + API call
    await page.waitForTimeout(500);

    // Verify via API that the todo's status changed
    const todosRes = await fetch(`${API_BASE}/todos`);
    const todosAfter = await todosRes.json();
    const updated = todosAfter.find((t) => t.id === todo.id);
    expect(updated.status).toBe(middleStatus.id);
  });
});
