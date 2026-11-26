import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // mobile/android and mobile/ios hold generated native projects and their local build output (Capacitor), not app source.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "mobile/android/**", "mobile/ios/**"]),
]);
