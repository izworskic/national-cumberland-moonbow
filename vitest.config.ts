import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
  },
});
