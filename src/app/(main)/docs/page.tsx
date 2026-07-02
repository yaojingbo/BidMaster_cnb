import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: '文档说明 · Bid Master',
};

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }
    if (match[2] && match[3]) {
      const href = match[3];
      const isExternal = /^https?:\/\//.test(href);
      if (isExternal) {
        parts.push(
          createElement(
            'a',
            {
              key: `${keyPrefix}-l-${idx}`,
              href,
              target: '_blank',
              rel: 'noreferrer',
              className: 'text-primary underline underline-offset-4 hover:opacity-80',
            },
            match[2],
          ),
        );
      } else {
        parts.push(
          createElement(
            Link,
            {
              key: `${keyPrefix}-l-${idx}`,
              href,
              className: 'text-primary underline underline-offset-4 hover:opacity-80',
            },
            match[2],
          ),
        );
      }
    } else if (match[4]) {
      parts.push(
        createElement(
          'code',
          {
            key: `${keyPrefix}-c-${idx}`,
            className: 'rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]',
          },
          match[4],
        ),
      );
    } else if (match[5]) {
      parts.push(
        createElement('strong', { key: `${keyPrefix}-b-${idx}` }, match[5]),
      );
    }
    cursor = match.index + match[0].length;
    idx += 1;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return parts;
}

function renderMarkdown(markdown: string): ReactElement[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactElement[] = [];
  let buffer: string[] = [];
  let blockKind: 'p' | 'ul' | 'ol' | 'code' | null = null;
  let codeLang = '';
  let key = 0;

  const flushParagraph = () => {
    if (!buffer.length) return;
    blocks.push(
      createElement(
        'p',
        { key: `p-${key++}`, className: 'text-base leading-7 text-foreground/90' },
        renderInline(buffer.join(' '), `p-${key}`),
      ),
    );
    buffer = [];
  };
  const flushList = (ordered: boolean) => {
    if (!buffer.length) return;
    const items = buffer.map((line, i) =>
      createElement(
        'li',
        { key: `li-${key}-${i}`, className: 'leading-7 text-foreground/90' },
        renderInline(line.replace(/^(?:\d+\.|\-|\*)\s+/, ''), `li-${key}-${i}`),
      ),
    );
    if (ordered) {
      blocks.push(
        createElement(
          'ol',
          { key: `ol-${key++}`, className: 'list-decimal space-y-1 pl-6' },
          items,
        ),
      );
    } else {
      blocks.push(
        createElement(
          'ul',
          { key: `ul-${key++}`, className: 'list-disc space-y-1 pl-6' },
          items,
        ),
      );
    }
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (blockKind === 'p') flushParagraph();
      else if (blockKind === 'ul') flushList(false);
      else if (blockKind === 'ol') flushList(true);
      blockKind = null;
      continue;
    }

    if (line.startsWith('```')) {
      if (blockKind === 'p') flushParagraph();
      else if (blockKind === 'ul') flushList(false);
      else if (blockKind === 'ol') flushList(true);
      if (blockKind === 'code') {
        blocks.push(
          createElement(
            'pre',
            {
              key: `pre-${key++}`,
              className:
                'overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-sm',
            },
            createElement(
              'code',
              { className: `font-mono ${codeLang ? `language-${codeLang}` : ''}` },
              buffer.join('\n'),
            ),
          ),
        );
        buffer = [];
        blockKind = null;
        codeLang = '';
      } else {
        blockKind = 'code';
        codeLang = line.slice(3).trim();
        buffer = [];
      }
      continue;
    }

    if (blockKind === 'code') {
      buffer.push(line);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      if (blockKind === 'p') flushParagraph();
      else if (blockKind === 'ul') flushList(false);
      else if (blockKind === 'ol') flushList(true);
      const level = heading[1].length;
      const content = heading[2];
      const className =
        level === 1
          ? 'mt-8 text-3xl font-bold tracking-tight text-foreground'
          : level === 2
            ? 'mt-8 text-2xl font-semibold tracking-tight text-foreground'
            : 'mt-6 text-lg font-semibold text-foreground';
      const tag = `h${Math.min(Math.max(level, 1), 6)}`;
      blocks.push(
        createElement(
          tag,
          { key: `h-${key++}`, className },
          renderInline(content, `h-${key}`),
        ),
      );
      blockKind = null;
      continue;
    }

    if (line.startsWith('>')) {
      if (blockKind === 'p') flushParagraph();
      else if (blockKind === 'ul') flushList(false);
      else if (blockKind === 'ol') flushList(true);
      blockKind = 'p';
      buffer.push(line.replace(/^>\s?/, ''));
      continue;
    }

    const ordered = /^\d+\.\s+/.test(line);
    const unordered = /^[-*]\s+/.test(line);
    if (ordered) {
      if (blockKind !== 'ol') {
        if (blockKind === 'p') flushParagraph();
        else if (blockKind === 'ul') flushList(false);
        blockKind = 'ol';
        buffer = [];
      }
      buffer.push(line);
      continue;
    }
    if (unordered) {
      if (blockKind !== 'ul') {
        if (blockKind === 'p') flushParagraph();
        else if (blockKind === 'ol') flushList(true);
        blockKind = 'ul';
        buffer = [];
      }
      buffer.push(line);
      continue;
    }

    if (line === '---') {
      if (blockKind === 'p') flushParagraph();
      else if (blockKind === 'ul') flushList(false);
      else if (blockKind === 'ol') flushList(true);
      blocks.push(
        createElement('hr', {
          key: `hr-${key++}`,
          className: 'my-6 border-border',
        }),
      );
      blockKind = null;
      continue;
    }

    if (blockKind !== 'p') {
      if (blockKind === 'ul') flushList(false);
      else if (blockKind === 'ol') flushList(true);
      blockKind = 'p';
    }
    buffer.push(line);
  }

  if (blockKind === 'p') flushParagraph();
  else if (blockKind === 'ul') flushList(false);
  else if (blockKind === 'ol') flushList(true);
  else if (blockKind === 'code' && buffer.length) {
    blocks.push(
      createElement(
        'pre',
        {
          key: `pre-${key++}`,
          className:
            'overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-sm',
        },
        createElement('code', { className: 'font-mono' }, buffer.join('\n')),
      ),
    );
  }

  return blocks;
}

