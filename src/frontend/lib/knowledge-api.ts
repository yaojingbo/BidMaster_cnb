import { authFetch } from '@/lib/auth-fetch';

export type KnowledgeStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface KnowledgeDocument {
  id: string;
  file_id: string;
  name: string;
  status: KnowledgeStatus;
  chunk_count: number;
  embedding_model: string;
  content_hash?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeHit {
  id: number;
  document_id: string;
  file_id: string;
  name: string;
  chunk_index: number;
  content: string;
  score: number;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/knowledge${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
  return payload.data as T;
}

export function listKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  return request('/documents');
}

export function addKnowledgeDocument(fileId: string): Promise<KnowledgeDocument> {
  return request('/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  });
}

export function reindexKnowledgeDocument(documentId: string): Promise<KnowledgeDocument> {
  return request(`/documents/${documentId}/reindex`, { method: 'POST' });
}

export async function deleteKnowledgeDocument(documentId: string): Promise<void> {
  await request(`/documents/${documentId}`, { method: 'DELETE' });
}

export function searchKnowledge(query: string): Promise<KnowledgeHit[]> {
  return request('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
}
