#!/usr/bin/env bun

/**
 * Deploy script to upload binaries to Cloudflare R2
 * Usage: bun run deploy
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync } from "fs";
import { basename } from "path";

// Load environment variables
const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_ACCOUNT_ID,
  R2_PUBLIC_URL,
} = process.env;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_ACCOUNT_ID) {
  console.error("Missing R2 credentials in .env file");
  console.error("Required: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ACCOUNT_ID");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const binaries = [
  "dist/grekt-linux-x64",
  "dist/grekt-macos-arm64",
  "dist/grekt-macos-x64",
  "dist/grekt-windows.exe",
];

async function upload(filepath: string): Promise<void> {
  if (!existsSync(filepath)) {
    console.log(`⏭  Skipping ${filepath} (not found)`);
    return;
  }

  const filename = basename(filepath);
  const body = readFileSync(filepath);

  console.log(`📤 Uploading ${filename}...`);

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: filename,
      Body: body,
      ContentType: "application/octet-stream",
    })
  );

  console.log(`✓  ${R2_PUBLIC_URL}/${filename}`);
}

async function main() {
  console.log("\n🚀 Deploying binaries to R2...\n");

  for (const binary of binaries) {
    await upload(binary);
  }

  console.log("\n✅ Deploy complete!\n");
  console.log("Download URLs:");
  for (const binary of binaries) {
    if (existsSync(binary)) {
      console.log(`  ${R2_PUBLIC_URL}/${basename(binary)}`);
    }
  }
  console.log("");
}

main().catch((err) => {
  console.error("Deploy failed:", err.message);
  process.exit(1);
});