async function loadDoc(): Promise<{ title: string; content: string }> {
  const filePath = path.join(process.cwd(), 'docs', 'QUICKSTART.md');
  const raw = await fs.readFile(filePath, 'utf8');
  const lines = raw.split('\n');
  const titleLine = lines.find(line => line.startsWith('# '));
  const title = titleLine ? titleLine.replace(/^#\s+/, '').trim() : '文档说明';
  return { title, content: raw };
}

export default async function DocsPage() {
  const doc = await loadDoc();
  const blocks = renderMarkdown(doc.content);

  return createElement(
    'div',
    {
      className:
        'mx-auto w-full max-w-4xl px-4 pb-16 pt-8 sm:px-6 lg:px-8',
    },
    createElement(
      'div',
      {
        className:
          'mb-6 flex items-center gap-2 text-sm text-muted-foreground',
      },
      createElement(
        Link,
        {
          href: '/',
          className:
            'inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-muted hover:text-foreground',
        },
        createElement(ArrowLeft, { className: 'h-4 w-4' }),
        '返回首页',
      ),
    ),
    createElement(
      'article',
      {
        className:
          'rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8',
      },
      createElement(
        'header',
        { className: 'mb-6 border-b border-border pb-4' },
        createElement(
          'p',
          {
            className:
              'text-xs uppercase tracking-wider text-primary',
          },
          '产品文档',
        ),
        createElement(
          'h1',
          {
            className:
              'mt-2 text-3xl font-bold tracking-tight text-foreground',
          },
          doc.title,
        ),
      ),
      createElement('div', { className: 'space-y-4' }, ...blocks),
    ),
  );
}