import { input, password } from "@inquirer/prompts";
import type { RegistryProvider } from "#/registry/registry.types";

export const githubProvider: RegistryProvider = {
  type: "github",
  label: "GitHub",

  async prompts() {
    const hostInput = await input({
      message: "GitHub Container Registry host (leave empty for ghcr.io):",
    });

    const host = hostInput.trim() || "ghcr.io";

    const project = await input({
      message: "Namespace (your GitHub username or org, e.g., myorg):",
      validate: (value) => {
        if (!value.trim()) return "Namespace is required";
        return true;
      },
    });

    const token = await password({
      message: "GitHub token (optional, can use GITHUB_TOKEN env var):",
      mask: "*",
    });

    return {
      host,
      project,
      token: token || undefined,
    };
  },
};
