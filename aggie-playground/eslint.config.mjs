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
    // Standalone Context.dev prototype. Not part of the app build: it imports
    // the `context.dev` npm package and `tsx`, which are deliberately NOT
    // dependencies of this app (see scripts/README.md). Type-checking and
    // linting it here fails the app's build for no reason.
    "scripts/**",
  ]),
]);

export default eslintConfig;
