import { test, expect } from '@playwright/test';

test.describe('Burnup Chart App 完整流程測試', () => {
  const getTaskRowByName = (page, taskName) =>
    page.locator(`tr[data-task-name="${taskName}"]`);

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '專案管理 Burnup' })).toBeVisible();
  });

  test('Scenario: 建立新專案並驗證工作日推算邏輯', async ({ page }) => {
    await page.getByRole('button', { name: '新增專案' }).click();
    const projectNameInput = page.getByPlaceholder('專案名稱');
    await projectNameInput.fill('Playwright Demo');
    await projectNameInput.press('Enter');

    await expect(
      page.getByRole('heading', { name: 'Playwright Demo - 進度趨勢' })
    ).toBeVisible();

    await page.getByRole('button', { name: '開啟新增面板' }).click();
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

    await page.getByRole('button', { name: '開啟新增面板' }).click();

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

    const fullscreenBtn = page.locator('button[title="全螢幕顯示 (適合簡報)"]');
    await fullscreenBtn.click();

    const fullscreenPanel = page.locator('div.fixed.inset-0.bg-white.z-\\[100\\]');
    await expect(fullscreenPanel).toBeVisible();

    await page.locator('button[title="關閉全螢幕"]').click();
    await expect(fullscreenPanel).not.toBeVisible();
  });
});
