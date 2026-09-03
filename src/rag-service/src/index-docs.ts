import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RagConfig } from './config.js';
import { indexDocument } from './index-pipeline.js';
import { ZillizVectorStore } from './vector/zilliz-vector-store.js';

export interface IndexSummary {
  files: string[];
  chunkCount: number;
}

/** 由文件名派生稳定 fileId（纯函数，导出供单测；保留 Unicode 中文，仅清洗空白与路径分隔符） */
export function sanitizeFileId(fileName: string): string {
  const base = fileName.replace(/\.md$/i, '');
  const sanitized = base.replace(/[\s/\\:]+/g, '_').trim();
  return sanitized || 'unnamed';
}

/** 预索引指定目录下的 .md 文档：逐文件分块 → 嵌入 → upsert */
export async function indexDataDirectory(
  dataDir: string,
  config: RagConfig,
  vectorStore: ZillizVectorStore,
  userId: string,
): Promise<IndexSummary> {
  const entries = await readdir(dataDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name)
    .sort();

  let chunkCount = 0;
  for (const fileName of files) {
    const content = await readFile(join(dataDir, fileName), 'utf8');
    chunkCount += await indexDocument(
      { fileId: sanitizeFileId(fileName), fileName, content, userId },
      config,
      vectorStore,
    );
  }
  return { files, chunkCount };
}
