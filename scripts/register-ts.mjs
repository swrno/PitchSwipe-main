// Lets `node --test` import the app's TypeScript (type stripping) with the "@/" alias and
// extensionless relative imports, with no new dependency. Test-only.
import { register } from "node:module";

register("./ts-loader.mjs", import.meta.url);
