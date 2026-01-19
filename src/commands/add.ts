import { Command } from "commander";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { createHash } from "crypto";
import { isInitialized } from "#/lib/config";
import { getInstalled, saveInstalled } from "#/lib/installed";
import { getLockfile, saveLockfile } from "#/lib/lockfile";
import { GREKTS_DIR } from "#/lib/paths";
import { isGitHubSource, parseGitHubSource, downloadPackage } from "#/lib/github";
import { scanPackage, getPackageId } from "#/lib/package";
import { success, error, info, log, newline, colors, spinner } from "#/utils/ui";

export const addCommand = new Command("add")
  .description("Add a package from GitHub")
  .argument("<source>", "GitHub URL (github:user/repo/@scope/name)")
  .action(async (source: string) => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    if (!isGitHubSource(source)) {
      error("Only GitHub sources supported for now");
      newline();
      info("Examples:");
      log("  grekt add github:grekt/artifacts/@grekt/web-scraper");
      log("  grekt add https://github.com/grekt/artifacts/tree/main/@grekt/web-scraper");
      process.exit(1);
    }

    const ghSource = parseGitHubSource(source);
    if (!ghSource) {
      error("Invalid GitHub URL");
      newline();
      info("Format: github:user/repo/path/to/package");
      process.exit(1);
    }

    // Extract package name from path (last part like @scope/name)
    const pathParts = ghSource.path.split("/");
    let packageName: string;

    // Check if path ends with @scope/name pattern
    if (pathParts.length >= 2 && pathParts[pathParts.length - 2]?.startsWith("@")) {
      packageName = `${pathParts[pathParts.length - 2]}/${pathParts[pathParts.length - 1]}`;
    } else {
      packageName = pathParts[pathParts.length - 1] || ghSource.path;
    }

    const targetDir = `${projectRoot}/${GREKTS_DIR}/${packageName}`;

    // Check if already installed
    if (existsSync(targetDir)) {
      error(`Package ${colors.highlight(packageName)} is already installed`);
      info("Run 'grekt remove' first to reinstall");
      process.exit(1);
    }

    const spin = spinner(`Downloading ${packageName}...`);
    spin.start();

    // Download package from GitHub
    mkdirSync(targetDir, { recursive: true });
    const downloaded = await downloadPackage(ghSource, targetDir);

    spin.stop();

    if (!downloaded) {
      error("Could not download package from GitHub");
      info(`Source: ${source}`);
      process.exit(1);
    }

    // Scan the downloaded package
    const pkgInfo = scanPackage(targetDir);

    if (!pkgInfo) {
      error("Invalid package: missing grekt.yaml or invalid structure");
      process.exit(1);
    }

    const packageId = getPackageId(pkgInfo.manifest.author, pkgInfo.manifest.name);

    // Update installed.yaml
    const installed = getInstalled(projectRoot);
    installed.packages[packageId] = {
      version: pkgInfo.manifest.version,
      agent: pkgInfo.agent?.path,
      skills: pkgInfo.skills.map((s) => s.path),
      commands: pkgInfo.commands.map((c) => c.path),
    };
    saveInstalled(installed, projectRoot);

    // Update lockfile
    const lockfile = getLockfile(projectRoot);
    const manifestContent = readFileSync(`${targetDir}/grekt.yaml`, "utf-8");
    const checksum = createHash("sha256").update(manifestContent).digest("hex");

    lockfile.packages[packageId] = {
      version: pkgInfo.manifest.version,
      checksum: `sha256:${checksum.slice(0, 16)}`,
      source: `github:${ghSource.owner}/${ghSource.repo}/${ghSource.path}`,
    };
    saveLockfile(lockfile, projectRoot);

    newline();
    success(`Installed ${colors.highlight(packageId)}@${pkgInfo.manifest.version}`);

    if (pkgInfo.agent) {
      log(`  ${colors.dim("agent:")} ${pkgInfo.agent.parsed.frontmatter.name}`);
    }
    if (pkgInfo.skills.length > 0) {
      log(`  ${colors.dim("skills:")} ${pkgInfo.skills.map((s) => s.parsed.frontmatter.name).join(", ")}`);
    }
    if (pkgInfo.commands.length > 0) {
      log(`  ${colors.dim("commands:")} ${pkgInfo.commands.map((c) => c.parsed.frontmatter.name).join(", ")}`);
    }

    newline();
    info("Run 'grekt sync' to sync with your AI tools");
  });
