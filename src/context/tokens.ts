import type { TokenProvider } from "@grekt-labs/cli-engine";

type TokenLookup = (name: string, projectRoot: string) => string | undefined;
type SessionTokenGetter = () => string | undefined;

/**
 * Real TokenProvider implementation.
 * Gets tokens from project config and environment variables.
 *
 * Accepts callback functions to avoid importing config/project or auth/session
 * directly, breaking the circular dependency between context and those modules.
 */
export function createTokenProvider(
  projectRoot: string,
  getToken: TokenLookup,
  getSessionToken?: SessionTokenGetter,
): TokenProvider {
  return {
    getRegistryToken: (scope: string) => {
      // Environment variable has highest priority (CI/CD)
      if (process.env.GREKT_TOKEN) {
        return process.env.GREKT_TOKEN;
      }

      // Fall back to stored session token (from grekt login)
      if (getSessionToken) {
        return getSessionToken();
      }

      return undefined;
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
