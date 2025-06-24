import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const files = [
  path.join(__dirname, "../dist/bin/deployer/index.js"),
  path.join(__dirname, "../dist/bin/generator/index.js"),
  path.join(__dirname, "../dist/bin/verifier/index.js"),
];

const shebang = "#!/usr/bin/env node\n";

for (const file of files) {
  if (!existsSync(file)) continue;

  let content = readFileSync(file, "utf8");

  content = content.replace(/^#!.*\n/, "");
  writeFileSync(file, shebang + content, { mode: 0o755 });
}
