import { Command } from "commander";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { execSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { parse } from "yaml";
import { getRegistryCredentials, getCredentialsFromEnv, getCredentialsPath } from "#/lib/credentials";
import { success, error, info, log, colors, spinner } from "#/utils/ui";

export const publishCommand = new Command("publish")
  .description("Publish an artifact to a registry")
  .argument("<path>", "Path to artifact directory")
  .option("-r, --registry <name>", "Registry name from credentials.yaml", "default")
  .option("--local", "Only create tarball locally (no upload)")
  .option("-o, --output <path>", "Output path for tarball (with --local)")
  .action(async (artifactPath: string, options: { registry: string; local?: boolean; output?: string }) => {
    const fullPath = resolve(artifactPath);

    if (!existsSync(fullPath)) {
      error(`Artifact not found: ${fullPath}`);
      process.exit(1);
    }

    const manifestPath = join(fullPath, "grekt.yaml");
    if (!existsSync(manifestPath)) {
      error(`Missing grekt.yaml in ${fullPath}`);
      process.exit(1);
    }

    const manifest = parse(readFileSync(manifestPath, "utf-8"));
    const artifactId = `@${manifest.author}/${manifest.name}`;

    log(colors.bold(`\nPublishing ${artifactId}@${manifest.version}...\n`));

    // Create tarball
    const tarballName = `${artifactId.replace("/", "-")}.tar.gz`;
    const outputPath = options.output || `/tmp/${tarballName}`;
    const artifactDir = basename(fullPath);
    const parentDir = dirname(fullPath);

    execSync(`tar -czf ${outputPath} -C ${parentDir} ${artifactDir}`, {
      stdio: "pipe",
    });

    success(`Created tarball: ${tarballName}`);

    // If local only, stop here
    if (options.local) {
      log(`\n  Output: ${outputPath}`);
      info("\nUpload manually to your registry or use without --local to publish");
      return;
    }

    // Get credentials (env vars take precedence, then credentials file)
    let credentials = getCredentialsFromEnv();

    if (!credentials) {
      credentials = getRegistryCredentials(options.registry);
    }

    if (!credentials) {
      unlinkSync(outputPath);
      error("No registry credentials found");
      log("");
      info("Configure credentials in one of these ways:");
      log("");
      log(colors.dim("  1. Environment variables:"));
      log("     GREKT_STORAGE_ENDPOINT=https://...");
      log("     GREKT_STORAGE_ACCESS_KEY_ID=...");
      log("     GREKT_STORAGE_SECRET_ACCESS_KEY=...");
      log("     GREKT_STORAGE_BUCKET=...");
      log("");
      log(colors.dim(`  2. Credentials file (${getCredentialsPath()}):`));
      log("     default:");
      log("       type: s3");
      log("       endpoint: https://...");
      log("       accessKeyId: ...");
      log("       secretAccessKey: ...");
      log("       bucket: ...");
      log("       publicUrl: https://... (optional)");
      log("");
      log(colors.dim("  3. Use --local to create tarball without uploading"));
      process.exit(1);
    }

    // Upload to S3-compatible storage
    const spin = spinner("Uploading...");
    spin.start();

    const client = new S3Client({
      region: "auto",
      endpoint: credentials.endpoint,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });

    const key = `artifacts/${artifactId}.tar.gz`;
    const body = readFileSync(outputPath);

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: credentials.bucket,
          Key: key,
          Body: body,
          ContentType: "application/gzip",
        })
      );

      spin.stop();
      success(`Uploaded: ${key}`);

      unlinkSync(outputPath);

      log("");
      success(`Published ${artifactId}@${manifest.version}`);

      if (credentials.publicUrl) {
        log(`  URL: ${credentials.publicUrl}/${key}`);
      }

      log(`\n  Install with: grekt add ${artifactId}\n`);
    } catch (err) {
      spin.stop();
      unlinkSync(outputPath);
      error(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      process.exit(1);
    }
  });
