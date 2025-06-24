import { parse, ObjectTypeDefinitionNode, DocumentNode } from "graphql";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const schemaPath = args[args.indexOf("--schema") + 1];
const outputDir = args[args.indexOf("--out") + 1];

if (!schemaPath || !outputDir) {
  console.error("Usage: --schema <path> --out <output directory>");
  process.exit(1);
}

const rawSchema = readFileSync(schemaPath, "utf-8");
const ast: DocumentNode = parse(rawSchema);

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const scalarMap: Record<string, string> = {
  ID: "string",
  String: "string",
  Int: "number",
  Float: "number",
  Boolean: "boolean",
  BigInt: "string",
  Bytes: "string",
};

function unwrapType(typeNode: any): string {
  if (typeNode.kind === "NamedType") return typeNode.name.value;
  if (typeNode.type) return unwrapType(typeNode.type);
  return "any";
}

const entityDefs = ast.definitions.filter(
  (d): d is ObjectTypeDefinitionNode => {
    return (
      d.kind === "ObjectTypeDefinition" &&
      Array.isArray(d.directives) &&
      d.directives.some((dir) => dir.name?.value === "entity")
    );
  }
);

for (const def of entityDefs) {
  const name = def.name.value;
  const fields = def.fields || [];

  const props = fields.map((f) => {
    const tsType = scalarMap[unwrapType(f.type)] || "any";
    return `  ${f.name.value}!: ${tsType};`;
  });

  const source = `// Auto-generated entity class for ${name}
import { set, get, getBy, count } from "../runtime/db";
import { onInsert } from "../runtime/listener";

export class ${name} {
  static table = "${name}";

${props.join("\n")}

  constructor(init?: Partial<${name}>) {
    Object.assign(this, init);
  }

  async save(): Promise<void> {
    await set(${name}.table, this);
  }

  static async get(id: string): Promise<${name} | null> {
    const row = await get<${name}>(${name}.table, id);
    return row ? new ${name}(row) : null;
  }

  static async getBy(field: keyof ${name}, value: any): Promise<${name} | null> {
    const row = await getBy<${name}>(${name}.table, field as string, value);
    return row ? new ${name}(row) : null;
  }

  static async count(where: Partial<${name}> = {}): Promise<number> {
    return count<${name}>(${name}.table, where);
  }

  static onNewRecord(callback: (data: ${name}) => void) {
    onInsert(${name}.table, (row) => callback(new ${name}(row)));
  }
}
`;

  const filepath = join(outputDir, `${name}.ts`);
  writeFileSync(filepath, source);
}
