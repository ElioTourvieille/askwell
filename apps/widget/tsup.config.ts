import { defineConfig } from "tsup";

export default defineConfig({
  entry: { widget: "src/index.ts" },
  format: ["iife"],
  platform: "browser",
  target: "es2019",
  minify: true,
  clean: true,
  outDir: "dist",
  outExtension: () => ({ js: ".js" }),
});
