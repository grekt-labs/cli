import type { Scanner } from "#/security/security.types"
import { agentverusScanner } from "./agentverus/agentverus"
import { aguaraScanner } from "./aguara/aguara"

/**
 * All registered scanners.
 * Add new scanners here to include them in the scan pipeline.
 */
export const registeredScanners: Scanner[] = [
  agentverusScanner,
  aguaraScanner,
]
