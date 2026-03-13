import { input, password, select } from "@inquirer/prompts";
import type { RegistryProvider } from "#/registry/registry.types";

const DEFAULT_HOST = "gitlab.com";

export const gitlabProvider: RegistryProvider = {
  type: "gitlab",
  label: "GitLab",

  async prompts() {
    const hostChoice = await select({
      message: "GitLab host:",
      choices: [
        { name: "gitlab.com", value: DEFAULT_HOST },
        { name: "Self-hosted (custom URL)", value: "custom" },
      ],
    });

    let host = DEFAULT_HOST;
    if (hostChoice === "custom") {
      host = await input({
        message: "GitLab URL:",
        validate: (value) => {
          if (!value.trim()) return "URL is required";
          return true;
        },
      });
    }

    const project = await input({
      message: "Repository (owner/repo, e.g. grekt-labs/artifacts):",
      validate: (value) => {
        if (!value.trim()) return "Repository is required";
        if (!value.includes("/")) return "Must be owner/repo, e.g. grekt-labs/artifacts";
        return true;
      },
    });

    const token = await password({
      message: "GitLab token (required, can be set later in .grekt/config.yaml):",
      mask: "*",
    });

    return {
      host,
      project,
      token: token || undefined,
    };
  },
};
