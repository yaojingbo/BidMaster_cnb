/**
 * 数据管理模块 API 客户端。
 * 对应后端 /api/data/* 路由。
 */

// --- 类型定义 ---

export interface DataStats {
  files: number;
  simulate_tasks: number;
  opening_results: number;
  extract_results: number;
}

export interface FileRecord {
  id: string;
  original_name: string;
  path: string;
  size: number;
  type: string;
  created_at: string | null;
}

export interface SimulateTaskRecord {
  task_id: string;
  name?: string;
  status: string;
  current_step: number;
  params: Record<string, unknown>;
  step_results: Record<string, unknown>;
  file_ids: string[];
  files: { id: string; original_name: string; type: string }[];
  created_at: string | null;
}

export interface OpeningResultRecord {
  id: string;
  name?: string;
  file_id: string | null;
  bidder_count: number;
  bid_ranking: { rank: number; name: string; price: number }[];
  bid_stats: {
    mean: number;
    std?: number;
    std_dev?: number;
    cv: number;
    cv_level?: string;
    min: number;
    max: number;
    range: number;
    count?: number;
  };
  meta?: Record<string, unknown>;
  ai_analysis?: string;
  status?: string;
  created_at: string | null;
}

export interface ExtractResultRecord {
  id: string;
  name?: string;
  file_id: string | null;
  template_type: string;
  mode: string;
  content: string;
  elements?: { name?: string; content?: string }[];
  status?: string;
  created_at: string | null;
}

export interface ProjectSource {
  id: string;
  user_id?: string;
  name: string;
  url: string;
  category: string;
  region: string;
  tags: string[];
  note: string;
  is_favorite: boolean;
  status: string;
  last_visited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectSourcePayload {
  name: string;
  url: string;
  category?: string;
  region?: string;
  tags?: string[];
  note?: string;
  is_favorite?: boolean;
  status?: string;
}

export interface ProjectSourceListParams {
  page?: number;
  page_size?: number;
  q?: string;
  category?: string;
  region?: string;
  is_favorite?: boolean;
  status?: string;
  sort?: 'default' | 'last_visited' | 'updated' | 'created' | 'name' | 'category' | 'region';
}

interface PaginatedResult<T> {
  total: number;
  page: number;
  page_size: number;
}

// --- 工具函数 ---

import { authFetch } from "@/lib/auth-fetch";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`/api/data${path}`, options);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- 统计概览 ---

export async function getStats(): Promise<DataStats> {
  return apiFetch<DataStats>("/stats");
}

// --- 项目查询 ---

export async function listProjectSources(
  params: ProjectSourceListParams = {},
  options?: RequestInit
): Promise<PaginatedResult<ProjectSource> & { items: ProjectSource[] }> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));
  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);
  if (params.region) query.set("region", params.region);
  if (params.is_favorite !== undefined) query.set("is_favorite", String(params.is_favorite));
  if (params.status) query.set("status", params.status);
  if (params.sort) query.set("sort", params.sort);
  const qs = query.toString();
  return apiFetch(`/project-sources${qs ? `?${qs}` : ""}`, options);
}

export async function createProjectSource(payload: ProjectSourcePayload): Promise<ProjectSource> {
  return apiFetch("/project-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getProjectSource(sourceId: string): Promise<ProjectSource> {
  return apiFetch(`/project-sources/${sourceId}`);
}

export async function updateProjectSource(
  sourceId: string,
  payload: Partial<ProjectSourcePayload>
): Promise<ProjectSource> {
  return apiFetch(`/project-sources/${sourceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteProjectSource(sourceId: string): Promise<{ success: boolean }> {
  return apiFetch(`/project-sources/${sourceId}`, { method: "DELETE" });
}

export async function visitProjectSource(sourceId: string): Promise<ProjectSource> {
  return apiFetch(`/project-sources/${sourceId}/visit`, { method: "POST" });
}

// --- 文件管理 ---

export async function listFiles(params: {
  page?: number;
  page_size?: number;
  file_type?: string;
}): Promise<PaginatedResult<FileRecord> & { files: FileRecord[] }> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));
  if (params.file_type) query.set("file_type", params.file_type);
  return apiFetch(`/files?${query.toString()}`);
}

export async function getFile(fileId: string): Promise<{ file: FileRecord }> {
  return apiFetch(`/files/${fileId}`);
}

export async function deleteFile(fileId: string): Promise<{ success: boolean }> {
  return apiFetch(`/files/${fileId}`, { method: "DELETE" });
}

export async function downloadFile(fileId: string): Promise<Blob> {
  const res = await authFetch(`/api/data/files/${fileId}/download`);
  if (!res.ok) throw new Error(`下载失败: HTTP ${res.status}`);
  return res.blob();
}

export async function exportMarkdownPdf(payload: {
  title?: string;
  source_type?: string;
  markdown: string;
  metadata?: Record<string, unknown>;
}): Promise<Blob> {
  const res = await authFetch(`/api/data/exports/markdown/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `导出 PDF 失败: HTTP ${res.status}`);
  }
  return res.blob();
}

