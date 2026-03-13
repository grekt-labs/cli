import { input, password, select } from "@inquirer/prompts";
import type { RegistryProvider } from "#/registry/registry.types";

const DEFAULT_HOST = "ghcr.io";

export const githubProvider: RegistryProvider = {
  type: "github",
  label: "GitHub",

  async prompts() {
    const hostChoice = await select({
      message: "GitHub host:",
      choices: [
        { name: "ghcr.io", value: DEFAULT_HOST },
        { name: "GitHub Enterprise (custom URL)", value: "custom" },
      ],
    });

    let host = DEFAULT_HOST;
    if (hostChoice === "custom") {
      host = await input({
        message: "GitHub Enterprise URL:",
        validate: (value) => {
          if (!value.trim()) return "URL is required";
          return true;
        },
      });
    }

    const project = await input({
      message: "Owner (username or org, e.g. grekt-labs):",
      validate: (value) => {
        if (!value.trim()) return "Owner is required";
        return true;
      },
    });

    const token = await password({
      message: "GitHub token (required, can be set later in .grekt/config.yaml):",
      mask: "*",
    });

    return {
      host,
      project,
      token: token || undefined,
    };
  },
};
