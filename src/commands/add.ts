import { Command } from "commander";
import { select } from "@inquirer/prompts";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { basename } from "path";
import { createHash } from "crypto";
import { isInitialized } from "#/lib/config";
import { getInstalled, saveInstalled } from "#/lib/installed";
import { getLockfile, saveLockfile } from "#/lib/lockfile";
import { AGENTS_DIR, SKILLS_DIR, COMMANDS_DIR } from "#/lib/paths";
import { isGitHubSource, toRawUrl, fetchRawFile } from "#/lib/github";
import { success, error, info, log, newline, colors, spinner } from "#/utils/ui";

type ArtifactType = "agent" | "skill" | "command";

export const addCommand = new Command("add")
  .description("Add an artifact from a GitHub URL")
  .argument("<source>", "GitHub URL (github:user/repo/path/file.md)")
  .option("-t, --type <type>", "Artifact type (agent, skill, command)")
  .option("-n, --name <name>", "Override artifact name")
  .action(async (source: string, options: { type?: ArtifactType; name?: string }) => {
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
      log("  grekt add github:user/repo/agents/reviewer.md");
      log("  grekt add https://github.com/user/repo/blob/main/agent.md");
      process.exit(1);
    }

    const rawUrl = toRawUrl(source);
    if (!rawUrl) {
      error("Invalid GitHub URL");
      newline();
      info("Format: github:user/repo/path/to/file.md");
      process.exit(1);
    }

    const spin = spinner("Fetching from GitHub...");
    spin.start();

    const content = await fetchRawFile(rawUrl);
    spin.stop();

    if (!content) {
      error("Could not fetch file from GitHub");
      info(`URL: ${rawUrl}`);
      process.exit(1);
    }

    // Determine artifact name from URL or option
    const fileName = basename(rawUrl);
    const artifactName = options.name || fileName.replace(/\.md$/, "");

    // Determine type from option or ask
    let artifactType: ArtifactType = options.type || "agent";
    if (!options.type) {
      artifactType = await select({
        message: "What type of artifact is this?",
        choices: [
          { name: "Agent", value: "agent" as ArtifactType },
          { name: "Skill", value: "skill" as ArtifactType },
          { name: "Command", value: "command" as ArtifactType },
        ],
      });
    }

    // Determine target directory
    const targetDir = {
      agent: AGENTS_DIR,
      skill: SKILLS_DIR,
      command: COMMANDS_DIR,
    }[artifactType];

    // Create directory if needed
    const fullDir = `${projectRoot}/${targetDir}`;
    if (!existsSync(fullDir)) {
      mkdirSync(fullDir, { recursive: true });
    }

    // Write file
    const targetFile = `${artifactName}.md`;
    writeFileSync(`${fullDir}/${targetFile}`, content, "utf-8");

    // Update installed.yaml
    const installed = getInstalled(projectRoot);

    if (artifactType === "agent") {
      installed.agents[artifactName] = {
        file: targetFile,
      };
    } else if (artifactType === "skill") {
      installed.skills[artifactName] = {
        file: targetFile,
      };
    } else if (artifactType === "command") {
      installed.commands[artifactName] = {
        file: targetFile,
      };
    }

    saveInstalled(installed, projectRoot);

    // Update lockfile
    const lockfile = getLockfile(projectRoot);
    const checksum = createHash("sha256").update(content).digest("hex");

    lockfile.artifacts[`${artifactType}:${artifactName}`] = {
      version: "github",
      checksum: `sha256:${checksum.slice(0, 16)}`,
    };

    saveLockfile(lockfile, projectRoot);

    success(`Installed ${colors.highlight(artifactName)} (${artifactType})`);
    info(`File: ${targetDir}/${targetFile}`);
    newline();
    info("Run 'grekt sync' to sync with your AI tools");
  });
