import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Tài nguyên MediaPipe tự host: JS keo dán do Emscripten sinh ra, không
    // phải code của dự án nên không lint (xem scripts/setup-mediapipe.mjs).
    "public/mediapipe/**",
  ]),
]);

export default eslintConfig;
