// Node resolve hook: maps "@/x" to src/x and adds .ts, so the pure TS modules run under `node --test`
// with the built-in type stripping (no new dependency).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function withExt(file) {
  for (const candidate of [`${file}.ts`, path.join(file, "index.ts"), file]) {
    if (path.extname(candidate) === ".ts" && existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const file = withExt(path.join(srcRoot, specifier.slice(2)));
    if (file) return next(pathToFileURL(file).href, context);
  } else if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = withExt(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (file) return next(pathToFileURL(file).href, context);
  }
  return next(specifier, context);
}
