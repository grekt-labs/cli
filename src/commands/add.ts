import { Command } from "commander";
import { checkbox } from "@inquirer/prompts";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { isInitialized } from "#/lib/config.js";
import { getInstalled, saveInstalled } from "#/lib/installed.js";
import { getLockfile, saveLockfile } from "#/lib/lockfile.js";
import { AGENTS_DIR, SKILLS_DIR, COMMANDS_DIR } from "#/lib/paths.js";
import { success, error, info, log, newline, colors, spinner, formatArtifact } from "#/utils/ui.js";

// Mock artifacts for testing without registry
const MOCK_ARTIFACTS: Record<string, MockArtifact> = {
  "@grekt/code-reviewer": {
    name: "@grekt/code-reviewer",
    version: "1.0.0",
    type: "agent",
    description: "Comprehensive code review agent",
    skills: [
      { name: "testing", description: "Test analysis and coverage", default: true },
      { name: "git-analysis", description: "Git history analysis", default: true },
    ],
    commands: [
      { name: "/review", description: "Run code review", default: true },
      { name: "/cr", description: "Alias for /review", default: true },
    ],
    files: {
      agent: `# Code Reviewer Agent

You are a code review expert. When asked to review code, you should:

1. Analyze the code structure and patterns
2. Check for potential bugs and security issues
3. Suggest improvements for readability and maintainability
4. Verify test coverage if applicable

Use your skills (testing, git-analysis) to provide comprehensive feedback.
`,
      skills: {
        testing: `# Testing Skill

When analyzing tests:
- Check test coverage
- Verify edge cases are handled
- Ensure tests are maintainable
- Look for flaky test patterns
`,
        "git-analysis": `# Git Analysis Skill

When analyzing git history:
- Review recent commits for context
- Check for breaking changes
- Identify code churn areas
- Look at contributor patterns
`,
      },
      commands: {
        "/review": `# /review Command

Execute a comprehensive code review on the current file or selection.

## Usage
/review [file|selection]

## Process
1. Analyze code structure
2. Run through testing skill checks
3. Check git history for context
4. Provide detailed feedback
`,
      },
    },
  },
};

interface MockArtifact {
  name: string;
  version: string;
  type: string;
  description: string;
  skills: { name: string; description: string; default: boolean }[];
  commands: { name: string; description: string; default: boolean }[];
  files: {
    agent: string;
    skills: Record<string, string>;
    commands: Record<string, string>;
  };
}

export const addCommand = new Command("add")
  .description("Add an artifact from the registry")
  .argument("<artifact>", "Artifact name (e.g., @grekt/code-reviewer)")
  .option("--all", "Install all skills and commands without prompting")
  .option("--minimal", "Install only the main prompt")
  .action(async (artifactName: string, options: { all?: boolean; minimal?: boolean }) => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    // For now, use mock artifacts
    const artifact = MOCK_ARTIFACTS[artifactName];

    if (!artifact) {
      error(`Artifact not found: ${artifactName}`);
      newline();
      info("Available mock artifacts for testing:");
      for (const name of Object.keys(MOCK_ARTIFACTS)) {
        log(`  ${colors.highlight(name)}`);
      }
      newline();
      info("Note: Registry integration coming soon. Using mock data for development.");
      process.exit(1);
    }

    log(colors.bold(`\n${formatArtifact(artifact.name, artifact.version)}`));
    log(colors.dim(artifact.description));
    newline();

    // Select skills
    let selectedSkills: string[] = artifact.skills.map((s) => s.name);
    let selectedCommands: string[] = artifact.commands.map((c) => c.name);

    if (options.minimal) {
      selectedSkills = [];
      selectedCommands = [];
    } else if (!options.all && artifact.skills.length > 0) {
      selectedSkills = await checkbox({
        message: "Select skills to install:",
        choices: artifact.skills.map((s) => ({
          name: `${s.name} - ${s.description}`,
          value: s.name,
          checked: s.default,
        })),
      });
    }

    if (!options.all && !options.minimal && artifact.commands.length > 0) {
      selectedCommands = await checkbox({
        message: "Select commands to install:",
        choices: artifact.commands.map((c) => ({
          name: `${c.name} - ${c.description}`,
          value: c.name,
          checked: c.default,
        })),
      });
    }

    const spin = spinner("Installing artifact...");
    spin.start();

    // Create directories
    const dirs = [AGENTS_DIR, SKILLS_DIR, COMMANDS_DIR];
    for (const dir of dirs) {
      const fullPath = `${projectRoot}/${dir}`;
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    }

    // Get the agent name without scope
    const agentName = artifact.name.split("/").pop() || artifact.name;

    // Write agent file
    const agentFile = `${agentName}.md`;
    writeFileSync(`${projectRoot}/${AGENTS_DIR}/${agentFile}`, artifact.files.agent, "utf-8");

    // Write skill files
    for (const skillName of selectedSkills) {
      const content = artifact.files.skills[skillName];
      if (content) {
        writeFileSync(`${projectRoot}/${SKILLS_DIR}/${skillName}.md`, content, "utf-8");
      }
    }

    // Write command files
    for (const cmdName of selectedCommands) {
      const cleanName = cmdName.replace("/", "");
      const content = artifact.files.commands[cmdName];
      if (content) {
        writeFileSync(`${projectRoot}/${COMMANDS_DIR}/${cleanName}.md`, content, "utf-8");
      }
    }

    // Update installed.yaml
    const installed = getInstalled(projectRoot);

    installed.agents[agentName] = {
      description: artifact.description,
      file: agentFile,
      skills: selectedSkills,
      commands: selectedCommands,
    };

    for (const skillName of selectedSkills) {
      installed.skills[skillName] = {
        description: artifact.skills.find((s) => s.name === skillName)?.description,
        file: `${skillName}.md`,
        used_by: agentName,
      };
    }

    for (const cmdName of selectedCommands) {
      const cleanName = cmdName.replace("/", "");
      const cmd = artifact.commands.find((c) => c.name === cmdName);

      // Check if it's an alias
      if (cmd?.description.toLowerCase().includes("alias")) {
        const aliasTarget = selectedCommands.find((c) => c !== cmdName && !artifact.commands.find((ac) => ac.name === c)?.description.toLowerCase().includes("alias"));
        if (aliasTarget) {
          installed.commands[cmdName] = {
            alias: aliasTarget,
          };
          continue;
        }
      }

      installed.commands[cmdName] = {
        description: cmd?.description,
        file: `${cleanName}.md`,
        agent: agentName,
      };
    }

    saveInstalled(installed, projectRoot);

    // Update lockfile
    const lockfile = getLockfile(projectRoot);
    const checksum = createHash("sha256")
      .update(JSON.stringify({ artifact, selectedSkills, selectedCommands }))
      .digest("hex");

    lockfile.artifacts[artifact.name] = {
      version: artifact.version,
      checksum: `sha256:${checksum.slice(0, 16)}`,
      skills: Object.fromEntries(artifact.skills.map((s) => [s.name, selectedSkills.includes(s.name)])),
      commands: Object.fromEntries(artifact.commands.map((c) => [c.name, selectedCommands.includes(c.name)])),
    };

    saveLockfile(lockfile, projectRoot);

    spin.stop();

    success(`Installed ${formatArtifact(artifact.name, artifact.version)}`);
    if (selectedSkills.length > 0) {
      info(`Skills: ${selectedSkills.join(", ")}`);
    }
    if (selectedCommands.length > 0) {
      info(`Commands: ${selectedCommands.join(", ")}`);
    }
    newline();
    info("Run 'grekt sync' to sync with your AI tools");
  });
