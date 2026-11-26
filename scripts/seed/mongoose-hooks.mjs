// Test-only resolve hook: send `mongoose` imports from src/ to the ESM shim.
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const shim = pathToFileURL(path.join(here, "mongoose-esm.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "mongoose" && context.parentURL && !context.parentURL.startsWith(shim) && context.parentURL.endsWith(".ts")) {
    return { url: shim, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
