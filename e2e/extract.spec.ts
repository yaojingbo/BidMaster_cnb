import { test, expect } from "@playwright/test";

// 完整 SSE 流响应
const MOCK_SSE_BODY = [
  `data: ${JSON.stringify({ type: "progress", message: "正在读取文档..." })}\n\n`,
  `data: ${JSON.stringify({ type: "progress", message: "文档解析完成（15000字符），正在分析..." })}\n\n`,
  `data: ${JSON.stringify({ type: "llm_progress", message: "AI 正在分析文档内容..." })}\n\n`,
  `data: ${JSON.stringify({ type: "element", data: { name: "项目基本信息", content: "项目名称：某市污水处理厂\n招标编号：ZJ-2026-001\n项目规模：10万吨/日" } })}\n\n`,
  `data: ${JSON.stringify({ type: "element", data: { name: "资质要求", content: "市政公用工程施工总承包一级及以上" } })}\n\n`,
  `data: ${JSON.stringify({ type: "element", data: { name: "业绩要求", content: "近五年内完成过至少2个10万吨/日及以上规模业绩" } })}\n\n`,
  `data: ${JSON.stringify({ type: "element", data: { name: "人员要求", content: "项目经理须持有市政公用工程一级注册建造师证书" } })}\n\n`,
  `data: ${JSON.stringify({ type: "element", data: { name: "评标办法", content: "综合评估法：资信标10分 + 技术标30分 + 商务标60分" } })}\n\n`,
  `data: ${JSON.stringify({ type: "element", data: { name: "分值分配与评分细则", content: "企业业绩4分、信用评价4分" } })}\n\n`,
  `data: ${JSON.stringify({ type: "element", data: { name: "定标方法", content: "评定分离，票决法确定中标人" } })}\n\n`,
  `data: ${JSON.stringify({ type: "element", data: { name: "合同条款", content: "预付款10%、质保金3%" } })}\n\n`,
  `data: ${JSON.stringify({ type: "done", data: { summary: "文档分析完成", elementCount: 8 } })}\n\n`,
].join("");

const THRESHOLD_SSE_BODY = [
  `data: ${JSON.stringify({ type: "progress", message: "正在读取招标文件..." })}\n\n`,
  `data: ${JSON.stringify({ type: "progress", message: "AI 正在逐项比对门槛要求..." })}\n\n`,
  `data: ${JSON.stringify({ type: "element", data: { name: "资质要求对比", content: "| 等级 | 一级 | 一级 | ✅ |" } })}\n\n`,
  `data: ${JSON.stringify({ type: "element", data: { name: "业绩要求对比", content: "| 规模 | 10万吨/日 | 8万吨/日 | ❌ |" } })}\n\n`,
  `data: ${JSON.stringify({ type: "done", data: { summary: "门槛分析完成", elementCount: 2 } })}\n\n`,
].join("");


