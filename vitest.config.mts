import { defineConfig } from "vitest/config";
import { resolve } from "path";

const root = import.meta.dirname;

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: { "@": resolve(root, "src") },
  },
});
