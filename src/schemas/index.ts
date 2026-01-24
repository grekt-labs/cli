import { z } from "zod";

// Sync targets (validated at runtime against registered plugins)
export type SyncTarget = string;

// Artifact manifest (grekt.yaml inside each published artifact)
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

// Custom target configuration (for "Other" option in init)
export const CustomTargetSchema = z.object({
  name: z.string(),
  rulesFile: z.string(),
});
export type CustomTarget = z.infer<typeof CustomTargetSchema>;

// Artifact entry in grekt.yaml - either version string (all) or object (selected components)
export const ArtifactEntrySchema = z.union([
  z.string(), // "1.0.0" = all components
  z.object({
    version: z.string(),
    agent: z.boolean().optional(), // true = include, false/omitted = exclude
    skills: z.array(z.string()).optional(), // paths to include
    commands: z.array(z.string()).optional(), // paths to include
  }),
]);
export type ArtifactEntry = z.infer<typeof ArtifactEntrySchema>;

// Project options (optional settings in grekt.yaml)
export const ProjectOptionsSchema = z.object({
  autoCheck: z.boolean().default(false),
});
export type ProjectOptions = z.infer<typeof ProjectOptionsSchema>;

// Project config (grekt.yaml) - declares which artifacts to install and sync targets
export const ProjectConfigSchema = z.object({
  targets: z.array(z.string()).default([]),
  autoSync: z.boolean().default(false),
  registry: z.string().optional(),
  artifacts: z.record(z.string(), ArtifactEntrySchema).default({}),
  customTargets: z.record(z.string(), CustomTargetSchema).default({}),
  options: ProjectOptionsSchema.default({}),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// S3 credentials for publishing to S3-compatible storage
export const S3CredentialsSchema = z.object({
  type: z.literal("s3"),
  endpoint: z.string(),
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  bucket: z.string(),
  publicUrl: z.string().optional(),
});
export type S3Credentials = z.infer<typeof S3CredentialsSchema>;

// Simple token credentials for git sources (GitHub, GitLab)
export const TokenCredentialsSchema = z.object({
  token: z.string(),
});
export type TokenCredentials = z.infer<typeof TokenCredentialsSchema>;

// API registry credentials (url + token)
export const ApiCredentialsSchema = z.object({
  url: z.string(),
  token: z.string(),
});
export type ApiCredentials = z.infer<typeof ApiCredentialsSchema>;

// Registry credentials - can be S3, token-based, or API-based
export const RegistryCredentialsSchema = z.union([
  S3CredentialsSchema,
  TokenCredentialsSchema,
  ApiCredentialsSchema,
]);
export type RegistryCredentials = z.infer<typeof RegistryCredentialsSchema>;

export const CredentialsSchema = z.record(
  z.string(), // registry name (e.g., "default", "github", "gitlab.com")
  RegistryCredentialsSchema
);
export type Credentials = z.infer<typeof CredentialsSchema>;

// Lockfile entry (grekt.lock) - pinned versions, integrity hashes, and resolved URLs for reproducible installs
export const LockfileEntrySchema = z.object({
  version: z.string(),
  integrity: z.string(), // SHA256 hash of entire artifact
  source: z.string().optional(),
  resolved: z.string().optional(), // Full URL, IMMUTABLE after write
  files: z.record(z.string(), z.string()).default({}), // per-file hashes: { "agent.md": "sha256:abc..." }
  // Component paths (where to find agents/skills/commands in the artifact)
  agent: z.string().optional(), // relative path to agent.md if exists
  skills: z.array(z.string()).default([]), // relative paths to skill files
  commands: z.array(z.string()).default([]), // relative paths to command files
});

export const LockfileSchema = z.object({
  version: z.literal(1),
  artifacts: z.record(z.string(), LockfileEntrySchema).default({}),
});
export type Lockfile = z.infer<typeof LockfileSchema>;
export type LockfileEntry = z.infer<typeof LockfileEntrySchema>;

// Registry artifact metadata (stored in S3 as metadata.json per artifact)
export const ArtifactMetadataSchema = z.object({
  name: z.string(), // Full artifact ID: @author/name
  latest: z.string(), // Latest version
  deprecated: z.record(z.string(), z.string()).default({}), // version -> deprecation message
  createdAt: z.string(), // ISO timestamp
  updatedAt: z.string(), // ISO timestamp
});
export type ArtifactMetadata = z.infer<typeof ArtifactMetadataSchema>;

// Registry entry for local config (.grekt/config.yaml)
export const RegistryEntrySchema = z.object({
  type: z.enum(["gitlab", "github", "default"]),
  project: z.string().optional(), // Required for gitlab/github, validated at runtime
  host: z.string().optional(), // Optional, has defaults (gitlab.com, github.com)
  token: z.string().optional(), // Can also be set via env vars
});
export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;

// Session stored in local config (generated by grekt login)
export const StoredSessionSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number().optional(),
});
export type StoredSession = z.infer<typeof StoredSessionSchema>;

// Tokens for git sources (github, gitlab)
export const TokensSchema = z.record(
  z.string(), // e.g., "github", "gitlab.com", "gitlab.company.com"
  z.string()  // token value
);
export type Tokens = z.infer<typeof TokensSchema>;

// Local config (.grekt/config.yaml) - gitignored, contains registry configs, session, and tokens
export const LocalConfigSchema = z.object({
  // Registry backends for artifacts with scope (@scope/name)
  registries: z.record(
    z.string().regex(/^@/, "Registry scope must start with @"),
    RegistryEntrySchema
  ).optional(),

  // Session for the public registry (grekt login)
  session: StoredSessionSchema.optional(),

  // Tokens for git sources (github:owner/repo, gitlab:owner/repo)
  tokens: TokensSchema.optional(),
});
export type LocalConfig = z.infer<typeof LocalConfigSchema>;
