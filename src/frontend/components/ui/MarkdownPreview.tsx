'use client';

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderMarkdownInline = (text: string) =>
  escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

const isChineseSectionTitle = (text: string) =>
  /^(第[一二三四五六七八九十]+[章节条部分]|[一二三四五六七八九十]+[、.．]|（[一二三四五六七八九十]+）|\([一二三四五六七八九十]+\))\s*[^：:]{2,40}$/.test(text);

const isFieldLine = (text: string) => /^[一-龥A-Za-z0-9_\-/（）()\s]{2,24}[：:].+/.test(text);

const splitTableRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());

const isTableDivider = (line: string) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line);

export const renderMarkdown = (text: string) => {
  const lines = text.split('\n');
  const html: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  const closeParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${renderMarkdownInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      closeParagraph();
      closeList();
      continue;
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      closeParagraph();
      closeList();
      html.push('<hr />');
      continue;
    }

    const nextLine = lines[index + 1]?.trim() || '';
    if (trimmed.includes('|') && isTableDivider(nextLine)) {
      closeParagraph();
      closeList();
      const headers = splitTableRow(trimmed);
      html.push('<table><thead><tr>');
      for (const header of headers) html.push(`<th>${renderMarkdownInline(header)}</th>`);
      html.push('</tr></thead><tbody>');
      index += 1;
      while (lines[index + 1]?.trim().includes('|')) {
        index += 1;
        html.push('<tr>');
        for (const cell of splitTableRow(lines[index])) html.push(`<td>${renderMarkdownInline(cell)}</td>`);
        html.push('</tr>');
      }
      html.push('</tbody></table>');
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
      continue;
    }

    if (isChineseSectionTitle(trimmed)) {
      closeParagraph();
      closeList();
      html.push(`<h2>${renderMarkdownInline(trimmed.replace(/^[一二三四五六七八九十]+[、.．]\s*/, ''))}</h2>`);
      continue;
    }

    if (isFieldLine(trimmed)) {
      closeParagraph();
      closeList();
      const [label, ...rest] = trimmed.split(/[：:]/);
      html.push(`<p><strong>${renderMarkdownInline(label)}：</strong>${renderMarkdownInline(rest.join('：').trim())}</p>`);
      continue;
    }

    const blockquote = trimmed.match(/^>\s+(.+)$/);
    if (blockquote) {
      closeParagraph();
      closeList();
      html.push(`<blockquote>${renderMarkdownInline(blockquote[1])}</blockquote>`);
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      closeParagraph();
      if (listType !== 'ul') {
        closeList();
        html.push('<ul>');
        listType = 'ul';
      }
      html.push(`<li>${renderMarkdownInline(unordered[1])}</li>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      closeParagraph();
      if (listType !== 'ol') {
        closeList();
        html.push('<ol>');
        listType = 'ol';
      }
      html.push(`<li>${renderMarkdownInline(ordered[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  closeParagraph();
  closeList();
  return html.join('');
};

export function MarkdownPreview({ content }: { content: string }) {
  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
}
