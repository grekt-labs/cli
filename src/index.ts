#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { configCommand } from "./commands/config.js";

const program = new Command();

program
  .name("grekt")
  .description("CLI for managing AI artifacts (agents, skills, commands)")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(configCommand);

program.parse();
