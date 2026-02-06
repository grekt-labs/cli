/**
 * URL security validation utilities.
 * Prevents SSRF attacks by blocking requests to private/internal networks.
 */

/**
 * IPv4 private and special-use ranges that should be blocked.
 * These could be used in SSRF attacks to access internal services.
 */
const BLOCKED_IPV4_PATTERNS = [
  /^127\./,                          // Loopback (127.0.0.0/8)
  /^10\./,                           // Private Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2[0-9]|3[01])\./,   // Private Class B (172.16.0.0/12)
  /^192\.168\./,                     // Private Class C (192.168.0.0/16)
  /^169\.254\./,                     // Link-local (169.254.0.0/16) - AWS/cloud metadata
  /^0\./,                            // Current network (0.0.0.0/8)
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // Carrier-grade NAT (100.64.0.0/10)
  /^192\.0\.0\./,                    // IETF Protocol Assignments (192.0.0.0/24)
  /^192\.0\.2\./,                    // Documentation (TEST-NET-1)
  /^198\.51\.100\./,                 // Documentation (TEST-NET-2)
  /^203\.0\.113\./,                  // Documentation (TEST-NET-3)
  /^224\./,                          // Multicast (224.0.0.0/4)
  /^240\./,                          // Reserved (240.0.0.0/4)
];

/**
 * Hostnames that should always be blocked.
 */
const BLOCKED_HOSTNAMES = [
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",  // GCP metadata
  "metadata",                  // Generic cloud metadata
];

/**
 * Cloud provider metadata IP addresses.
 * These are common targets for SSRF attacks.
 */
const CLOUD_METADATA_IPS = [
  "169.254.169.254",  // AWS, GCP, Azure, DigitalOcean
  "fd00:ec2::254",    // AWS IMDSv2 IPv6
];

export interface UrlValidationResult {
  safe: boolean;
  reason?: string;
}

/**
 * Check if a hostname resolves to a blocked IP pattern.
 */
function isBlockedIPv4(hostname: string): boolean {
  return BLOCKED_IPV4_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Check if hostname is explicitly blocked.
 */
function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return BLOCKED_HOSTNAMES.includes(normalized);
}

/**
 * Check if hostname is a cloud metadata endpoint.
 */
function isCloudMetadataIP(hostname: string): boolean {
  return CLOUD_METADATA_IPS.includes(hostname);
}

/**
 * Check if hostname looks like an IPv6 address.
 * Basic check - if it contains colons and is wrapped in brackets or raw.
 */
function isIPv6(hostname: string): boolean {
  // Remove brackets if present
  const cleaned = hostname.replace(/^\[|\]$/g, "");
  return cleaned.includes(":");
}

/**
 * Check if IPv6 address is private/local.
 */
function isPrivateIPv6(hostname: string): boolean {
  const cleaned = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  // Loopback ::1
  if (cleaned === "::1" || cleaned === "0:0:0:0:0:0:0:1") {
    return true;
  }

  // Link-local fe80::/10
  if (cleaned.startsWith("fe80:") || cleaned.startsWith("fe8") ||
      cleaned.startsWith("fe9") || cleaned.startsWith("fea") ||
      cleaned.startsWith("feb")) {
    return true;
  }

  // Unique local fc00::/7 (includes fd00::/8)
  if (cleaned.startsWith("fc") || cleaned.startsWith("fd")) {
    return true;
  }

  return false;
}

/**
 * Validate that a URL is safe to fetch.
 * Blocks private IPs, localhost, and cloud metadata endpoints.
 *
 * @param url - The URL to validate
 * @returns Validation result with safe flag and optional reason
 */
export function validateDownloadUrl(url: string): UrlValidationResult {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, reason: "Invalid URL format" };
  }

  // Only allow HTTP and HTTPS
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `Blocked protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname;

  // Check explicitly blocked hostnames
  if (isBlockedHostname(hostname)) {
    return { safe: false, reason: `Blocked hostname: ${hostname}` };
  }

  // Check cloud metadata IPs
  if (isCloudMetadataIP(hostname)) {
    return { safe: false, reason: "Blocked: cloud metadata endpoint" };
  }

  // Check IPv6
  if (isIPv6(hostname)) {
    if (isPrivateIPv6(hostname)) {
      return { safe: false, reason: "Blocked: private IPv6 address" };
    }
    // Allow other IPv6 addresses
    return { safe: true };
  }

  // Check IPv4 private ranges
  if (isBlockedIPv4(hostname)) {
    return { safe: false, reason: `Blocked: private IP range (${hostname})` };
  }

  return { safe: true };
}

/**
 * Default timeout for download requests in milliseconds.
 */
export const DEFAULT_DOWNLOAD_TIMEOUT_MS = 30_000;
