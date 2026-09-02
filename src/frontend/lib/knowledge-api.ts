import { authFetch, authFetchSSE } from '@/lib/auth-fetch';
import type {
  KnowledgeBaseDetail,
  KnowledgeBaseSummary,
  KnowledgeSourceOption,
  RagIndexJob,
  RagIndexJobItem,
  RagQueryResult,
} from '@/types/knowledge';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
  code?: string;
}

async function knowledgeFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/knowledge/${path.replace(/^\//, '')}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.detail || `请求失败：HTTP ${response.status}`);
  }
  return (payload as ApiEnvelope<T>).data;
}

export async function listKnowledgeBases(search = ''): Promise<KnowledgeBaseSummary[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const data = await knowledgeFetch<{ items: KnowledgeBaseSummary[] }>(`knowledge-bases${query}`);
  return data.items;
}

export async function createKnowledgeBase(name: string, description = ''): Promise<KnowledgeBaseSummary> {
  return knowledgeFetch('knowledge-bases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBaseDetail> {
  return knowledgeFetch(`knowledge-bases/${id}`);
}

export async function updateKnowledgeBase(
  id: string,
  payload: { name?: string; description?: string }
): Promise<KnowledgeBaseSummary> {
  return knowledgeFetch(`knowledge-bases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  await knowledgeFetch(`knowledge-bases/${id}`, { method: 'DELETE' });
}

export async function addKnowledgeFiles(id: string, fileIds: string[]): Promise<void> {
  await knowledgeFetch(`knowledge-bases/${id}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_ids: fileIds }),
  });
}

export async function removeKnowledgeFile(id: string, fileId: string): Promise<void> {
  await knowledgeFetch(`knowledge-bases/${id}/files/${fileId}`, { method: 'DELETE' });
}

export async function listAvailableSources(id: string): Promise<KnowledgeSourceOption[]> {
  const data = await knowledgeFetch<{ items: KnowledgeSourceOption[] }>(`knowledge-bases/${id}/available-sources`);
  return data.items;
}

export async function addKnowledgeSources(id: string, sources: KnowledgeSourceOption[]): Promise<void> {
  await knowledgeFetch(`knowledge-bases/${id}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources: sources.map(({ source_type, source_ref_id, source_variant }) => ({ source_type, source_ref_id, source_variant })) }),
  });
}

export async function uploadKnowledgeSource(id: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  await knowledgeFetch(`knowledge-bases/${id}/source-uploads`, { method: 'POST', body: form });
}

export async function createIndexJob(
  id: string,
  fileIds: string[],
  force = false
): Promise<{ job_id: string; status: string }> {
  return knowledgeFetch(`knowledge-bases/${id}/index-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_ids: fileIds, force }),
  });
}

export async function getIndexJob(
  id: string,
  jobId: string
): Promise<{ job: RagIndexJob; items: RagIndexJobItem[]; files: KnowledgeBaseDetail['files'] }> {
  return knowledgeFetch(`knowledge-bases/${id}/index-jobs/${jobId}`);
}

export async function getActiveIndexJob(
  id: string
): Promise<{ job: RagIndexJob; items: RagIndexJobItem[] } | null> {
  return knowledgeFetch(`knowledge-bases/${id}/index-jobs/active`);
}

export async function queryKnowledgeBase(
  id: string,
  question: string,
  fileIds?: string[]
): Promise<RagQueryResult> {
  return knowledgeFetch(`knowledge-bases/${id}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, file_ids: fileIds?.length ? fileIds : undefined }),
  });
}

export async function streamKnowledgeQuery(
  id: string,
  question: string,
  fileIds?: string[],
  signal?: AbortSignal
): Promise<Response> {
  const response = await authFetchSSE(`/api/knowledge/knowledge-bases/${id}/query/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ question, file_ids: fileIds?.length ? fileIds : undefined }),
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || payload.detail || `问答失败：HTTP ${response.status}`);
  }
  return response;
}
