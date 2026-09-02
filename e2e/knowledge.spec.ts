import { expect, test } from '@playwright/test';

const knowledgeBaseId = 'kb-1';
const fileId = 'file-1';

function envelope<T>(data: T) {
  return { success: true, data };
}

async function mockKnowledgePage(page: import('@playwright/test').Page) {
  let pollCount = 0;
  let indexCompleted = false;
  await page.context().addCookies([{ name: 'auth_status', value: '1', domain: 'localhost', path: '/' }]);
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { access_token: 'test-token', token_type: 'bearer' } }));
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'user-1', username: 'test', role: 'user' } }));
  await page.route('**/api/knowledge/knowledge-bases/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith('/available-sources')) {
      await route.fulfill({ json: envelope({ items: [] }) });
      return;
    }
    if (path.endsWith('/index-jobs/active')) {
      await route.fulfill({ json: envelope(null) });
      return;
    }
    if (path.endsWith('/index-jobs/job-1')) {
      pollCount += 1;
      const completed = pollCount > 1;
      indexCompleted = completed;
      await route.fulfill({
        json: envelope({
          job: {
            id: 'job-1', status: completed ? 'completed' : 'processing', requested_file_ids: [fileId],
            completed_file_count: completed ? 1 : 0, failed_file_count: 0, total_item_count: 1,
            skipped_item_count: 0, current_stage: completed ? 'completed' : 'embedding',
            progress_percent: completed ? 100 : 60, progress_message: completed ? '索引完成' : '正在生成向量',
          },
          items: [{
            id: 'item-1', file_id: fileId, display_name: '招标文件.pdf',
            status: completed ? 'completed' : 'processing', current_stage: completed ? 'completed' : 'embedding',
            progress_percent: completed ? 100 : 60, progress_message: completed ? '索引完成' : '正在生成向量',
          }],
          files: [{ id: fileId, original_name: '招标文件.pdf', index_status: completed ? 'completed' : 'processing', chunk_count: completed ? 8 : 0 }],
        }),
      });
      return;
    }
    if (path.endsWith(`/knowledge-bases/${knowledgeBaseId}`)) {
      await route.fulfill({
        json: envelope({
          id: knowledgeBaseId, name: '测试知识库', description: '索引交互测试',
          files: [{ id: fileId, original_name: '招标文件.pdf', index_status: indexCompleted ? 'completed' : 'not_indexed', chunk_count: indexCompleted ? 8 : 0 }],
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/data/files**', route => route.fulfill({ json: envelope({ files: [], total: 0 }) }));
}

test.describe('知识库页面', () => {
  test('左侧导航可进入知识库并显示页面标题', async ({ page }) => {
    await page.context().addCookies([{ name: 'auth_status', value: '1', domain: 'localhost', path: '/' }]);
    await page.route('**/api/auth/refresh', route => route.fulfill({ json: { access_token: 'test-token', token_type: 'bearer' } }));
    await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'user-1', username: 'test', role: 'user' } }));
    await page.route('**/api/knowledge/knowledge-bases', route => route.fulfill({ json: envelope({ items: [] }) }));
    await page.goto('/knowledge');
    await expect(page.getByRole('heading', { name: '知识库', exact: true })).toBeVisible();
    await expect(page.getByText('新建知识库')).toBeVisible();
  });

  test('确认后显示提交状态并轮询至完成', async ({ page }) => {
    await mockKnowledgePage(page);
    let requestBody: unknown;
    await page.route(`**/api/knowledge/knowledge-bases/${knowledgeBaseId}/index-jobs`, async route => {
      requestBody = route.request().postDataJSON();
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({ status: 202, json: envelope({ job_id: 'job-1', status: 'pending' }) });
    });
    page.on('dialog', dialog => dialog.accept());

    await page.goto(`/knowledge/${knowledgeBaseId}`);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '开始索引' }).click();

    await expect(page.getByRole('button', { name: '正在创建任务' })).toBeDisabled();
    await expect.poll(() => requestBody).toEqual({ file_ids: [fileId], force: false });
    await expect(page.getByText('索引完成', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('已完成 · 8 个片段')).toBeVisible();
  });

  test('创建索引失败时显示错误并恢复按钮', async ({ page }) => {
    await mockKnowledgePage(page);
    await page.route(`**/api/knowledge/knowledge-bases/${knowledgeBaseId}/index-jobs`, route => route.fulfill({
      status: 503,
      json: { detail: '知识库数据库能力不可用：缺少 vector 扩展' },
    }));
    page.on('dialog', dialog => dialog.accept());

    await page.goto(`/knowledge/${knowledgeBaseId}`);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '开始索引' }).click();

    await expect(page.getByText('知识库数据库能力不可用：缺少 vector 扩展')).toBeVisible();
    await expect(page.getByRole('button', { name: '开始索引' })).toBeEnabled();
  });
});
