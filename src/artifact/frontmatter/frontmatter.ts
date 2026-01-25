import matter from "gray-matter";
import { ArtifactFrontmatterSchema, type ArtifactFrontmatter } from "@grekt-labs/cli-engine";

export interface ParsedArtifact {
  frontmatter: ArtifactFrontmatter;
  content: string;
}

export function parseFrontmatter(content: string): ParsedArtifact | null {
  try {
    const { data, content: body } = matter(content);
    const frontmatter = ArtifactFrontmatterSchema.parse(data);
    return { frontmatter, content: body };
  } catch {
    return null;
  }
}
