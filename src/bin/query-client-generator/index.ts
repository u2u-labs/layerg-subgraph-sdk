#!/usr/bin/env ts-node

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import {
  parse,
  ObjectTypeDefinitionNode,
  NamedTypeNode,
  TypeNode,
} from "graphql";

export const generate = () => {
  const args = process.argv.slice(2);
  const schemaPath = args[args.indexOf("--schema") + 1];
  const outDir = args[args.indexOf("--outDir") + 1];

  if (!schemaPath || !outDir) {
    console.error(
      "Usage: ts-node generate-client.ts --schema <path> --outDir <directory>"
    );
    process.exit(1);
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
    if (typeNode.kind === "NamedType") return typeNode.name.value;
    if ("type" in typeNode) return unwrapType(typeNode.type);
    return "any";
  }

  const rawSchema = readFileSync(schemaPath, "utf-8");
  const ast = parse(rawSchema);

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const typesDir = join(outDir, "types");
  const clientsDir = join(outDir, "clients");
  mkdirSync(typesDir, { recursive: true });
  mkdirSync(clientsDir, { recursive: true });

  const entities = ast.definitions.filter(
    (d): d is ObjectTypeDefinitionNode =>
      d.kind === "ObjectTypeDefinition"
  );

  const clientImports: string[] = [];
  const clientExports: string[] = [];

  for (const entity of entities) {
    const name = entity.name.value;
    const singular = name.toLowerCase();
    const plural = singular + "s";

    const fields = (entity.fields || []).map((f) => {
      const typeName = unwrapType(f.type);
      const tsType = scalarMap[typeName] || "any";
      return { name: f.name.value, tsType };
    });

    const gqlFields = fields.map((f) => f.name).join("\n          ");

    const typeDef = `export type ${name} = {
${fields.map((f) => `  ${f.name}: ${f.tsType};`).join("\n")}
};`;
    writeFileSync(join(typesDir, `${name}.ts`), typeDef);

    const clientCode = `
import { request } from "graphql-request";
import { ${name} } from "../types/${name}";

export function ${plural}(subgraphUrl: string) {
  return {
    async findById(id: string): Promise<${name} | null> {
      type Response = { ${singular}: ${name} };
      const res: Response = await request(subgraphUrl, \`
        query ($id: ID!) {
          ${singular}(id: $id) {
            ${gqlFields}
          }
        }
      \`, { id });
      return res.${singular};
    },

    async findOne(where: Partial<${name}>): Promise<${name} | null> {
      type Response = { ${plural}: ${name}[] };
      const res: Response = await request(subgraphUrl, \`
        query ($where: ${name}_filter, $first: Int) {
          ${plural}(where: $where, first: 1) {
            ${gqlFields}
          }
        }
      \`, { where, first: 1 });
      return res.${plural}[0] || null;
    },

    async findMany(options: {
      where?: Partial<${name}>;
      first?: number;
      skip?: number;
      orderBy?: keyof ${name};
      orderDirection?: "asc" | "desc";
    } = {}): Promise<${name}[]> {
      type Response = { ${plural}: ${name}[] };
      const res: Response = await request(subgraphUrl, \`
        query ($where: ${name}_filter, $first: Int, $skip: Int, $orderBy: String, $orderDirection: String) {
          ${plural}(where: $where, first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection) {
            ${gqlFields}
          }
        }
      \`, options);
      return res.${plural};
    },

    subscribe({ where, onData }: { where?: Partial<${name}>; onData: (data: ${name}) => void }): void {
      const params = new URLSearchParams();
      params.set("entity", "${name}");
      if (where) params.set("where", encodeURIComponent(JSON.stringify(where)));
      const sseUrl = subgraphUrl.replace("/graphql", "/sse") + "/?" + params.toString();
      const es = new EventSource(sseUrl);

      es.onmessage = (event) => {
        try {
          const data: ${name} = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      };

      es.onerror = (err) => {
        console.error("SSE connection error", err);
        es.close();
      };
    }
  };
}`;

    writeFileSync(join(clientsDir, `${plural}.ts`), clientCode);
    clientImports.push(`import { ${plural} } from "./clients/${plural}";`);
    clientExports.push(`    ${plural}: ${plural}(subgraphUrl),`);
  }

  const rootClient = `
${clientImports.join("\n")}

export function createSubgraphClient(subgraphUrl: string) {
  return {
${clientExports.join("\n")}
  };
}`;

  writeFileSync(join(outDir, "client.ts"), rootClient);
  console.log("✅ Subgraph client generated.");
};

generate();
