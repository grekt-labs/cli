#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "#/commands/init";
import { configCommand } from "#/commands/config";
import { syncCommand } from "#/commands/sync";
import { listCommand } from "#/commands/list";
import { addCommand } from "#/commands/add";
import { installCommand } from "#/commands/install";
import { checkCommand } from "#/commands/check";
import { removeCommand } from "#/commands/remove";
import { publishCommand } from "#/commands/publish";
import { deprecateCommand } from "#/commands/deprecate";
import { undeprecateCommand } from "#/commands/undeprecate";
import { infoCommand } from "#/commands/info";
import { versionsCommand } from "#/commands/versions";
import { loginCommand } from "#/commands/login";
import { logoutCommand } from "#/commands/logout";
import { whoamiCommand } from "#/commands/whoami";
import pkg from "../package.json";

const program = new Command();

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version);

// Auth commands
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);

// Project commands
program.addCommand(initCommand);
program.addCommand(configCommand);
program.addCommand(syncCommand);
program.addCommand(listCommand);
program.addCommand(addCommand);
program.addCommand(installCommand);
program.addCommand(checkCommand);
program.addCommand(removeCommand);

// Registry commands
program.addCommand(publishCommand);
program.addCommand(deprecateCommand);
program.addCommand(undeprecateCommand);
program.addCommand(infoCommand);
program.addCommand(versionsCommand);

program.parse();
