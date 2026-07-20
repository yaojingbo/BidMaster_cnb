import "server-only";

const DEVELOPMENT_BACKEND_URL = "http://127.0.0.1:8000";

export function getBackendUrl(): string {
  const configuredUrl = process.env.BACKEND_URL?.trim();

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("生产环境必须配置 BACKEND_URL");
    }
    return DEVELOPMENT_BACKEND_URL;
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("BACKEND_URL 必须是有效的 HTTP 或 HTTPS 地址");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BACKEND_URL 仅支持 HTTP 或 HTTPS 协议");
  }

  return configuredUrl.replace(/\/+$/, "");
}
