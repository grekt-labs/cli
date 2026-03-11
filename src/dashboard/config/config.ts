import type { DashboardConfig } from "@grekt/engine"
import { getLocalConfig } from "#/config/project/project"

export function getDashboardConfig(projectRoot: string = process.cwd()): DashboardConfig | null {
  const localConfig = getLocalConfig(projectRoot)
  return localConfig?.dashboard ?? null
}
