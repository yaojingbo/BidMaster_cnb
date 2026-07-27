/**
 * API Key 管理客户端。
 * 对应后端 /api/api-keys/* 路由，使用 authFetch 自动鉴权。
 */
import { authFetch } from "@/lib/auth-fetch";

export interface ApiKeyItem {
  provider: string;
  masked_key?: string;
}

export async function getApiKeys(): Promise<ApiKeyItem[]> {
  const res = await authFetch(`/api/api-keys`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `获取 API Keys 失败: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data?.keys ?? [];
}

export async function saveApiKey(provider: string, apiKey: string): Promise<void> {
  const res = await authFetch(`/api/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, api_key: apiKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `保存 API Key 失败: HTTP ${res.status}`);
  }
}

export async function deleteApiKey(provider: string): Promise<void> {
  const res = await authFetch(`/api/api-keys/${provider}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `删除 API Key 失败: HTTP ${res.status}`);
  }
}
