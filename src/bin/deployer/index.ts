import fs from "fs";
import path from "path";
import archiver from "archiver";
import axios from "axios";
import { z } from "zod";
import { configSchema, getSubgraphConfig } from "../verifier";

const BASE_URL = "https://m127s71m-8080.asse.devtunnels.ms";

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
  const { apiKey, name, slug, dataSources, eventHandlers } = config;
  const payload = {
    name,
    slugName: slug,
    region: config.region,
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
    const config = getSubgraphConfig();
    const subgraph = await createSubgraphInfo(config);
    console.log("Subgraph created with ID:", subgraph.id);
    const uploadUrl = await getPresignedUploadURL(subgraph.id, config);

    const zipPath = path.resolve("resources.zip");
    const filesToZip = [
      path.resolve(config.resource.handler),
      path.resolve(config.resource.schema),
      path.resolve('config.yaml'),
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
