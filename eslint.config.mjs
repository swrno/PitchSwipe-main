import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // mobile/android and mobile/ios hold generated native projects and their local build output (Capacitor), not app source.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "mobile/android/**", "mobile/ios/**"]),
  // Client/server boundary: a feature's ui/ (and shared ui/shell) must never import any feature's server/ code.
  {
    files: ["src/features/*/ui/**/*.{ts,tsx}", "src/shared/ui/**/*.{ts,tsx}", "src/shared/shell/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/server", "@/features/*/server/*", "**/server", "**/server/*"],
              message: "ui/ code runs in the browser: it must not import server/ modules. Call an API route instead.",
            },
          ],
        },
      ],
    },
  },
]);
