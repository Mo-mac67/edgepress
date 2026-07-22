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
    // Build artifacts of the Cloudflare/OpenNext pipeline:
    ".open-next/**",
    ".wrangler/**",
  ]),
  {
    rules: {
      // The React-Compiler-era strict rules flag long-standing, working
      // patterns across the admin panel (setState inside data-loading effects,
      // small helper components defined inline, a ref-based dirty check, and
      // the deliberate per-request randomness of the A/B variant picker).
      // Tracked as tech debt — warn, don't fail the build. New code should
      // still avoid these patterns.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
