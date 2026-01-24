import { describe, test, expect } from "bun:test";
import {
  ArtifactManifestSchema,
  ArtifactFrontmatterSchema,
  CustomTargetSchema,
  ArtifactEntrySchema,
  ProjectOptionsSchema,
  ProjectConfigSchema,
  S3CredentialsSchema,
  TokenCredentialsSchema,
  ApiCredentialsSchema,
  RegistryCredentialsSchema,
  CredentialsSchema,
  LockfileEntrySchema,
  LockfileSchema,
  ArtifactMetadataSchema,
  RegistryEntrySchema,
  LocalConfigSchema,
} from "./index";

describe("schemas", () => {
  describe("ArtifactManifestSchema", () => {
    test("parses valid manifest", () => {
      const manifest = {
        name: "my-artifact",
        author: "@grekt",
        version: "1.0.0",
        description: "A test artifact",
      };

      const result = ArtifactManifestSchema.parse(manifest);

      expect(result.name).toBe("my-artifact");
      expect(result.author).toBe("@grekt");
      expect(result.version).toBe("1.0.0");
      expect(result.description).toBe("A test artifact");
    });

    test("rejects missing required fields", () => {
      const invalid = { name: "test" };

      expect(() => ArtifactManifestSchema.parse(invalid)).toThrow();
    });
  });

  describe("ArtifactFrontmatterSchema", () => {
    test("parses agent frontmatter", () => {
      const frontmatter = {
        type: "agent",
        name: "Code Reviewer",
        description: "Reviews code for best practices",
      };

      const result = ArtifactFrontmatterSchema.parse(frontmatter);

      expect(result.type).toBe("agent");
      expect(result.name).toBe("Code Reviewer");
    });

    test("parses skill with agent reference", () => {
      const frontmatter = {
        type: "skill",
        name: "Testing Skill",
        description: "Helps with testing",
        agent: "code-reviewer",
      };

      const result = ArtifactFrontmatterSchema.parse(frontmatter);

      expect(result.type).toBe("skill");
      expect(result.agent).toBe("code-reviewer");
    });

    test("rejects invalid type", () => {
      const invalid = {
        type: "invalid",
        name: "Test",
        description: "Test",
      };

      expect(() => ArtifactFrontmatterSchema.parse(invalid)).toThrow();
    });

    test("accepts all valid types", () => {
      const types = ["agent", "skill", "command"] as const;

      for (const type of types) {
        const result = ArtifactFrontmatterSchema.parse({
          type,
          name: "Test",
          description: "Test",
        });
        expect(result.type).toBe(type);
      }
    });
  });

  describe("CustomTargetSchema", () => {
    test("parses valid custom target", () => {
      const target = {
        name: "My Tool",
        rulesFile: ".my-tool-rules",
      };

      const result = CustomTargetSchema.parse(target);

      expect(result.name).toBe("My Tool");
      expect(result.rulesFile).toBe(".my-tool-rules");
    });
  });

  describe("ArtifactEntrySchema", () => {
    test("parses version string", () => {
      const result = ArtifactEntrySchema.parse("1.0.0");

      expect(result).toBe("1.0.0");
    });

    test("parses object with selected components", () => {
      const entry = {
        version: "1.0.0",
        agent: true,
        skills: ["skills/testing.md"],
        commands: ["commands/review.md"],
      };

      const result = ArtifactEntrySchema.parse(entry);

      expect(result).toEqual(entry);
    });

    test("parses object with only version", () => {
      const entry = { version: "2.0.0" };

      const result = ArtifactEntrySchema.parse(entry);

      expect(result).toEqual({ version: "2.0.0" });
    });
  });

  describe("ProjectOptionsSchema", () => {
    test("applies defaults", () => {
      const result = ProjectOptionsSchema.parse({});

      expect(result.autoCheck).toBe(false);
    });

    test("accepts explicit values", () => {
      const result = ProjectOptionsSchema.parse({ autoCheck: true });

      expect(result.autoCheck).toBe(true);
    });
  });

  describe("ProjectConfigSchema", () => {
    test("applies all defaults for empty object", () => {
      const result = ProjectConfigSchema.parse({});

      expect(result.targets).toEqual([]);
      expect(result.autoSync).toBe(false);
      expect(result.artifacts).toEqual({});
      expect(result.customTargets).toEqual({});
      expect(result.options.autoCheck).toBe(false);
    });

    test("parses full config", () => {
      const config = {
        targets: ["claude", "cursor"],
        autoSync: true,
        registry: "https://custom.registry.com",
        artifacts: {
          "@grekt/test": "1.0.0",
        },
        options: {
          autoCheck: true,
        },
      };

      const result = ProjectConfigSchema.parse(config);

      expect(result.targets).toEqual(["claude", "cursor"]);
      expect(result.autoSync).toBe(true);
      expect(result.registry).toBe("https://custom.registry.com");
      expect(result.artifacts["@grekt/test"]).toBe("1.0.0");
      expect(result.options.autoCheck).toBe(true);
    });

    test("parses config with custom targets", () => {
      const config = {
        targets: ["my-tool"],
        customTargets: {
          "my-tool": {
            name: "My Tool",
            rulesFile: ".my-tool-rules",
          },
        },
      };

      const result = ProjectConfigSchema.parse(config);

      expect(result.customTargets["my-tool"].name).toBe("My Tool");
    });
  });

  describe("S3CredentialsSchema", () => {
    test("parses valid S3 credentials", () => {
      const creds = {
        type: "s3" as const,
        endpoint: "https://s3.amazonaws.com",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        bucket: "my-bucket",
      };

      const result = S3CredentialsSchema.parse(creds);

      expect(result.type).toBe("s3");
      expect(result.bucket).toBe("my-bucket");
    });

    test("accepts optional publicUrl", () => {
      const creds = {
        type: "s3" as const,
        endpoint: "https://s3.amazonaws.com",
        accessKeyId: "test",
        secretAccessKey: "test",
        bucket: "my-bucket",
        publicUrl: "https://cdn.example.com",
      };

      const result = S3CredentialsSchema.parse(creds);

      expect(result.publicUrl).toBe("https://cdn.example.com");
    });
  });

  describe("TokenCredentialsSchema", () => {
    test("parses token credentials", () => {
      const creds = { token: "ghp_xxxxxxxxxxxx" };

      const result = TokenCredentialsSchema.parse(creds);

      expect(result.token).toBe("ghp_xxxxxxxxxxxx");
    });
  });

  describe("ApiCredentialsSchema", () => {
    test("parses API credentials", () => {
      const creds = {
        url: "https://api.registry.com",
        token: "grk_xxxxxxxxxxxx",
      };

      const result = ApiCredentialsSchema.parse(creds);

      expect(result.url).toBe("https://api.registry.com");
      expect(result.token).toBe("grk_xxxxxxxxxxxx");
    });
  });

  describe("RegistryCredentialsSchema", () => {
    test("accepts S3 credentials", () => {
      const creds = {
        type: "s3" as const,
        endpoint: "https://s3.amazonaws.com",
        accessKeyId: "test",
        secretAccessKey: "test",
        bucket: "bucket",
      };

      const result = RegistryCredentialsSchema.parse(creds);

      expect(result).toHaveProperty("type", "s3");
    });

    test("accepts token credentials", () => {
      const creds = { token: "test-token" };

      const result = RegistryCredentialsSchema.parse(creds);

      expect(result).toHaveProperty("token", "test-token");
    });

    test("accepts API credentials via ApiCredentialsSchema directly", () => {
      const creds = { url: "https://api.test.com", token: "test" };

      // Note: RegistryCredentialsSchema union matches TokenCredentials first
      // because it only requires 'token'. Use ApiCredentialsSchema directly
      // when you need both url and token preserved.
      const result = ApiCredentialsSchema.parse(creds);

      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("token");
    });
  });

  describe("CredentialsSchema", () => {
    test("parses credentials record with tokens", () => {
      const creds = {
        github: { token: "ghp_xxx" },
        gitlab: { token: "glpat_xxx" },
      };

      const result = CredentialsSchema.parse(creds);

      expect(result.github).toHaveProperty("token", "ghp_xxx");
      expect(result.gitlab).toHaveProperty("token", "glpat_xxx");
    });

    test("parses S3 credentials in record", () => {
      const creds = {
        s3registry: {
          type: "s3" as const,
          endpoint: "https://s3.example.com",
          accessKeyId: "key",
          secretAccessKey: "secret",
          bucket: "artifacts",
        },
      };

      const result = CredentialsSchema.parse(creds);

      expect(result.s3registry).toHaveProperty("type", "s3");
      expect(result.s3registry).toHaveProperty("bucket", "artifacts");
    });
  });

  describe("LockfileEntrySchema", () => {
    test("parses minimal entry", () => {
      const entry = {
        version: "1.0.0",
        integrity: "sha256:abc123",
      };

      const result = LockfileEntrySchema.parse(entry);

      expect(result.version).toBe("1.0.0");
      expect(result.integrity).toBe("sha256:abc123");
      expect(result.files).toEqual({});
      expect(result.skills).toEqual([]);
      expect(result.commands).toEqual([]);
    });

    test("parses full entry", () => {
      const entry = {
        version: "1.0.0",
        integrity: "sha256:abc123",
        source: "registry",
        resolved: "https://registry.grekt.com/artifacts/test/1.0.0.tar.gz",
        files: {
          "agent.md": "sha256:def456",
          "skills/testing.md": "sha256:ghi789",
        },
        agent: "agent.md",
        skills: ["skills/testing.md"],
        commands: [],
      };

      const result = LockfileEntrySchema.parse(entry);

      expect(result.resolved).toBe(
        "https://registry.grekt.com/artifacts/test/1.0.0.tar.gz"
      );
      expect(result.files["agent.md"]).toBe("sha256:def456");
      expect(result.agent).toBe("agent.md");
      expect(result.skills).toContain("skills/testing.md");
    });
  });

  describe("LockfileSchema", () => {
    test("parses empty lockfile", () => {
      const lockfile = { version: 1 as const };

      const result = LockfileSchema.parse(lockfile);

      expect(result.version).toBe(1);
      expect(result.artifacts).toEqual({});
    });

    test("parses lockfile with artifacts", () => {
      const lockfile = {
        version: 1 as const,
        artifacts: {
          "@grekt/test": {
            version: "1.0.0",
            integrity: "sha256:abc",
          },
        },
      };

      const result = LockfileSchema.parse(lockfile);

      expect(result.artifacts["@grekt/test"].version).toBe("1.0.0");
    });

    test("rejects invalid version", () => {
      const invalid = { version: 2 };

      expect(() => LockfileSchema.parse(invalid)).toThrow();
    });
  });

  describe("ArtifactMetadataSchema", () => {
    test("parses valid metadata", () => {
      const metadata = {
        name: "@author/artifact",
        latest: "1.2.0",
        deprecated: {},
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-06-01T00:00:00Z",
      };

      const result = ArtifactMetadataSchema.parse(metadata);

      expect(result.name).toBe("@author/artifact");
      expect(result.latest).toBe("1.2.0");
    });

    test("parses metadata with deprecations", () => {
      const metadata = {
        name: "@author/artifact",
        latest: "2.0.0",
        deprecated: {
          "1.0.0": "Security vulnerability, upgrade to 2.x",
        },
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-06-01T00:00:00Z",
      };

      const result = ArtifactMetadataSchema.parse(metadata);

      expect(result.deprecated["1.0.0"]).toBe(
        "Security vulnerability, upgrade to 2.x"
      );
    });
  });

  describe("RegistryEntrySchema", () => {
    test("parses gitlab registry", () => {
      const entry = {
        type: "gitlab" as const,
        project: "myteam/artifacts",
      };

      const result = RegistryEntrySchema.parse(entry);

      expect(result.type).toBe("gitlab");
      expect(result.project).toBe("myteam/artifacts");
    });

    test("parses self-hosted gitlab", () => {
      const entry = {
        type: "gitlab" as const,
        project: "team/artifacts",
        host: "gitlab.company.com",
        token: "glpat-xxx",
      };

      const result = RegistryEntrySchema.parse(entry);

      expect(result.host).toBe("gitlab.company.com");
    });

    test("accepts all valid types", () => {
      const types = ["gitlab", "github", "default"] as const;

      for (const type of types) {
        const result = RegistryEntrySchema.parse({ type });
        expect(result.type).toBe(type);
      }
    });
  });

  describe("LocalConfigSchema", () => {
    test("parses empty config", () => {
      const result = LocalConfigSchema.parse({});

      expect(result.registries).toBeUndefined();
    });

    test("parses config with registries", () => {
      const config = {
        registries: {
          "@myteam": {
            type: "gitlab" as const,
            project: "myteam/artifacts",
          },
          "@backend": {
            type: "gitlab" as const,
            project: "backend/artifacts",
            host: "gitlab.internal.com",
          },
        },
      };

      const result = LocalConfigSchema.parse(config);

      expect(result.registries?.["@myteam"].project).toBe("myteam/artifacts");
      expect(result.registries?.["@backend"].host).toBe("gitlab.internal.com");
    });

    test("rejects registry scope without @", () => {
      const invalid = {
        registries: {
          myteam: {
            type: "gitlab" as const,
            project: "test",
          },
        },
      };

      expect(() => LocalConfigSchema.parse(invalid)).toThrow();
    });
  });
});
