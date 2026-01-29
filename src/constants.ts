/**
 * Global constants for the Grekt CLI
 */

export const REGISTRY_HOST = "registry.grekt.com";
export const REGISTRY_URL = `https://${REGISTRY_HOST}`;

// Regex to parse artifact ID: @scope/name or @scope/name@version
export const ARTIFACT_ID_REGEX = /^(@[^@/]+)\/([^@]+)(?:@(.+))?$/;

// ASCII logo for CLI branding
export const ASCII_LOGO = `
  ██████╗ ██████╗ ███████╗██╗  ██╗████████╗
 ██╔════╝ ██╔══██╗██╔════╝██║ ██╔╝╚══██╔══╝
 ██║  ███╗██████╔╝█████╗  █████╔╝    ██║
 ██║   ██║██╔══██╗██╔══╝  ██╔═██╗    ██║
 ╚██████╔╝██║  ██║███████╗██║  ██╗   ██║
  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝
`;
