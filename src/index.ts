#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "#/commands/init";
import { configCommand } from "#/commands/config";
import { syncCommand } from "#/commands/sync";
import { listCommand } from "#/commands/list";
import { addCommand } from "#/commands/add";

const program = new Command();

program
  .name("grekt")
  .description("CLI for managing AI artifacts (agents, skills, commands)")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(configCommand);
program.addCommand(syncCommand);
program.addCommand(listCommand);
program.addCommand(addCommand);

program.parse();
