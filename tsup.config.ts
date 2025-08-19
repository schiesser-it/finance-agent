import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "tsup";

function readNvmrcVersion(): string | undefined {
  try {
    const nvmrcPath = path.resolve(__dirname, ".nvmrc");
    const content = fs.readFileSync(nvmrcPath, "utf8").trim();
    // Accept formats like "18", "v18", "18.20.3"
    const normalized = content.startsWith("v") ? content.slice(1) : content;
    const major = normalized.split(".")[0];
    if (major && /^\d+$/.test(major)) {
      return `node${major}`;
    }
  } catch {
    // ignore
  }
  return undefined;
}

const nodeTarget = readNvmrcVersion() ?? "node20";

export default defineConfig({
  entry: ["src/index.tsx", "src/mcp-server/server.ts"],
  format: ["esm"],
  minify: true,
  platform: "node",
  target: nodeTarget,
  outDir: "dist",
  clean: true,
  splitting: false,
});
