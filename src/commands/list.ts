import { Command } from "commander";
import { isInitialized } from "#/lib/config.js";
import { getInstalled } from "#/lib/installed.js";
import { getLockfile } from "#/lib/lockfile.js";
import { error, info, log, colors, newline } from "#/utils/ui.js";

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

    const installed = getInstalled(projectRoot);
    const lockfile = getLockfile(projectRoot);

    const agents = Object.entries(installed.agents);
    const skills = Object.entries(installed.skills);
    const commands = Object.entries(installed.commands);

    if (options.json) {
      console.log(JSON.stringify({ agents: installed.agents, skills: installed.skills, commands: installed.commands }, null, 2));
      return;
    }

    if (agents.length === 0 && skills.length === 0 && commands.length === 0) {
      info("No artifacts installed");
      info("Run 'grekt add <artifact>' to install artifacts");
      return;
    }

    // Display agents
    if (agents.length > 0) {
      log(colors.bold("Agents:"));
      for (const [name, agent] of agents) {
        const artifactId = findArtifactId(lockfile.artifacts, name);
        const version = artifactId ? lockfile.artifacts[artifactId]?.version : undefined;

        log(`  ${colors.highlight(name)}${version ? colors.dim(`@${version}`) : ""}`);
        if (agent.description) {
          log(`    ${colors.dim(agent.description)}`);
        }
        if (agent.skills && agent.skills.length > 0) {
          log(`    ${colors.dim("skills:")} ${agent.skills.join(", ")}`);
        }
        if (agent.commands && agent.commands.length > 0) {
          log(`    ${colors.dim("commands:")} ${agent.commands.join(", ")}`);
        }
      }
      newline();
    }

    // Display skills
    if (skills.length > 0) {
      log(colors.bold("Skills:"));
      for (const [name, skill] of skills) {
        log(`  ${colors.highlight(name)}`);
        if (skill.description) {
          log(`    ${colors.dim(skill.description)}`);
        }
        if (skill.used_by) {
          log(`    ${colors.dim("used by:")} ${skill.used_by}`);
        }
      }
      newline();
    }

    // Display commands
    if (commands.length > 0) {
      log(colors.bold("Commands:"));
      for (const [name, command] of commands) {
        if (command.alias) {
          log(`  ${colors.highlight(name)} ${colors.dim(`→ ${command.alias}`)}`);
        } else {
          log(`  ${colors.highlight(name)}`);
          if (command.description) {
            log(`    ${colors.dim(command.description)}`);
          }
          if (command.agent) {
            log(`    ${colors.dim("agent:")} ${command.agent}`);
          }
        }
      }
    }
  });

function findArtifactId(artifacts: Record<string, unknown>, name: string): string | undefined {
  for (const id of Object.keys(artifacts)) {
    // Match @scope/name or just name
    if (id.endsWith(`/${name}`) || id === name) {
      return id;
    }
  }
  return undefined;
}
