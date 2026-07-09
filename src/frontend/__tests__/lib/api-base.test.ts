import { describe, expect, it, vi } from "vitest";

async function loadApiBase(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  const originalBackend = process.env.NEXT_PUBLIC_BACKEND_API_URL;
  const originalLegacy = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_BACKEND_API_URL = env.NEXT_PUBLIC_BACKEND_API_URL;
  process.env.NEXT_PUBLIC_API_URL = env.NEXT_PUBLIC_API_URL;
  const mod = await import("@/lib/api-base");
  process.env.NEXT_PUBLIC_BACKEND_API_URL = originalBackend;
  process.env.NEXT_PUBLIC_API_URL = originalLegacy;
  return mod;
}

describe("api-base", () => {
  it("直连后端时项目查询接口使用后端地址", async () => {
    const { resolveApiUrl, shouldUseDirectBackend } = await loadApiBase({
      NEXT_PUBLIC_BACKEND_API_URL: "https://backend.example.com/",
    });

    expect(shouldUseDirectBackend("/api/data/project-sources?page=1")).toBe(true);
    expect(resolveApiUrl("/api/data/project-sources?page=1")).toBe(
      "https://backend.example.com/api/data/project-sources?page=1"
    );
  });

  it("未配置直连后端时项目查询接口保持同源代理", async () => {
    const { resolveApiUrl, shouldUseDirectBackend } = await loadApiBase({
      NEXT_PUBLIC_BACKEND_API_URL: "",
      NEXT_PUBLIC_API_URL: "",
    });

    expect(shouldUseDirectBackend("/api/data/project-sources?page=1")).toBe(false);
    expect(resolveApiUrl("/api/data/project-sources?page=1")).toBe("/api/data/project-sources?page=1");
  });
});
