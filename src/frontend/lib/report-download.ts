'use client';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { renderMarkdown } from '@/components/ui/MarkdownPreview';

interface PdfDownloadOptions {
  title?: string;
  subtitle?: string;
}

const createReportHtml = (content: string, options: PdfDownloadOptions) => {
  const generatedAt = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  return `
    <div class="pdf-report">
      ${options.title ? `<h1 class="pdf-report-title">${escapeReportText(options.title)}</h1>` : ''}
      ${options.subtitle ? `<p class="pdf-report-subtitle">${escapeReportText(options.subtitle)}</p>` : ''}
      <p class="pdf-report-meta">生成时间：${generatedAt}</p>
      <div class="markdown-body">${renderMarkdown(content)}</div>
    </div>
  `;
};

const escapeReportText = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const createHiddenContainer = (html: string) => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.color = '#111827';
  container.style.padding = '48px';
  container.style.boxSizing = 'border-box';
  container.style.fontFamily = 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.8';
  container.innerHTML = html;

  const style = document.createElement('style');
  style.textContent = `
    .pdf-report-title {
      margin: 0 0 12px;
      font-size: 28px;
      line-height: 1.25;
      color: #0f172a;
    }
    .pdf-report-subtitle {
      margin: 0 0 10px;
      font-size: 16px;
      color: #334155;
    }
    .pdf-report-meta {
      margin: 0 0 28px;
      color: #64748b;
      font-size: 12px;
    }
    .pdf-report .markdown-body { line-height: 1.8; color: #111827; }
    .pdf-report .markdown-body h1 { font-size: 24px; font-weight: 700; margin: 24px 0 12px; }
    .pdf-report .markdown-body h2 { font-size: 20px; font-weight: 700; margin: 22px 0 10px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .pdf-report .markdown-body h3 { font-size: 18px; font-weight: 600; margin: 18px 0 8px; }
    .pdf-report .markdown-body h4 { font-size: 16px; font-weight: 600; margin: 16px 0 6px; }
    .pdf-report .markdown-body p { margin: 8px 0; }
    .pdf-report .markdown-body ul,
    .pdf-report .markdown-body ol { padding-left: 24px; margin: 8px 0; }
    .pdf-report .markdown-body li { margin: 4px 0; }
    .pdf-report .markdown-body table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 12px; }
    .pdf-report .markdown-body th,
    .pdf-report .markdown-body td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; vertical-align: top; }
    .pdf-report .markdown-body th { background: #f3f4f6; font-weight: 600; }
    .pdf-report .markdown-body tr:nth-child(even) td { background: #f9fafb; }
    .pdf-report .markdown-body code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .pdf-report .markdown-body pre { background: #f3f4f6; padding: 16px; border-radius: 8px; overflow-wrap: anywhere; white-space: pre-wrap; }
    .pdf-report .markdown-body blockquote { border-left: 3px solid #0f8f5f; padding-left: 16px; margin: 12px 0; color: #475569; }
    .pdf-report .markdown-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  `;
  container.prepend(style);
  document.body.appendChild(container);
  return container;
};

export async function downloadMarkdownPdf(
  content: string,
  filename: string,
  options: PdfDownloadOptions = {}
) {
  if (!content.trim()) {
    throw new Error('没有可导出的内容');
  }

  const container = createHiddenContainer(createReportHtml(content, options));

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    const imageData = canvas.toDataURL('image/png');

    let remainingHeight = imageHeight;
    let position = margin;

    pdf.addImage(imageData, 'PNG', margin, position, imageWidth, imageHeight);
    remainingHeight -= pageHeight - margin * 2;

    while (remainingHeight > 0) {
      position = remainingHeight - imageHeight + margin;
      pdf.addPage();
      pdf.addImage(imageData, 'PNG', margin, position, imageWidth, imageHeight);
      remainingHeight -= pageHeight - margin * 2;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
