/**
 * Global constants for the Grekt CLI
 */

export const REGISTRY_HOST = "registry.grekt.com";
export const REGISTRY_URL = `https://${REGISTRY_HOST}`;

// Supabase configuration (public, safe to expose)
// These are the defaults for the official grekt registry
// Can be overridden via GREKT_SUPABASE_URL and GREKT_SUPABASE_ANON_KEY env vars
export const SUPABASE_PROJECT_URL = "https://pnykoffibrjhfamqfgzt.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBueWtvZmZpYnJqaGZhbXFmZ3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNDEyMjEsImV4cCI6MjA4NTgxNzIyMX0._13xa56wSXZ6wklygVUraZYY8IA5at1lJqaPvaUoC-s";

// Regex to parse artifact ID: @scope/name or @scope/name@version
// Strict regex: lowercase alphanumeric with hyphens, must start/end with alphanumeric
// Breaking change: rejects uppercase or special characters in scope/name
export const ARTIFACT_ID_REGEX = /^@?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?:@(.+))?$/;

// ASCII logo for CLI branding
export const ASCII_LOGO = `
  ██████╗ ██████╗ ███████╗██╗  ██╗████████╗
 ██╔════╝ ██╔══██╗██╔════╝██║ ██╔╝╚══██╔══╝
 ██║  ███╗██████╔╝█████╗  █████╔╝    ██║
 ██║   ██║██╔══██╗██╔══╝  ██╔═██╗    ██║
 ╚██████╔╝██║  ██║███████╗██║  ██╗   ██║
  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝
`;
