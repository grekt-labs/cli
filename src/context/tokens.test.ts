import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createTokenProvider } from "./tokens";

describe("createTokenProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.GREKT_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    delete process.env.GITLAB_TOKEN;
    delete process.env.GL_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("getRegistryToken returns GREKT_TOKEN env var", () => {
    process.env.GREKT_TOKEN = "grk_test123";

    const provider = createTokenProvider("/project", () => undefined);

    expect(provider.getRegistryToken("@scope")).toBe("grk_test123");
  });

  test("getRegistryToken falls back to session token when env var not set", () => {
    const getSessionToken = () => "session-access-token";
    const provider = createTokenProvider("/project", () => undefined, getSessionToken);

    expect(provider.getRegistryToken("@scope")).toBe("session-access-token");
  });

  test("getRegistryToken prefers GREKT_TOKEN over session token", () => {
    process.env.GREKT_TOKEN = "grk_env_token";
    const getSessionToken = () => "session-access-token";
    const provider = createTokenProvider("/project", () => undefined, getSessionToken);

    expect(provider.getRegistryToken("@scope")).toBe("grk_env_token");
  });

  test("getRegistryToken returns undefined when no env var and no session", () => {
    const getSessionToken = () => undefined;
    const provider = createTokenProvider("/project", () => undefined, getSessionToken);

    expect(provider.getRegistryToken("@scope")).toBeUndefined();
  });

  test("getRegistryToken returns undefined when no session getter provided", () => {
    const provider = createTokenProvider("/project", () => undefined);

    expect(provider.getRegistryToken("@scope")).toBeUndefined();
  });

  test("getGitToken uses injected getToken for config lookup", () => {
    const getToken = (name: string, _root: string) => {
      if (name === "github") return "config-github-token";
      return undefined;
    };

    const provider = createTokenProvider("/project", getToken);

    expect(provider.getGitToken("github")).toBe("config-github-token");
  });

  test("getGitToken falls back to GITHUB_TOKEN env var", () => {
    process.env.GITHUB_TOKEN = "env-github-token";

    const provider = createTokenProvider("/project", () => undefined);

    expect(provider.getGitToken("github")).toBe("env-github-token");
  });

  test("getGitToken falls back to GH_TOKEN env var", () => {
    process.env.GH_TOKEN = "env-gh-token";

    const provider = createTokenProvider("/project", () => undefined);

    expect(provider.getGitToken("github")).toBe("env-gh-token");
  });

  test("getGitToken falls back to GITLAB_TOKEN env var", () => {
    process.env.GITLAB_TOKEN = "env-gitlab-token";

    const provider = createTokenProvider("/project", () => undefined);

    expect(provider.getGitToken("gitlab")).toBe("env-gitlab-token");
  });

  test("getGitToken uses host for gitlab config key", () => {
    const getToken = (name: string, _root: string) => {
      if (name === "custom.gitlab.com") return "custom-gitlab-token";
      return undefined;
    };

    const provider = createTokenProvider("/project", getToken);

    expect(provider.getGitToken("gitlab", "custom.gitlab.com")).toBe("custom-gitlab-token");
  });

  test("getGitToken defaults gitlab host to gitlab.com", () => {
    const getToken = (name: string, _root: string) => {
      if (name === "gitlab.com") return "default-gitlab-token";
      return undefined;
    };

    const provider = createTokenProvider("/project", getToken);

    expect(provider.getGitToken("gitlab")).toBe("default-gitlab-token");
  });

  test("config token takes priority over env var", () => {
    process.env.GITHUB_TOKEN = "env-token";
    const getToken = () => "config-token";

    const provider = createTokenProvider("/project", getToken);

    expect(provider.getGitToken("github")).toBe("config-token");
  });
});
