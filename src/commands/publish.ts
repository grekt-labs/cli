import { Command } from "commander";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { execSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { parse } from "yaml";

const {
  STORAGE_ENDPOINT,
  STORAGE_ACCESS_KEY_ID,
  STORAGE_SECRET_ACCESS_KEY,
  STORAGE_BUCKET,
  STORAGE_PUBLIC_URL,
} = process.env;

export const publishCommand = new Command("publish")
  .description("Publish an artifact to the registry")
  .argument("<path>", "Path to artifact directory")
  .action(async (artifactPath: string) => {
    if (!STORAGE_ENDPOINT || !STORAGE_ACCESS_KEY_ID || !STORAGE_SECRET_ACCESS_KEY || !STORAGE_BUCKET) {
      console.error("Missing storage credentials in .env file");
      process.exit(1);
    }

    const fullPath = resolve(artifactPath);

    if (!existsSync(fullPath)) {
      console.error(`Artifact not found: ${fullPath}`);
      process.exit(1);
    }

    const manifestPath = join(fullPath, "grekt.yaml");
    if (!existsSync(manifestPath)) {
      console.error(`Missing grekt.yaml in ${fullPath}`);
      process.exit(1);
    }

    const manifest = parse(readFileSync(manifestPath, "utf-8"));
    const artifactId = `@${manifest.author}/${manifest.name}`;

    console.log(`\n📦 Publishing ${artifactId}@${manifest.version}...\n`);

    const client = new S3Client({
      region: "auto",
      endpoint: STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: STORAGE_ACCESS_KEY_ID,
        secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
      },
    });

    const tarballName = `${artifactId.replace("/", "-")}.tar.gz`;
    const tempTarball = `/tmp/${tarballName}`;
    const artifactDir = basename(fullPath);
    const parentDir = dirname(fullPath);

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

    unlinkSync(tempTarball);

    console.log(`\n✅ Published ${artifactId}@${manifest.version}`);
    console.log(`   URL: ${STORAGE_PUBLIC_URL}/${key}`);
    console.log(`\n   Install with: grekt add ${artifactId}\n`);
  });
