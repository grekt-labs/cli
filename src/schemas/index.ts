import { z } from "zod";

// Sync targets (validated at runtime against registered plugins)
export type SyncTarget = string;

// Artifact manifest (grekt.yaml in each artifact package)
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

// Project grekt.yaml (like package.json: config + artifact declarations)
export const GrektYamlSchema = z.object({
  targets: z.array(z.string()).default([]),
  autoSync: z.boolean().default(false),
  registry: z.string().optional(),
  artifacts: z.record(z.string(), ArtifactEntrySchema).default({}),
  customTargets: z.record(z.string(), CustomTargetSchema).default({}),
});
export type GrektYaml = z.infer<typeof GrektYamlSchema>;

// Registry credentials (~/.grekt/credentials.yaml) - for publish auth
export const RegistryCredentialsSchema = z.object({
  type: z.enum(["s3"]).default("s3"),
  endpoint: z.string(),
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  bucket: z.string(),
  publicUrl: z.string().optional(),
});
export type RegistryCredentials = z.infer<typeof RegistryCredentialsSchema>;

export const CredentialsSchema = z.record(
  z.string(), // registry URL or name
  RegistryCredentialsSchema
);
export type Credentials = z.infer<typeof CredentialsSchema>;

// Lockfile entry (grekt.lock) - like package-lock.json: exact versions + paths + integrity
export const LockfileEntrySchema = z.object({
  version: z.string(),
  integrity: z.string(), // SHA256 hash of entire artifact
  source: z.string().optional(),
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
