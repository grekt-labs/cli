import { randomUUID } from "node:crypto";

/**
 * Interface for cryptographic operations.
 * Provides a testable abstraction over Node.js crypto module.
 */
export interface CryptoProvider {
  randomUUID(): string;
}

/**
 * Real CryptoProvider implementation using Node.js crypto.
 */
export function createCryptoProvider(): CryptoProvider {
  return {
    randomUUID,
  };
}

/**
 * Singleton instance for convenience.
 */
export const cryptoProvider = createCryptoProvider();
