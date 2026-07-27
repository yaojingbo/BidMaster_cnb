import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/frontend/__tests__/setup.ts"],
    include: ["src/frontend/__tests__/**/*.test.{ts,tsx}"],
    exclude: [
      "e2e/**",
      "node_modules/**",
      "resource/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/frontend"),
      "@/db": path.resolve(__dirname, "./src/db"),
      "@/lib": path.resolve(__dirname, "./src/lib"),
    },
  },
});