import type { TokenProvider } from "@grekt-labs/cli-engine";

type TokenLookup = (name: string, projectRoot: string) => string | undefined;

/**
 * Real TokenProvider implementation.
 * Gets tokens from project config and environment variables.
 *
 * Accepts a token lookup function to avoid importing config/project directly,
 * breaking the circular dependency between context and config.
 */
export function createTokenProvider(projectRoot: string, getToken: TokenLookup): TokenProvider {
  return {
    getRegistryToken: (scope: string) => {
      // Registry tokens from env var (highest priority for CI/CD)
      return process.env.GREKT_TOKEN;
    },
    getGitToken: (type: "github" | "gitlab", host?: string) => {
      // First check project config (.grekt/config.yaml tokens section)
      const key = type === "github" ? "github" : (host || "gitlab.com");
      const configToken = getToken(key, projectRoot);
      if (configToken) return configToken;

      // Fall back to platform env vars
      if (type === "github") {
        return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      }
      if (type === "gitlab") {
        return process.env.GITLAB_TOKEN || process.env.GL_TOKEN;
      }

      return undefined;
    },
  };
}
