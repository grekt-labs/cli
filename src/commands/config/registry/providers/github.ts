import { input, password } from "@inquirer/prompts";
import type { RegistryProvider } from "#/registry/registry.types";

export const githubProvider: RegistryProvider = {
  type: "github",
  label: "GitHub",

  async prompts() {
    const host = await input({
      message: "GitHub host (e.g., github.com, github.mycompany.com):",
      validate: (value) => {
        if (!value.trim()) return "Host is required";
        return true;
      },
    });

    const project = await input({
      message: "Repository (e.g., myorg/artifacts):",
      validate: (value) => {
        if (!value.trim()) return "Repository is required";
        if (!value.includes("/")) return "Repository must include owner (e.g., myorg/artifacts)";
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
