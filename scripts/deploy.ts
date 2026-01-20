#!/usr/bin/env bun

/**
 * Deploy script to upload binaries to object storage
 * Usage:
 *   bun run deploy           # deploys to release/dev/
 *   bun run deploy v0.1.0    # deploys to release/v0.1.0/
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync } from "fs";
import { basename } from "path";

const {
  STORAGE_ENDPOINT,
  STORAGE_ACCESS_KEY_ID,
  STORAGE_SECRET_ACCESS_KEY,
  STORAGE_BUCKET,
  STORAGE_PUBLIC_URL,
} = process.env;

if (!STORAGE_ENDPOINT || !STORAGE_ACCESS_KEY_ID || !STORAGE_SECRET_ACCESS_KEY || !STORAGE_BUCKET) {
  console.error("Missing storage credentials in .env file");
  console.error("Required: STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_BUCKET");
  process.exit(1);
}

const version = process.argv[2] || "dev";
const releasePrefix = `release/${version}`;

const client = new S3Client({
  region: "auto",
  endpoint: STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: STORAGE_ACCESS_KEY_ID,
    secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
  },
});

const binaries = [
  "dist/grekt-linux-x64",
  "dist/grekt-macos-arm64",
  "dist/grekt-macos-x64",
  "dist/grekt-windows.exe",
];

async function upload(filepath: string): Promise<string | null> {
  if (!existsSync(filepath)) {
    console.log(`⏭  Skipping ${filepath} (not found)`);
    return null;
  }

  const filename = basename(filepath);
  const key = `${releasePrefix}/${filename}`;
  const body = readFileSync(filepath);

  console.log(`📤 Uploading ${key}...`);

  await client.send(
    new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/octet-stream",
    })
  );

  const url = `${STORAGE_PUBLIC_URL}/${key}`;
  console.log(`✓  ${url}`);
  return url;
}

async function main() {
  console.log(`\n🚀 Deploying binaries (${releasePrefix})...\n`);

  const urls: string[] = [];
  for (const binary of binaries) {
    const url = await upload(binary);
    if (url) urls.push(url);
  }

  console.log("\n✅ Deploy complete!\n");
  console.log("Download URLs:");
  for (const url of urls) {
    console.log(`  ${url}`);
  }
}

main().catch((err) => {
  console.error("Deploy failed:", err.message);
  process.exit(1);
});
