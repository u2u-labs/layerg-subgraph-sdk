import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import {
  FieldDefinitionNode,
  ObjectTypeDefinitionNode,
  parse,
  TypeNode,
} from "graphql";
import { join } from "path";

const scalarMap: Record<string, string> = {
  ID: "string",
  String: "string",
  Int: "number",
  Float: "number",
  Boolean: "boolean",
  BigInt: "string",
  Bytes: "string",
};

const unwrapType = (typeNode: TypeNode): string => {
  if (typeNode.kind === "NamedType") return typeNode.name.value;
  if ("type" in typeNode) return unwrapType(typeNode.type);
  return "any";
};

const buildFieldSelection = (
  fields: readonly FieldDefinitionNode[],
  selectArg?: any
): string => {
  return fields
    .map((field: any) => {
      const type = unwrapType(field.type);
      if (scalarMap[type]) {
        return field.name.value;
      } else {
        const subSelect = selectArg?.[field.name.value];
        if (typeof subSelect === "object" && subSelect !== null) {
          const keys = Object.keys(subSelect).join(" ");
          return field.name.value + " { " + keys + " }";
        } else {
          return field.name.value + " { id }";
        }
      }
    })
    .join("\\n        ");
};

const outDir = "generated";
const rawSchema = readFileSync(`schema.graphql`, "utf-8");
const ast = parse(rawSchema);
console.log("Schema parsed successfully.");

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const typesDir = join(outDir, "types");
const clientsDir = join(outDir, "clients");
mkdirSync(typesDir, { recursive: true });
mkdirSync(clientsDir, { recursive: true });

const utilsPath = join(outDir, "helpers.ts");
const utilsContent = `
export const scalarMap: Record<string, string> = {
  ID: "string",
  String: "string",
  Int: "number",
  Float: "number",
  Boolean: "boolean",
  BigInt: "string",
  Bytes: "string",
};

export function unwrapType(typeNode: any): string {
  if (typeNode.kind === "NamedType") return typeNode.name.value;
  if ("type" in typeNode) return unwrapType(typeNode.type);
  return "any";
}

export const buildFieldSelection = (
  fields: readonly any[],
  selectArg?: any
): string => {
  return fields
    .map((field: any) => {
      const type = unwrapType(field.type);
      if (scalarMap[type]) {
        return field.name.value;
      } else {
        const subSelect = selectArg?.[field.name.value];
        if (typeof subSelect === "object" && subSelect !== null) {
          const keys = Object.keys(subSelect).join(" ");
          return field.name.value + " { " + keys + " }";
        } else {
          return field.name.value + " { id }";
        }
      }
    })
    .join("\\n        ");
};
`;

writeFileSync(utilsPath, utilsContent);

const entities = ast.definitions.filter(
  (d): d is ObjectTypeDefinitionNode => d.kind === "ObjectTypeDefinition"
);
const entityMap = new Map<string, ObjectTypeDefinitionNode>();
for (const entity of entities) {
  entityMap.set(entity.name.value, entity);
}

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

  const typeDef = `export type ${name} = {
${fields.map((f) => `  ${f.name}: ${f.tsType};`).join("\n")}
};`;
  writeFileSync(join(typesDir, `${name}.ts`), typeDef);
  const selectFieldLines = (entity.fields || []).map((f) => {
    const typeName = unwrapType(f.type);
    if (scalarMap[typeName]) {
      return `  ${f.name.value}?: boolean;`;
    } else {
      const subEntity = entityMap.get(typeName);
      const nested =
        subEntity?.fields
          ?.map((sf) => `    ${sf.name.value}?: boolean;`)
          .join("\n") || "    id?: boolean;";
      return `  ${f.name.value}?: {
${nested}
  };`;
    }
  });

  const selectTypeDef = `export type ${name}Select = {
${selectFieldLines.join("\n")}
};`;
  writeFileSync(join(typesDir, `${name}Select.ts`), selectTypeDef);
  const defaultFields = buildFieldSelection(entity.fields || []);

  const clientCode =
    `
import { request } from "graphql-request";
import { ${name} } from "../types/${name}";
import { ${name}Select } from "../types/${name}Select";
import { buildFieldSelection } from "../helpers";

const defaultFields = ` +
    "`" +
    buildFieldSelection(entity.fields || []) +
    "`" +
    `;

function selectFields(select: ${name}Select | undefined): string {
  return select
    ? buildFieldSelection(${JSON.stringify(entity.fields)}, select)
    : defaultFields;
}

export function ${plural}(subgraphUrl: string) {
  return {
    findById(id: string) {
      return {
        async select(select: ${name}Select): Promise<${name} | null> {
          const gqlFields = selectFields(select);

          const query = ` +
    "`" +
    `
            query ($id: ID!) {
              ${plural}(where: { id: $id }) {
                ${"${gqlFields}"}
              }
            }
          ` +
    "`" +
    `;
          type Response = { ${plural}: ${name}[] };
          const res: Response = await request(subgraphUrl, query, { id });
          return res.${plural}[0] || null;
        }
      };
    },

    findMany(args: { where?: Partial<${name}>; first?: number; skip?: number; orderBy?: string; orderDirection?: string }) {
      return {
        async select(select: ${name}Select): Promise<${name}[]>  {
        const gqlFields = selectFields(select);     
        const { where } = args;

        const whereLiteral = Object.entries(where || {}).map(([key, value]) => {
        if (typeof value === 'string') {
          return \`\${key}: "\${value}"\`\;
        }})

        const query = \`query {
        ${plural}(where: { \${whereLiteral} }) {
          \${gqlFields}\
        }}\`;
    
        type Response = { ${plural}: ${name}[] };
        const res: Response = await request(subgraphUrl, query, { where });
        return res.${plural};
      }          
    }},

    subscribe({ onData }: { onData: (data: ${name}) => void }): void {
      const sseUrl = subgraphUrl.replace("/graphql", "/events/stream") +"&typeName=${name.toLowerCase()}s";
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

      es.addEventListener("connection", (event) => {
        try {
          const data: ${name} = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      });

      es.addEventListener("insert", (event) => {
        try {
          const data: ${name} = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      });

      es.addEventListener("update", (event) => {
        try {
          const data: ${name} = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      });

      es.addEventListener("delete", (event) => {
        try {
          const data: ${name} = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      });
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
