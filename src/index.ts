#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "#/commands/init";
import { configCommand } from "#/commands/config";
import { syncCommand } from "#/commands/sync";
import { addTargetCommand } from "#/commands/add-target";
import { removeTargetCommand } from "#/commands/remove-target";
import { listCommand } from "#/commands/list";
import { addCommand } from "#/commands/add";
import { installCommand } from "#/commands/install";
import { checkCommand } from "#/commands/check";
import { removeCommand } from "#/commands/remove";
import { packCommand } from "#/commands/pack";
import { publishCommand } from "#/commands/publish";
import { deprecateCommand } from "#/commands/deprecate";
import { undeprecateCommand } from "#/commands/undeprecate";
import { infoCommand } from "#/commands/info";
import { versionsCommand } from "#/commands/versions";
import { outdatedCommand } from "#/commands/outdated";
import { upgradeCommand } from "#/commands/upgrade";
import { versionCommand } from "#/commands/version";
import { changelogCommand } from "#/commands/changelog";
import { workspaceCommand } from "#/commands/workspace";
import { worktreeCommand } from "#/commands/worktree";
import { scanCommand } from "#/commands/scan";
import { trustCommand, untrustCommand } from "#/commands/trust";
import { evalCommand } from "#/commands/eval";
import { dashboardCommand } from "#/commands/dashboard/dashboard";
import { loginCommand } from "#/commands/login";
import { logoutCommand } from "#/commands/logout";
import { whoamiCommand } from "#/commands/whoami";
import { ASCII_LOGO } from "#/constants";
import { colors } from "#/shared/ui/ui";
import pkg from "../package.json";
import { setupUpdateCheck, refreshUpdateCache } from "#/update-check/update-check";

const program = new Command();

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .addHelpText("beforeAll", colors.brand(ASCII_LOGO));

// Auth commands
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);

// Project commands
program.addCommand(initCommand);
program.addCommand(configCommand);
program.addCommand(syncCommand);
program.addCommand(addTargetCommand);
program.addCommand(removeTargetCommand);
program.addCommand(listCommand);
program.addCommand(addCommand);
program.addCommand(installCommand);
program.addCommand(checkCommand);
program.addCommand(removeCommand);

// Registry commands
program.addCommand(packCommand);
program.addCommand(publishCommand);
program.addCommand(deprecateCommand);
program.addCommand(undeprecateCommand);
program.addCommand(infoCommand);
program.addCommand(versionsCommand);
program.addCommand(outdatedCommand);
program.addCommand(upgradeCommand);

// Authoring commands
program.addCommand(versionCommand);
program.addCommand(changelogCommand);

// Workspace commands
program.addCommand(workspaceCommand);

// Worktree commands
program.addCommand(worktreeCommand);

// Security commands
program.addCommand(scanCommand);
program.addCommand(trustCommand);
program.addCommand(untrustCommand);

// Eval commands
program.addCommand(evalCommand);

// Dashboard commands
program.addCommand(dashboardCommand);

setupUpdateCheck(pkg.version);

try {
  await program.parseAsync();
  refreshUpdateCache();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n${colors.error("error:")} ${message}\n`);
  process.exit(1);
}
