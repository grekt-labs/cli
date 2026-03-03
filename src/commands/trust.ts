import { Command } from "commander";
import { requireInitialized } from "#/shared/guards/guards";
import { getConfig, saveConfig } from "#/config/project/project";
import type { ArtifactEntry } from "@grekt/engine";
import {
  generateTrustKey,
  isValidTrustKey,
  signTrust,
} from "@grekt/engine";
import { success, error, info, warning, log, newline, colors } from "#/shared/ui/ui";

const TRUST_KEY_ENV = "GREKT_TRUST_KEY";

export function ensureLongForm(entry: ArtifactEntry): Exclude<ArtifactEntry, string> {
  if (typeof entry === "string") {
    return { version: entry, mode: "lazy" };
  }
  return entry;
}

function getTrustKeyFromEnv(): string | undefined {
  return process.env[TRUST_KEY_ENV];
}

export const trustCommand = new Command("trust")
  .description("Sign an artifact as trusted using HMAC (requires GREKT_TRUST_KEY)")
  .argument("[artifact]", "Artifact ID (e.g., @scope/name)")
  .option("--generate-key", "Generate a new GREKT_TRUST_KEY")
  .action((artifactId: string | undefined, options: { generateKey?: boolean }) => {
    if (options.generateKey) {
      const key = generateTrustKey();
      newline();
      success("Generated new trust key:");
      newline();
      log(`  ${colors.bold(key)}`);
      newline();
      info("Add this to your environment and CI secrets:");
      log(`  export ${TRUST_KEY_ENV}="${key}"`);
      newline();
      warning("Store this key securely. Anyone with this key can trust artifacts.");
      warning("Do not run this command in CI or shared terminals — the key will appear in logs.");
      return;
    }

    if (!artifactId) {
      error("Artifact ID is required. Usage: grekt trust <artifact>");
      info("To generate a new trust key, run: grekt trust --generate-key");
      process.exit(1);
    }

    const trustKey = getTrustKeyFromEnv();

    if (!trustKey) {
      error(`${TRUST_KEY_ENV} environment variable is not set`);
      newline();
      info("To get started:");
      log(`  1. Generate a key:  ${colors.highlight("grekt trust --generate-key")}`);
      log(`  2. Set the env var: ${colors.highlight(`export ${TRUST_KEY_ENV}="<key>"`)}`);
      log(`  3. Sign artifacts:  ${colors.highlight("grekt trust @scope/name")}`);
      process.exit(1);
    }

    if (!isValidTrustKey(trustKey)) {
      error(`Invalid ${TRUST_KEY_ENV} format`);
      info("Generate a valid key with: grekt trust --generate-key");
      process.exit(1);
    }

    const projectRoot = process.cwd();
    requireInitialized(projectRoot);

    const config = getConfig(projectRoot);

    if (!config.artifacts[artifactId]) {
      error(`Artifact ${colors.highlight(artifactId)} is not in config`);
      info("Add it first with 'grekt add'");
      process.exit(1);
    }

    const entry = ensureLongForm(config.artifacts[artifactId]);
    const signature = signTrust(artifactId, trustKey);
    entry.trusted = signature;
    config.artifacts[artifactId] = entry;
    saveConfig(config, projectRoot);

    success(`Signed ${colors.highlight(artifactId)} as trusted`);
  });

export const untrustCommand = new Command("untrust")
  .description("Remove trusted status from an artifact")
  .argument("<artifact>", "Artifact ID (e.g., @scope/name)")
  .action((artifactId: string) => {
    const projectRoot = process.cwd();
    requireInitialized(projectRoot);

    const config = getConfig(projectRoot);

    if (!config.artifacts[artifactId]) {
      error(`Artifact ${colors.highlight(artifactId)} is not in config`);
      info("Add it first with 'grekt add'");
      process.exit(1);
    }

    const entry = config.artifacts[artifactId];

    if (typeof entry === "string") {
      info(`${colors.highlight(artifactId)} is already not trusted`);
      return;
    }

    delete entry.trusted;
    config.artifacts[artifactId] = entry;
    saveConfig(config, projectRoot);

    success(`Removed trusted status from ${colors.highlight(artifactId)}`);
  });
