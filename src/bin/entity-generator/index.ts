import type { ObjectTypeDefinitionNode, DocumentNode, TypeNode } from "graphql";
import { parse } from "graphql";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const generate = () => {
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

  function unwrapType(typeNode: TypeNode): string {
    if (typeNode.kind === "NamedType") {
      const typeName = typeNode.name.value;
      return scalarMap[typeName] || "foreignKey";
    }
    if (typeNode.type) return unwrapType(typeNode.type);
    return "any";
  }

  const entityDefs = ast.definitions.filter(
    (d): d is ObjectTypeDefinitionNode => {
      return d.kind === "ObjectTypeDefinition" && Array.isArray(d.directives);
    }
  );

  for (const def of entityDefs) {
    const name = def.name.value;
    const fields = def.fields || [];

    const props = fields.map((f) => {
      const unwrappedType = unwrapType(f.type);
      if (unwrappedType === "foreignKey") {
        // Treat as FK to another entity type
        return `  ${f.name.value}Id!: string; // FK to ${unwrapType(f.type)}`;
      }
      const tsType = scalarMap[unwrapType(f.type)] || "any";
      return `  ${f.name.value}!: ${tsType};`;
    });

    const source = `// Auto-generated entity class for ${name}
import { set, get, getBy, count, remove } from "layerg-graph-14";

export class ${name} {
  static table = "${name.toLowerCase()}s";

  ${props.join("\n")}

  constructor(init?: Partial<${name}>) {
    Object.assign(this, init);
  }

  async save(chainId: number): Promise<void> {
    const data: Record<string, unknown> = {};
    Object.getOwnPropertyNames(this).forEach((key) => {
      // @ts-ignore
      data[key] = this[key];
    });
    await set(${name}.table + '_' + chainId, data);
  }

  static async delete(id: string, chainId: number): Promise<void> {
    await remove(${name}.table + '_' + chainId, id);
  }

  static async get(id: string, chainId: number): Promise<${name} | null> {
    const row = await get<${name}>(${name}.table + '_' + chainId, id);
    return row ? new ${name}(row) : null;
  }

  static async getBy(field: keyof ${name}, value: any, chainId: number): Promise<${name} | null> {
    const row = await getBy<${name}>(${name}.table + '_' + chainId, field as string, value);
    return row ? new ${name}(row) : null;
  }

  static async count(where: Partial<${name}> = {}, chainId: number): Promise<number> {
    return count<${name}>(${name}.table + '_' + chainId, where);
  }
}
`;

    const filepath = join(outputDir, `${name}.ts`);
    writeFileSync(filepath, source);
  }
};

generate();
