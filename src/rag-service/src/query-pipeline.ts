import { noopObserve } from '@mastra/core/tools';
import type { RagConfig } from './config.js';
import { synthesizeAnswer } from './llm.js';
import { createSemanticRecallTool } from './rag-retrieval.js';
import { ZillizVectorStore } from './vector/zilliz-vector-store.js';

export interface QuerySource {
  id: string;
  score: number;
  text: string;
}

export interface QueryAnswer {
  answer: string;
  sources: QuerySource[];
}

/** createVectorQueryTool 输出里的单个来源（防御性读取，无 any） */
interface RawSource {
  id?: unknown;
  score?: unknown;
  metadata?: unknown;
  document?: unknown;
}

/**
 * 查询 pipeline：语义召回（createVectorQueryTool.execute）→ LLM 整合。
 * 正文存在检索结果 metadata.text（本 MVP 把 chunk 正文存进 Milvus）。
 */
export async function answerQuery(
  question: string,
  config: RagConfig,
  vectorStore: ZillizVectorStore,
  topK = 8,
): Promise<QueryAnswer> {
  const tool = createSemanticRecallTool(config, vectorStore);
  const raw = await tool.execute({ queryText: question, topK }, { observe: noopObserve });

  if (!raw || typeof raw !== 'object' || !('sources' in raw)) throw new Error('语义召回失败');
  const rawSources = (raw as { sources?: RawSource[] }).sources ?? [];

  const sources: QuerySource[] = rawSources
    .map((source) => {
      const metadata = source.metadata as Record<string, unknown> | undefined;
      return {
        id: String(source.id ?? ''),
        score: Number(source.score ?? 0),
        text: String(metadata?.text ?? source.document ?? ''),
      };
    })
    .filter((source) => source.text.length > 0);

  const answer = await synthesizeAnswer(sources.map((source) => source.text), question, config);
  return { answer, sources };
}
