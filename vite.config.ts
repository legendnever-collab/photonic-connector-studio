import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig({
  base: "./",
  server: { allowedHosts: ["terminal.local"] },
  plugins: [viteSingleFile()],
  build: { target: "es2022" },
  test: { include: ["tests/**/*.test.ts"] },
});
