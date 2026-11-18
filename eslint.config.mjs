import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/next-env.d.ts", ".agents/**", ".claude/**", ".jsmhq/**", "apps/web/public/widget.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@next/next/no-html-link-for-pages": "off",
    },
  },
);
