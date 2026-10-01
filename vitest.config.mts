import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: { projects: [
    { extends: true, test: { name: "backend", environment: "edge-runtime", include: ["convex/**/*.test.ts", "src/lib/**/*.test.ts"] } },
    { extends: true, test: { name: "interface", environment: "jsdom", include: ["src/components/**/*.test.tsx"] } },
  ] },
});
