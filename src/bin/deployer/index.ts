import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";

import archiver from "archiver";
import axios from "axios";
import type { z } from "zod";
import { getSubgraphConfig, type configSchema } from "../verifier";

const BASE_URL = "http://157.10.199.134:8096";

const runBuild = (onBuildSuccessCallback: () => void) => {
  exec("pnpm run build", (error, stdout, stderr) => {
    if (error) {
      console.error(`Build failed: ${error.message}`);
      process.exit(1);
    }
    onBuildSuccessCallback();
  });
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

    for (const p of filePaths) {
      const baseName = path.basename(p);
      const stats = fs.statSync(p);

      if (stats.isDirectory()) {
        archive.directory(p, `${rootFolderName}/${baseName}`);
      } else if (stats.isFile()) {
        archive.file(p, { name: `${rootFolderName}/${baseName}` });
      }
    }

    archive.finalize();
  });
};

// Step 1: Create subgraph info
const createSubgraphInfo = async (config: z.infer<typeof configSchema>) => {
  const { name, nameSlug, dataSources, eventHandlers } = config;
  const payload = {
    name,
    slugName: nameSlug,
    region: "us-east-1",
    categories: [],
    contracts: dataSources.map(({ chainId, contractAddress }) => ({
      chainId,
      contractAddress,
    })),
    contractEvents: eventHandlers.map(({ event }) => event),
    eventABI: "test",
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
const getPresignedUploadURL = async (subgraphId: string, apiKey: string) => {
  const response = await axios.post(
    `${BASE_URL}/api/resource/presigned-url`,
    { subgraphId },
    { headers: { Authorization: apiKey } }
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
const fetchResourceUrl = async (subgraphId: string, apiKey: string) => {
  const response = await axios.get(
    `${BASE_URL}/api/resource/presigned-url/${subgraphId}`,
    { headers: { Authorization: apiKey } }
  );
  return response.data.data.url;
};

// Step 5: Update the subgraph record with uploaded resource URL
const updateSubgraphResource = async (
  subgraphId: string,
  resourceUrl: string,
  apiKey: string
) => {
  await axios.put(
    `${BASE_URL}/api/subgraph/deploy/${subgraphId}`,
    { s3ObjectUrl: resourceUrl },
    { headers: { Authorization: apiKey } }
  );
};

// Main deployment function
export const deploy = async () => {
  try {
    const args = process.argv.slice(2);
    const apiKey = args[args.indexOf("--apiKey") + 1];

    if (!apiKey) {
      console.error(
        "❌ --apiKey is required. Please provide a valid API key and run with args --apiKey <API_KEY>"
      );
      process.exit(1);
    }

    const config = getSubgraphConfig();
    const subgraph = await createSubgraphInfo(config);
    console.log("Subgraph created with ID:", subgraph.id);
    const uploadUrl = await getPresignedUploadURL(subgraph.id, apiKey);

    const zipPath = path.resolve("resources.zip");
    const filesToZip = [
      path.resolve("./dist"),
      path.resolve("schema.graphql"),
      path.resolve("config.json"),
    ];

    await zipFiles(filesToZip, zipPath);
    await uploadZip(uploadUrl, zipPath);

    const finalUrl = await fetchResourceUrl(subgraph.id, apiKey);
    await updateSubgraphResource(subgraph.id, finalUrl, apiKey);

    fs.rmSync(zipPath);
    console.log("Subgraph deployment complete");
    console.log(subgraph.id);
    console.log(finalUrl);
  } catch (err) {
    console.error("Deployment failed:", err);
  }
};

const args = process.argv.slice(2);
const apiKey = args[args.indexOf("--apiKey") + 1];

if (!apiKey) {
  console.error(
    "❌ --apiKey is required. Please provide a valid API key and run with args --apiKey <API_KEY>"
  );
  process.exit(1);
}

runBuild(() => {
  deploy();
});
