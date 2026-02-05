import { Command } from "commander";
import { parse } from "yaml";
import { isInitialized } from "#/config/project/project";
import { getLockfile, getDirectorySize, fs } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { formatBytes, estimateTokens, ArtifactManifestSchema, CATEGORIES } from "@grekt-labs/cli-engine";
import { error, info, log, colors, newline } from "#/shared/ui/ui";

export const listCommand = new Command("list")
  .alias("ls")
  .description("List installed artifacts")
  .option("--json", "Output as JSON")
  .action((options: { json?: boolean }) => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    const lockfile = getLockfile(projectRoot);
    const artifacts = Object.entries(lockfile.artifacts);

    if (options.json) {
      console.log(JSON.stringify(lockfile, null, 2));
      return;
    }

    if (artifacts.length === 0) {
      info("No artifacts installed");
      info("Run 'grekt add <artifact>' to install artifacts");
      return;
    }

    log(colors.bold("Installed artifacts:"));
    newline();

    let totalSize = 0;

    for (const [name, artifact] of artifacts) {
      const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${name}`;
      let size = 0;
      let sizeStr = "";

      if (fs.exists(artifactDir)) {
        size = getDirectorySize(artifactDir);
        totalSize += size;
        sizeStr = formatBytes(size);
      }

      log(`  ${colors.highlight(name)}${colors.dim(`@${artifact.version}`)}  ${colors.dim(sizeStr)}`);

      const manifestPath = `${artifactDir}/grekt.yaml`;
      if (fs.exists(manifestPath)) {
        const rawManifest = parse(fs.readFile(manifestPath));
        const manifestResult = ArtifactManifestSchema.safeParse(rawManifest);

        if (manifestResult.success && manifestResult.data.components) {
          for (const category of CATEGORIES) {
            const components = manifestResult.data.components[category];
            if (components && components.length > 0) {
              const names = components.map(c => c.name);
              log(`    ${colors.dim(`${category}:`)} ${names.join(", ")}`);
            }
          }
        }
      }

      newline();
    }

    // Show total context size
    log(colors.dim("─".repeat(40)));
    log(`  Total: ${formatBytes(totalSize)} (~${estimateTokens(totalSize).toLocaleString()} tokens)`);

  });
