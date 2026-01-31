import { input, password } from "@inquirer/prompts";
import type { RegistryProvider } from "#/registry/registry.types";

export const gitlabProvider: RegistryProvider = {
  type: "gitlab",
  label: "GitLab",

  async prompts() {
    const host = await input({
      message: "GitLab host (e.g., gitlab.com, gitlab.mycompany.com):",
      validate: (value) => {
        if (!value.trim()) return "Host is required";
        return true;
      },
    });

    const project = await input({
      message: "Project path (e.g., myteam/artifacts):",
      validate: (value) => {
        if (!value.trim()) return "Project path is required";
        if (!value.includes("/")) return "Project path must include namespace (e.g., myteam/artifacts)";
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
