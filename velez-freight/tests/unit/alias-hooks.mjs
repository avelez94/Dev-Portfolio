import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const src = new URL("../../src/", import.meta.url);
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = fileURLToPath(new URL(specifier.slice(2), src));
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, context);
    }
  }
  return next(specifier, context);
}
