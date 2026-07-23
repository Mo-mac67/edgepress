import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Library modules import "server-only" (a Next.js guard that throws
      // outside React Server context) — stub it so units run in plain node.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
      "@edgepress/core": fileURLToPath(new URL("../../packages/core/src", import.meta.url)),
      "@edgepress/ai": fileURLToPath(new URL("../../packages/ai/src", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
