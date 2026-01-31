import { input, password } from "@inquirer/prompts";
import type { RegistryProvider } from "#/registry/registry.types";

export const gitlabProvider: RegistryProvider = {
  type: "gitlab",
  label: "GitLab",

  async prompts() {
    const hostInput = await input({
      message: "GitLab host (leave empty for gitlab.com):",
    });

    const host = hostInput.trim() || "gitlab.com";

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
