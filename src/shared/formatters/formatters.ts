/**
 * Format bytes to human readable string.
 *
 * @example formatBytes(500) → "500 B"
 * @example formatBytes(1536) → "1.5 KB"
 * @example formatBytes(1572864) → "1.5 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Estimate token count from byte size.
 * Uses rough approximation: ~4 chars per token, ~1 byte per char for ASCII.
 *
 * @example estimateTokens(4000) → 1000
 */
export function estimateTokens(bytes: number): number {
  return Math.round(bytes / 4);
}

/**
 * Format a number with thousand separators.
 *
 * @example formatNumber(1234567) → "1,234,567"
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

/**
 * Format token count with "~" prefix for estimates.
 *
 * @example formatTokenEstimate(1500) → "~1,500 tokens"
 */
export function formatTokenEstimate(bytes: number): string {
  const tokens = estimateTokens(bytes);
  return `~${formatNumber(tokens)} tokens`;
}
