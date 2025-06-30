import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const files = [
  path.join(__dirname, "../dist/bin/deployer/index.js"),
  path.join(__dirname, "../dist/bin/entity-generator/index.js"),
  path.join(__dirname, "../dist/bin/query-client-generator/index.js"),
  path.join(__dirname, "../dist/bin/verifier/index.js"),
];

const shebang = "#!/usr/bin/env node\n";

for (const file of files) {
  if (!existsSync(file)) continue;

  let content = readFileSync(file, "utf8");

  content = content.replace(/^#!.*\n/, "");
  writeFileSync(file, shebang + content, { mode: 0o755 });
}
