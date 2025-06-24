import fs, { existsSync, statSync } from "fs";
import path from "path";
import archiver from "archiver";
import axios from "axios";
import yaml from "js-yaml";
import { z } from "zod";

const BASE_URL = "https://4f1zswx1-8080.asse.devtunnels.ms";

// Define schema using zod
const configSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  apiKey: z.string().min(32),
  region: z.string(),
  resource: z.object({
    schema: z.string().min(1),
    handler: z.string().min(1),
  }),
  dataSources: z.array(
    z.object({
      chainId: z.number(),
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

// Load config.yaml as SubgraphConfig
const loadConfig = (): z.infer<typeof configSchema> => {
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

// Zip files under a root folder (e.g., resources/)
const zipFiles = (
  filePaths: string[],
  outputZipPath: string,
  rootFolderName = "resources"
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputZipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.on("error", reject);
    output.on("close", resolve);

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      archive.file(filePath, { name: `${rootFolderName}/${fileName}` });
    }

    archive.finalize();
  });
};

// Step 1: Create subgraph info
const createSubgraphInfo = async (config: z.infer<typeof configSchema>) => {
  const { apiKey, name, slug, dataSources } = config;
  const payload = {
    name,
    slugName: slug,
    region: config.region,
    categories: [],
    contracts: dataSources.map(({ chainId, contractAddress }) => ({
      chainId,
      contractAddress,
    })),
  };

  const response = await axios.post(
    `${BASE_URL}/api/subgraph/deploy/info`,
    payload,
    {
      headers: { Authorization: apiKey },
    }
  );

  return response.data.data as { id: string };
};

// Step 2: Request pre-signed upload URL
const getPresignedUploadURL = async (
  subgraphId: string,
  config: z.infer<typeof configSchema>
) => {
  const response = await axios.post(
    `${BASE_URL}/api/resource/presigned-url`,
    { subgraphId },
    { headers: { Authorization: config.apiKey } }
  );
  return response.data.data.url;
};

// Step 3: Upload the zip file
const uploadZip = async (presignedUrl: string, zipPath: string) => {
  const stream = fs.createReadStream(zipPath);
  const size = fs.statSync(zipPath).size;

  await axios.put(presignedUrl, stream, {
    headers: {
      "Content-Length": size.toString(),
      "Content-Type": "application/zip",
    },
  });
};

// Step 4: Get resource URL for verification
const fetchResourceUrl = async (
  subgraphId: string,
  config: z.infer<typeof configSchema>
) => {
  const response = await axios.get(
    `${BASE_URL}/api/resource/presigned-url/${subgraphId}`,
    { headers: { Authorization: config.apiKey } }
  );
  return response.data.data.url;
};

// Step 5: Update the subgraph record with uploaded resource URL
const updateSubgraphResource = async (
  subgraphId: string,
  resourceUrl: string,
  config: z.infer<typeof configSchema>
) => {
  await axios.put(
    `${BASE_URL}/api/subgraph/deploy/${subgraphId}`,
    { s3ObjectUrl: resourceUrl },
    { headers: { Authorization: config.apiKey } }
  );
};

// Main deployment function
export const deploy = async () => {
  try {
    const config = loadConfig();
    const subgraph = await createSubgraphInfo(config);
    const uploadUrl = await getPresignedUploadURL(subgraph.id, config);

    const zipPath = path.resolve("resources.zip");
    const filesToZip = [
      path.resolve(config.resource.handler),
      path.resolve(config.resource.schema),
    ];

    await zipFiles(filesToZip, zipPath);
    await uploadZip(uploadUrl, zipPath);

    const finalUrl = await fetchResourceUrl(subgraph.id, config);
    await updateSubgraphResource(subgraph.id, finalUrl, config);

    fs.rmSync(zipPath);
    console.log("Subgraph deployment complete.");
  } catch (err) {
    console.error("Deployment failed:", err);
  }
};

deploy();
