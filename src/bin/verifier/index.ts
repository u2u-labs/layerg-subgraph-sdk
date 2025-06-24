import fs, { existsSync, statSync } from "fs";
import path from "path";
import yaml from "js-yaml";
import { z } from "zod";

// Define schema using zod
export const configSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  apiKey: z.string().min(1),
  region: z.string().min(1),
  resource: z.object({
    schema: z.string().min(1),
    handler: z.string().min(1),
  }),
  dataSources: z.array(
    z.object({
      chainId: z.number().min(0),
      contractAddress: z.string().startsWith("0x").length(42),
      startBlock: z.number().nonnegative(),
    })
  ),
  eventHandlers: z.array(
    z.object({
      event: z.string().min(1),
      handler: z.string().min(1),
    })
  ),
});

const assertFileExists = (filePath: string, label: string) => {
  if (!existsSync(filePath)) {
    console.error(`❌ Missing required file: ${filePath} (${label})`);
    process.exit(1);
  }

  const stat = statSync(filePath);
  if (!stat.isFile()) {
    console.error(`❌ Path is not a file: ${filePath} (${label})`);
    process.exit(1);
  }
};

// Verify and return parsed config
export const getSubgraphConfig = (): z.infer<typeof configSchema> => {
  console.log("Loading config.yaml...");
  const content = fs.readFileSync("config.yaml", "utf8");
  console.log("Config loaded.");
  const config = yaml.load(content) as z.infer<typeof configSchema>;
  const parsed = configSchema.safeParse(config);

  if (!parsed.success) {
    console.error("❌ Invalid config.yaml:");
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }

  const parsedConfig = parsed.data;

  // Check required files
  assertFileExists(config.resource.schema, "schema.graphql");
  assertFileExists(config.resource.handler, "handler.ts");

  const handlerModule = require(path.resolve(config.resource.handler));
  const handlerNames = config.eventHandlers.map((e) => e.handler);

  for (const name of handlerNames) {
    if (typeof handlerModule[name] !== "function") {
      console.error(
        `❌ Missing handler export: ${name} in ${config.resource.handler}`
      );
      process.exit(1);
    }
  }

  return parsedConfig;
};

getSubgraphConfig();
