
export const scalarMap: Record<string, string> = {
  ID: "string",
  String: "string",
  Int: "number",
  Float: "number",
  Boolean: "boolean",
  BigInt: "string",
  Bytes: "string",
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function unwrapType(typeNode: any): string {
  if (typeNode.kind === "NamedType") return typeNode.name.value;
  if ("type" in typeNode) return unwrapType(typeNode.type);
  return "any";
}

export const buildFieldSelection = (
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  fields: readonly any[],
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  selectArg?: any
): string => {
  return fields
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    .map((field: any) => {
      const type = unwrapType(field.type);
      if (scalarMap[type]) {
        return field.name.value;
         // biome-ignore lint/style/noUselessElse: <explanation>
      } else {
        const subSelect = selectArg?.[field.name.value];
        if (typeof subSelect === "object" && subSelect !== null) {
          const keys = Object.keys(subSelect).join(" ");
           // biome-ignore lint/style/useTemplate: <explanation>
          return field.name.value + " { " + keys + " }";
          // biome-ignore lint/style/noUselessElse: <explanation>
        } else {
          // biome-ignore lint/style/useTemplate: <explanation>
          return field.name.value + " { id }";
        }
      }
    })
    .join("\n        ");
};
