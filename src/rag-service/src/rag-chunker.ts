import { createHash } from 'node:crypto';

/** 页面标记：`--- 第 N 页(文本|表格) ---` */
const PAGE_MARKER = /^---\s*第\s*(\d+)\s*页(?:文本|表格)?\s*---$/;
/** 标题/章节标记：markdown #、中文第X章/节、数字编号、中文序号、括号序号 */
const HEADING = /^(?:#{1,6}\s+|第[一二三四五六七八九十百\d]+[章节篇]\s*|\d+(?:\.\d+){0,4}[、.．\s]+|[一二三四五六七八九十]+、|（[一二三四五六七八九十\d]+）)/;

export type ChunkType = 'text' | 'table';

export interface ChunkDraft {
  chunk_index: number;
  content: string;
  content_hash: string;
  chunk_type: ChunkType;
  page_start: number | null;
  page_end: number | null;
  section_path: string | null;
  extraction_method: string;
  metadata: Record<string, unknown>;
}

interface ParsedBlock {
  content: string;
  page: number | null;
  type: ChunkType;
}

/**
 * RAG 文档切片器（TS 移植自 src/backend/app/services/rag_chunker.py）。
 * 默认参数对齐 spec §9.2：chunk_size=1000、overlap=160、min_chars=80。
 */
export class RagChunker {
  constructor(
    private readonly chunkSize: number = 1000,
    private readonly overlap: number = 160,
    private readonly minChars: number = 80,
  ) {
    if (overlap >= chunkSize) throw new Error('chunk_overlap 必须小于 chunk_size');
  }

  chunk(text: string, extractionMethod = 'text'): ChunkDraft[] {
    const blocks = this.parseBlocks(text);
    const chunks: ChunkDraft[] = [];
    let section: string | null = null;
    let buffer: ParsedBlock[] = [];
    let currentLength = 0;

    const flush = (): void => {
      if (buffer.length === 0) return;
      const content = buffer.map((b) => b.content).join('\n\n').trim();
      if (content) {
        const pages = buffer.filter((b) => b.page !== null).map((b) => b.page as number);
        const chunkType: ChunkType = buffer.some((b) => b.type === 'table') ? 'table' : 'text';
        this.appendLongContent(chunks, content, pages, section, chunkType, extractionMethod);
      }
      buffer = [];
      currentLength = 0;
    };

    for (const block of blocks) {
      if (buffer.length > 0 && block.type !== buffer[buffer.length - 1].type) flush();
      if (HEADING.test(block.content.trim())) {
        flush();
        section = block.content.trim().slice(0, 500);
      }
      if (buffer.length > 0 && currentLength + block.content.length + 2 > this.chunkSize) flush();
      buffer.push(block);
      currentLength += block.content.length + 2;
    }
    flush();

    if (chunks.length > 1 && chunks[chunks.length - 1].content.length < this.minChars) {
      const tail = chunks.pop() as ChunkDraft;
      const previous = chunks[chunks.length - 1];
      const mergedPages = [previous.page_start, previous.page_end, tail.page_start, tail.page_end]
        .filter((p): p is number => p !== null);
      chunks[chunks.length - 1] = buildChunk(
        previous.chunk_index,
        `${previous.content}\n\n${tail.content}`,
        mergedPages,
        previous.section_path,
        previous.chunk_type === 'table' || tail.chunk_type === 'table' ? 'table' : 'text',
        extractionMethod,
      );
    }

    chunks.forEach((chunk, index) => { chunk.chunk_index = index; });
    return chunks;
  }

  private parseBlocks(text: string): ParsedBlock[] {
    let page: number | null = null;
    let blockType: ChunkType = 'text';
    const blocks: ParsedBlock[] = [];
    let current: string[] = [];

    const flush = (): void => {
      if (current.length > 0) {
        const content = current.join('\n').trim();
        if (content) blocks.push({ content, page, type: blockType });
        current = [];
      }
    };

    for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
      const marker = PAGE_MARKER.exec(line.trim());
      if (marker) {
        flush();
        page = Number(marker[1]);
        blockType = line.includes('表格') ? 'table' : 'text';
        continue;
      }
      if (!line.trim()) {
        flush();
        continue;
      }
      current.push(line.trimEnd());
    }
    flush();
    return blocks;
  }

  private appendLongContent(
    chunks: ChunkDraft[],
    content: string,
    pages: number[],
    section: string | null,
    chunkType: ChunkType,
    extractionMethod: string,
  ): void {
    if (content.length <= this.chunkSize) {
      chunks.push(buildChunk(chunks.length, content, pages, section, chunkType, extractionMethod));
      return;
    }
    let start = 0;
    while (start < content.length) {
      const end = Math.min(content.length, start + this.chunkSize);
      const piece = content.slice(start, end).trim();
      if (piece) chunks.push(buildChunk(chunks.length, piece, pages, section, chunkType, extractionMethod));
      if (end >= content.length) break;
      start = Math.max(start + 1, end - this.overlap);
    }
  }
}

function buildChunk(
  index: number,
  content: string,
  pages: number[],
  section: string | null,
  chunkType: ChunkType,
  extractionMethod: string,
): ChunkDraft {
  const pageStart = pages.length > 0 ? Math.min(...pages) : null;
  const pageEnd = pages.length > 0 ? Math.max(...pages) : null;
  const normalized = content.replace(/\s+/g, ' ').trim();
  const digestSource = `${pageStart}:${pageEnd}:${section ?? ''}:${chunkType}:${normalized}`;
  const contentHash = createHash('sha256').update(digestSource, 'utf8').digest('hex');
  return {
    chunk_index: index,
    content,
    content_hash: contentHash,
    chunk_type: chunkType,
    page_start: pageStart,
    page_end: pageEnd,
    section_path: section,
    extraction_method: extractionMethod,
    metadata: { char_count: content.length },
  };
}
