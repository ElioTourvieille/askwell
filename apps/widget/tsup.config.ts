import { defineConfig } from "tsup";

export default defineConfig({
  entry: { widget: "src/index.ts" },
  format: ["iife"],
  platform: "browser",
  target: "es2019",
  minify: true,
  clean: false,
  // Servi par l'application (apps/web/public/widget.js, ignoré par git).
  outDir: "../web/public",
  outExtension: () => ({ js: ".js" }),
});
