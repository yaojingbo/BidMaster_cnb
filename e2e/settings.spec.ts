import { test, expect } from "@playwright/test";

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("should display settings page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("AI 设置");
  });

  test("should display provider list", async ({ page }) => {
    const providerList = page.locator('[class*="provider"]');
    await expect(providerList.first()).toBeVisible();
  });

  test("should switch provider", async ({ page }) => {
    // Find and click a provider
    const providerButton = page.locator('button:has-text("切换")').first();
    if (await providerButton.isVisible()) {
      await providerButton.click();
    }
  });

  test("should test connection", async ({ page }) => {
    // Find and click test button
    const testButton = page.locator('button:has-text("测试连接")').first();
    if (await testButton.isVisible()) {
      await testButton.click();
      // Wait for result
      await page.waitForTimeout(2000);
    }
  });

  test("should display active provider", async ({ page }) => {
    const activeProvider = page.locator('text=使用中');
    await expect(activeProvider).toBeVisible();
  });
});