test.describe("要素提取 - 完整用户流程", () => {
  test.beforeEach(async ({ page }) => {
    // Mock 文件上传 API
    await page.route("**/api/files/upload", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-file-001",
          name: "测试招标文件.pdf",
          size: 1024000,
          type: "application/pdf",
          status: "ready",
          createdAt: new Date().toISOString(),
        }),
      });
    });

    // Mock 文件列表
    await page.route("**/api/files/list", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          files: [
            {
              id: "test-file-001",
              name: "测试招标文件.pdf",
              size: 1024000,
              mimeType: "application/pdf",
              category: "tender",
              status: "ready",
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
        }),
      });
    });

    // Mock SSE 提取（正则匹配 /api/extract/element 和 /api/extract/element/threshold）
    await page.route(/\/api\/extract\/element/, async (route) => {
      const isThreshold = route.request().url().includes("/threshold");
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: isThreshold ? THRESHOLD_SSE_BODY : MOCK_SSE_BODY,
      });
    });

    await page.goto("/extract");
    await page.waitForLoadState("networkidle");
  });

  test("MS-L-01: 上传文件后在列表中显示", async ({ page }) => {
    // 用 id="file-upload" 上传
    await page.locator("#file-upload").setInputFiles({
      name: "测试招标文件.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 mock"),
    });

    // 等待文件列表出现
    await expect(page.locator("text=测试招标文件.pdf").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=就绪").first()).toBeVisible();
  });

  test("MS-L-02: 完整提取流程 — 上传→提取→进度→8张要素卡片", async ({ page }) => {
    // 1. 上传文件
    await page.locator("#file-upload").setInputFiles({
      name: "测试招标文件.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 mock"),
    });

    // 2. 等待文件就绪，点击选中
    const fileItem = page.locator("text=测试招标文件.pdf").first();
    await expect(fileItem).toBeVisible({ timeout: 15000 });
    await fileItem.click();

    // 3. 点击"开始提取要素"
    const extractBtn = page.locator('button:has-text("开始提取要素")');
    await expect(extractBtn).toBeEnabled({ timeout: 5000 });
    await extractBtn.click();

    // 4. 等待提取结果出现
    await expect(page.locator('h2:has-text("提取结果")')).toBeVisible({ timeout: 30000 });

    // 5. 验证 8 个要素名全部可见
    const elementNames = ["项目基本信息", "资质要求", "业绩要求", "人员要求", "评标办法", "分值分配与评分细则", "定标方法", "合同条款"];
    for (const name of elementNames) {
      await expect(page.locator(`text=${name}`).first()).toBeVisible();
    }
  });

  test("MS-D-01: 中断提取 — 点击 AbortController 中断请求", async ({ page }) => {
    // 覆盖 mock 为永不完成的响应（模拟网络 hang）
    await page.unroute(/\/api\/extract\/element/);
    await page.route(/\/api\/extract\/element(?!\/threshold)/, async () => {
      // Never fulfill - simulates network hang
      await new Promise(() => {});
    });

    await page.locator("#file-upload").setInputFiles({
      name: "测试招标文件.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 mock"),
    });

    const fileItem = page.locator("text=测试招标文件.pdf").first();
    await expect(fileItem).toBeVisible({ timeout: 15000 });
    await fileItem.click();

    await page.locator('button:has-text("开始提取要素")').click();

    // 等待：按钮文字变为"提取中..."
    await expect(page.locator('button:has-text("提取中...")')).toBeVisible({ timeout: 5000 });

    // 等待停止按钮出现
    await expect(page.locator('button:has-text("停止提取")')).toBeVisible({ timeout: 5000 });

    // 点击停止（触发 AbortController.abort()）
    await page.locator('button:has-text("停止提取")').click();

    // 验证按钮恢复为"开始提取要素"（streaming 结束）
    await expect(page.locator('button:has-text("开始提取要素")')).toBeVisible({ timeout: 5000 });
  });

  test("MS-L-04: 门槛分析 Tab — 填写资质→按钮激活", async ({ page }) => {
    // 上传并选中文件
    await page.locator("#file-upload").setInputFiles({
      name: "测试招标文件.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 mock"),
    });

    const fileItem = page.locator("text=测试招标文件.pdf").first();
    await expect(fileItem).toBeVisible({ timeout: 15000 });
    await fileItem.click();

    // 切换到门槛分析 Tab
    await page.locator('button:has-text("门槛分析")').click();

    // 未填写资质时按钮应禁用
    await expect(page.locator('button:has-text("开始门槛分析")')).toBeDisabled();

    // 填写自身资质后按钮应启用
    await page.locator("textarea").fill(
      "资质等级：市政公用工程施工总承包一级\n业绩：近五年完成2个8万吨/日污水处理厂"
    );
    await expect(page.locator('button:has-text("开始门槛分析")')).toBeEnabled();
  });

  test("页面加载：标题 + 上传区域 + Tab 导航", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("要素提取");
    await expect(page.locator("text=点击或拖拽文件到此区域")).toBeVisible();
    await expect(page.locator("text=支持 PDF、Markdown、Word、Excel")).toBeVisible();
    await expect(page.locator('button:has-text("单文件提取")')).toBeVisible();
    await expect(page.locator('button:has-text("批量对比")')).toBeVisible();
    await expect(page.locator('button:has-text("门槛分析")')).toBeVisible();
  });
});
