import { z } from "zod";

// Sync targets (validated at runtime against registered plugins)
export type SyncTarget = string;

// Artifact manifest (grekt.yaml in each artifact)
export const ArtifactManifestSchema = z.object({
  name: z.string(),
  author: z.string(),
  version: z.string(),
  description: z.string(),
});
export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>;

// Artifact component frontmatter (YAML at top of .md files)
export const ArtifactFrontmatterSchema = z.object({
  type: z.enum(["agent", "skill", "command"]),
  name: z.string(),
  description: z.string(),
  agent: z.string().optional(), // for skills/commands that belong to an agent
});
export type ArtifactFrontmatter = z.infer<typeof ArtifactFrontmatterSchema>;

// Project config (.grekt/config.yaml)
export const ProjectConfigSchema = z.object({
  targets: z.array(z.string()).default([]),
  autoSync: z.boolean().default(false),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// Credentials (~/.grekt/credentials.yaml) - for registry auth
export const CredentialsSchema = z.record(
  z.string(), // registry URL
  z.object({
    token: z.string(),
  })
);
export type Credentials = z.infer<typeof CredentialsSchema>;

// Lockfile entry (grekt.lock)
export const LockfileEntrySchema = z.object({
  version: z.string(),
  checksum: z.string(),
  source: z.string().optional(), // e.g., "github:grekt/artifacts"
});

export const LockfileSchema = z.object({
  version: z.literal(1),
  artifacts: z.record(z.string(), LockfileEntrySchema).default({}),
});
export type Lockfile = z.infer<typeof LockfileSchema>;

// installed.yaml - artifact index
export const InstalledArtifactSchema = z.object({
  version: z.string(),
  agent: z.string().optional(), // relative path to agent.md if exists
  skills: z.array(z.string()).default([]), // relative paths to skill files
  commands: z.array(z.string()).default([]), // relative paths to command files
});

export const InstalledYamlSchema = z.object({
  version: z.literal(1),
  artifacts: z.record(z.string(), InstalledArtifactSchema).default({}),
});
export type InstalledYaml = z.infer<typeof InstalledYamlSchema>;