export async function exportExtractPdf(resultId: string): Promise<Blob> {
  const res = await authFetch(`/api/data/extracts/${resultId}/export-pdf`);
  if (!res.ok) throw new Error(`导出 PDF 失败: HTTP ${res.status}`);
  return res.blob();
}

export async function exportSimulatePdf(taskId: string): Promise<Blob> {
  const res = await authFetch(`/api/data/simulates/${taskId}/export-pdf`);
  if (!res.ok) throw new Error(`导出 PDF 失败: HTTP ${res.status}`);
  return res.blob();
}

export async function exportOpeningPdf(taskId: string): Promise<Blob> {
  const res = await authFetch(`/api/data/openings/${taskId}/export-pdf`);
  if (!res.ok) throw new Error(`导出 PDF 失败: HTTP ${res.status}`);
  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function previewFileUrl(fileId: string): string {
  return `/api/data/files/${fileId}/preview`;
}

export async function batchDownloadFiles(fileIds: string[]): Promise<Blob> {
  const res = await authFetch(`/api/data/files/batch-download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_ids: fileIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `批量下载失败: HTTP ${res.status}`);
  }
  return res.blob();
}

// --- 模拟任务 ---

export async function listSimulates(params: {
  page?: number;
  page_size?: number;
  status?: string;
}): Promise<PaginatedResult<SimulateTaskRecord> & { tasks: SimulateTaskRecord[] }> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));
  if (params.status) query.set("status", params.status);
  return apiFetch(`/simulates?${query.toString()}`);
}

export async function getSimulate(taskId: string): Promise<{ task: SimulateTaskRecord }> {
  return apiFetch(`/simulates/${taskId}`);
}

export async function deleteSimulate(taskId: string): Promise<{ success: boolean }> {
  return apiFetch(`/simulates/${taskId}`, { method: "DELETE" });
}

// --- 开标结果 ---

export async function listOpenings(params: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedResult<OpeningResultRecord> & { results: OpeningResultRecord[] }> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));
  return apiFetch(`/openings?${query.toString()}`);
}

export async function getOpening(taskId: string): Promise<OpeningResultRecord> {
  return apiFetch(`/openings/${taskId}`);
}

export async function deleteOpening(taskId: string): Promise<{ success: boolean }> {
  return apiFetch(`/openings/${taskId}`, { method: "DELETE" });
}

// --- 提取结果 ---

export async function listExtracts(params: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedResult<ExtractResultRecord> & { results: ExtractResultRecord[] }> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));
  return apiFetch(`/extracts?${query.toString()}`);
}

export async function getExtract(resultId: string): Promise<ExtractResultRecord> {
  return apiFetch(`/extracts/${resultId}`);
}

export async function exportExtractJson(resultId: string): Promise<Blob> {
  const res = await authFetch(`/api/data/extracts/${resultId}/export-json`);
  if (!res.ok) throw new Error(`导出 JSON 失败: HTTP ${res.status}`);
  return res.blob();
}

export async function deleteExtract(resultId: string): Promise<{ success: boolean }> {
  return apiFetch(`/extracts/${resultId}`, { method: "DELETE" });
}