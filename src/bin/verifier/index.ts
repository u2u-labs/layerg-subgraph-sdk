import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// Define your config schema using zod
export const configSchema = z.object({
  name: z.string(),
  nameSlug: z.string(),
  dataSources: z.array(
    z.object({
      chainId: z.number(),
      contractAddress: z.string(),
      startBlock: z.number(),
    })
  ),
  eventHandlers: z.array(
    z.object({
      eventName: z.string(),
      event: z.string(),
      handler: z.string(),
    })
  ),
});

export type Config = z.infer<typeof configSchema>;

export function getSubgraphConfig(): Config {
  const absolutePath = path.resolve('config.json');;

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found at: ${absolutePath}`);
  }

  const fileContent = fs.readFileSync(absolutePath, "utf-8");

  let parsed = {};
  try {
    parsed = JSON.parse(fileContent);
  } catch (err) {
    throw new Error(`Invalid JSON format in config file: ${err}`);
  }

  const result = configSchema.safeParse(parsed);

  if (!result.success) {
    console.error("❌ Invalid config file structure:");
    console.error(result.error.format());
    throw new Error("Config validation failed.");
  }

  console.log("✅ Config file loaded and validated successfully.");
  return result.data;
}