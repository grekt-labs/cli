import { z } from "zod";

// Sync targets (validated at runtime against registered plugins)
export type SyncTarget = string;

// Global config (~/.grekt/config.yaml)
export const GlobalConfigSchema = z.object({
  registry: z.string().url().default("https://registry.grekt.com"),
  telemetry: z.boolean().default(true),
  defaultTargets: z.array(z.string()).default([]),
  autoSync: z.boolean().default(false),
});
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

// Project config (.grekt/config.yaml)
export const ProjectConfigSchema = z.object({
  targets: z.array(z.string()).default([]),
  grektsDir: z.string().default("grekts"),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// Credentials (~/.grekt/credentials.yaml)
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
  skills: z.record(z.boolean()).optional(),
  commands: z.record(z.boolean()).optional(),
});

export const LockfileSchema = z.object({
  version: z.literal(1),
  artifacts: z.record(z.string(), LockfileEntrySchema).default({}),
});
export type Lockfile = z.infer<typeof LockfileSchema>;

// installed.yaml structures
export const InstalledAgentSchema = z.object({
  description: z.string().optional(),
  file: z.string(),
  skills: z.array(z.string()).optional(),
  commands: z.array(z.string()).optional(),
});

export const InstalledSkillSchema = z.object({
  description: z.string().optional(),
  file: z.string(),
  used_by: z.string().optional(),
});

export const InstalledCommandSchema = z.object({
  description: z.string().optional(),
  file: z.string().optional(),
  agent: z.string().optional(),
  alias: z.string().optional(),
});

export const InstalledYamlSchema = z.object({
  version: z.literal(1),
  paths: z.object({
    agents: z.string(),
    skills: z.string(),
    commands: z.string(),
  }),
  agents: z.record(z.string(), InstalledAgentSchema).default({}),
  skills: z.record(z.string(), InstalledSkillSchema).default({}),
  commands: z.record(z.string(), InstalledCommandSchema).default({}),
});
export type InstalledYaml = z.infer<typeof InstalledYamlSchema>;
