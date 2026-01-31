/**
 * Global constants for the Grekt CLI
 */

export const REGISTRY_HOST = "registry.grekt.com";
export const REGISTRY_URL = `https://${REGISTRY_HOST}`;

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
