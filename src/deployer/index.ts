#!/usr/bin/env ts-node

import { createReadStream, createWriteStream, rmSync, statSync } from "fs";
import archiver from "archiver";
import axios from "axios";
import path from "path";

const args = process.argv.slice(2);
const apiKey = args[args.indexOf("--apiKey") + 1];
const folderPath = args[args.indexOf("--folderPath") + 1];

if (!apiKey || !folderPath) {
  console.error("Usage: --apiKey <your api key> --folderPath <folder path>");
  process.exit(1);
}

const zipFolder = (sourceDir: string, outPath: string) => {
  return new Promise((resolve: any, reject: any) => {
    const output = createWriteStream(outPath);
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    output.on("close", () => {
      console.log(`Zip created: ${outPath} (${archive.pointer()} total bytes)`);
      resolve();
    });

    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
};

const getUploadURL = async () => {
  const getUploadLinkResponse = await axios("/api/resource/presigned-url", {
    method: "POST",
    headers: {
      Authorization: apiKey,
    },
  });
  const data = getUploadLinkResponse.data;
  return data;
};

export const deploy = async () => {
  try {
    const presignedUrl = await getUploadURL();
    const folderToZip = path.resolve(folderPath);
    const outputZip = path.resolve(folderPath + "/myFolder.zip");
    await zipFolder(folderToZip, outputZip);
    const fileStream = createReadStream(outputZip);
    const stat = statSync(outputZip);
    await axios(presignedUrl, {
      method: "PUT",
      headers: {
        "Content-Length": stat.size.toString(),
        "Content-Type": "application/zip",
      },
      data: fileStream,
    });
    rmSync(outputZip);
  } catch (err: any) {
    console.error("Error deploy:", err);
  }
};

deploy();
