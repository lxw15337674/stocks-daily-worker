import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const appDir = path.join(rootDir, "apps", "web");

const target = process.argv[2];

if (target !== "local" && target !== "remote") {
  console.error('Usage: node scripts/select-web-config.mjs <local|remote>');
  process.exit(1);
}

await copyFile(path.join(appDir, `wrangler.${target}.jsonc`), path.join(appDir, "wrangler.jsonc"));
await copyFile(path.join(appDir, "lib", `runtime-config.${target}.ts`), path.join(appDir, "lib", "runtime-config.ts"));

console.log(`[select-web-config] activated ${target} web config`);
