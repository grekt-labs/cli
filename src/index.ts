#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

program
  .name("grekt")
  .description("CLI for managing AI artifacts (agents, skills, commands)")
  .version("0.1.0");

// Commands will be added here
// program.addCommand(initCommand);
// program.addCommand(configCommand);
// program.addCommand(syncCommand);
// program.addCommand(listCommand);
// program.addCommand(addCommand);

program.parse();
