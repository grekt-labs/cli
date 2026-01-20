#!/usr/bin/env bun

/**
 * Publish an artifact to the registry
 * Usage: bun run scripts/publish-artifact.ts /path/to/artifact
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { execSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { basename, dirname, join } from "path";
import { parse } from "yaml";

const {
  STORAGE_ENDPOINT,
  STORAGE_ACCESS_KEY_ID,
  STORAGE_SECRET_ACCESS_KEY,
  STORAGE_BUCKET,
  STORAGE_PUBLIC_URL,
} = process.env;

if (!STORAGE_ENDPOINT || !STORAGE_ACCESS_KEY_ID || !STORAGE_SECRET_ACCESS_KEY || !STORAGE_BUCKET) {
  console.error("Missing storage credentials in .env file");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: STORAGE_ACCESS_KEY_ID,
    secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
  },
});

async function publishArtifact(artifactPath: string) {
  // Validate artifact exists
  if (!existsSync(artifactPath)) {
    console.error(`Artifact not found: ${artifactPath}`);
    process.exit(1);
  }

  // Read grekt.yaml to get artifact info
  const manifestPath = join(artifactPath, "grekt.yaml");
  if (!existsSync(manifestPath)) {
    console.error(`Missing grekt.yaml in ${artifactPath}`);
    process.exit(1);
  }

  const manifest = parse(readFileSync(manifestPath, "utf-8"));
  const artifactId = `@${manifest.author}/${manifest.name}`;

  console.log(`\n📦 Publishing ${artifactId}@${manifest.version}...\n`);

  // Create tarball
  const tarballName = `${artifactId.replace("/", "-")}.tar.gz`;
  const tempTarball = `/tmp/${tarballName}`;
  const artifactDir = basename(artifactPath);
  const parentDir = dirname(artifactPath);

  // Create tar from parent directory to preserve folder structure
  execSync(`tar -czf ${tempTarball} -C ${parentDir} ${artifactDir}`, {
    stdio: "pipe",
  });

  console.log(`✓ Created tarball: ${tarballName}`);

  const key = `artifacts/${artifactId}.tar.gz`;
  const body = readFileSync(tempTarball);

  await client.send(
    new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/gzip",
    })
  );

  console.log(`✓ Uploaded: ${key}`);

  // Clean up
  unlinkSync(tempTarball);

  console.log(`\n✅ Published ${artifactId}@${manifest.version}`);
  console.log(`   URL: ${STORAGE_PUBLIC_URL}/${key}`);
  console.log(`\n   Install with: grekt add ${artifactId}\n`);
}

// Get artifact path from command line
const artifactPath = process.argv[2];
if (!artifactPath) {
  console.error("Usage: bun run scripts/publish-artifact.ts /path/to/artifact");
  process.exit(1);
}

publishArtifact(artifactPath).catch((err) => {
  console.error("Publish failed:", err.message);
  process.exit(1);
});
