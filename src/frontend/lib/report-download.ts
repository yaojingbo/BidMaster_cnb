'use client';

import { authFetch } from '@/lib/auth-fetch';
import { downloadBlob } from '@/lib/data-api';

interface PdfDownloadOptions {
  title?: string;
  subtitle?: string;
  sourceType?: string;
  metadata?: Record<string, unknown>;
}

export async function downloadMarkdownPdf(
  content: string,
  filename: string,
  options: PdfDownloadOptions = {}
) {
  if (!content.trim()) {
    throw new Error('没有可导出的内容');
  }

  const response = await authFetch('/api/data/exports/markdown/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: options.title || options.subtitle || filename.replace(/\.pdf$/i, ''),
      source_type: options.sourceType,
      markdown: content,
      metadata: options.metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `PDF 生成失败: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  downloadBlob(blob, filename);
}
