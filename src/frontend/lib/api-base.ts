const LEGACY_API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const DIRECT_BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_API_URL || "").replace(/\/$/, "");

const DIRECT_API_PREFIXES = [
  "/api/files/upload",
  "/api/files/",
  "/api/extract/",
  "/api/simulate/",
  "/api/statistics/",
  "/api/data/files/batch-download",
  "/api/data/extracts/",
  "/api/data/project-sources",
];

export function shouldUseDirectBackend(url: string): boolean {
  if (!DIRECT_BACKEND_BASE || !url.startsWith("/")) return false;
  return DIRECT_API_PREFIXES.some(prefix => url.startsWith(prefix));
}

export function resolveApiUrl(url: string, options: { direct?: boolean } = {}): string {
  if (!url.startsWith("/")) return url;
  if (options.direct || shouldUseDirectBackend(url)) return `${DIRECT_BACKEND_BASE}${url}`;
  return `${LEGACY_API_BASE}${url}`;
}

export function getDirectBackendBase(): string {
  return DIRECT_BACKEND_BASE;
}
