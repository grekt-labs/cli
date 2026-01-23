import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { parse } from "yaml";
import { ArtifactManifestSchema, type ArtifactManifest } from "#/schemas/index";
import { parseFrontmatter, type ParsedArtifact } from "#/lib/frontmatter";

export interface ArtifactInfo {
  manifest: ArtifactManifest;
  agent?: { path: string; parsed: ParsedArtifact };
  skills: { path: string; parsed: ParsedArtifact }[];
  commands: { path: string; parsed: ParsedArtifact }[];
}

function readArtifactManifest(artifactDir: string): ArtifactManifest | null {
  const manifestPath = join(artifactDir, "grekt.yaml");
  if (!existsSync(manifestPath)) return null;

  try {
    const content = readFileSync(manifestPath, "utf-8");
    const raw = parse(content);
    return ArtifactManifestSchema.parse(raw);
  } catch {
    return null;
  }
}

export function scanArtifact(artifactDir: string): ArtifactInfo | null {
  const manifest = readArtifactManifest(artifactDir);
  if (!manifest) return null;

  const info: ArtifactInfo = {
    manifest,
    skills: [],
    commands: [],
  };

  // Scan for .md files recursively
  const mdFiles = findMdFiles(artifactDir);

  for (const filePath of mdFiles) {
    const content = readFileSync(filePath, "utf-8");
    const parsed = parseFrontmatter(content);

    if (!parsed) continue;

    const relativePath = relative(artifactDir, filePath);

    switch (parsed.frontmatter.type) {
      case "agent":
        info.agent = { path: relativePath, parsed };
        break;
      case "skill":
        info.skills.push({ path: relativePath, parsed });
        break;
      case "command":
        info.commands.push({ path: relativePath, parsed });
        break;
    }
  }

  return info;
}

function findMdFiles(dir: string): string[] {
  const results: string[] = [];

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...findMdFiles(fullPath));
    } else if (entry.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results;
}

export function getArtifactId(author: string, name: string): string {
  return `@${author}/${name}`;
}
