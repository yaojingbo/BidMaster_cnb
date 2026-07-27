import { test, expect } from "@playwright/test";

test.describe("文件上传流程", () => {
  test.beforeEach(async ({ page }) => {
    // Mock 文件上传 API
    await page.route("**/api/files/upload", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "upload-test-001",
          name: "招标文件-测试.pdf",
          size: 2048000,
          type: "application/pdf",
          status: "ready",
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await page.route("**/api/files/list", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ files: [], total: 0 }),
      });
    });

    await page.goto("/extract");
    await page.waitForLoadState("networkidle");
  });

  test("上传区域可见，提示文案正确", async ({ page }) => {
    await expect(page.locator("text=点击或拖拽文件到此区域")).toBeVisible();
    await expect(page.locator("text=支持 PDF、Markdown、Word、Excel")).toBeVisible();
  });

  test("上传 PDF 文件成功，文件出现在列表中", async ({ page }) => {
    await page.locator("#file-upload").setInputFiles({
      name: "招标文件-测试.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 mock"),
    });

    await expect(page.locator("text=招标文件-测试.pdf").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=就绪").first()).toBeVisible();
  });

  test("上传后文件可被选中（提取按钮出现）", async ({ page }) => {
    await page.locator("#file-upload").setInputFiles({
      name: "招标文件-测试.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 mock"),
    });

    await expect(page.locator("text=招标文件-测试.pdf").first()).toBeVisible({ timeout: 10000 });
    await page.locator("text=招标文件-测试.pdf").first().click();

    // 选中文件后提取按钮应出现
    await expect(page.locator('button:has-text("开始提取要素")')).toBeVisible({ timeout: 5000 });
  });

  test("不支持的文件类型 — 上传区域仍可用", async ({ page }) => {
    // Mock 返回错误
    await page.unroute("**/api/files/upload");
    await page.route("**/api/files/upload", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "不支持的文件类型" }),
      });
    });

    await page.locator("#file-upload").setInputFiles({
      name: "virus.exe",
      mimeType: "application/x-executable",
      buffer: Buffer.from("mock"),
    });

    // 上传区域仍可见（页面不崩溃）
    await expect(page.locator("text=点击或拖拽文件到此区域")).toBeVisible();
  });
});
