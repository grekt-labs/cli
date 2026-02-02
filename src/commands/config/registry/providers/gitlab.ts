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
      message: "Project path (namespace/project):",
      validate: (value) => {
        if (!value.trim()) return "Project path is required";
        if (!value.includes("/")) return "Must include namespace, e.g., myteam/artifacts";
        return true;
      },
    });

    const token = await password({
      message: "GitLab token (optional, can use GITLAB_TOKEN env var):",
      mask: "*",
    });

    return {
      host,
      project,
      token: token || undefined,
    };
  },
};
