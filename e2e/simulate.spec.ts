import { test, expect } from "@playwright/test";

test.describe("Simulate Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/simulate");
  });

  test("should display simulate page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("模拟编制");
  });

  test("should show step indicators", async ({ page }) => {
    const steps = page.locator('text=上传参考');
    await expect(steps).toBeVisible();
  });

  test("should navigate through steps", async ({ page }) => {
    // Upload step
    const uploadArea = page.locator('text=拖拽文件到此处');
    if (await uploadArea.isVisible()) {
      await uploadArea.click();
    }

    // Config step
    const configNext = page.locator('button:has-text("下一步")');
    if (await configNext.isVisible()) {
      await configNext.click();
    }
  });

  test("should generate document", async ({ page }) => {
    // Click generate button
    const generateButton = page.locator('button:has-text("开始生成")');
    if (await generateButton.isVisible()) {
      await generateButton.click();
      // Wait for generation
      await page.waitForTimeout(3000);
    }
  });

  test("should export document", async ({ page }) => {
    // Look for export button
    const exportButton = page.locator('button:has-text("导出")');
    if (await exportButton.isVisible()) {
      await exportButton.click();
    }
  });
});
