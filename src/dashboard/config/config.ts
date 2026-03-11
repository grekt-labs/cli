import { dirname, resolve } from "path"
import { parse as parseYaml } from "yaml"
import { z } from "zod"
import { fs } from "#/context"
import { GREKT_DIR } from "#/config/paths/paths"
import type { DashboardConfig } from "./config.types"

const LOCAL_CONFIG_FILE = "config.yaml"

const DASHBOARD_TOKEN_PREFIX = "gdk_"

const DashboardConfigSchema = z.object({
  url: z.string().url(),
  token: z.string().startsWith(DASHBOARD_TOKEN_PREFIX, {
    message: `Dashboard token must start with "${DASHBOARD_TOKEN_PREFIX}"`,
  }),
})

function findLocalConfigPath(startDir: string): string | null {
  let current = resolve(startDir)

  while (true) {
    const configPath = `${current}/${GREKT_DIR}/${LOCAL_CONFIG_FILE}`

    if (fs.exists(configPath)) {
      return configPath
    }

    const parent = dirname(current)
    if (parent === current) {
      return null
    }

    current = parent
  }
}

export function getDashboardConfig(projectRoot: string = process.cwd()): DashboardConfig | null {
  const filepath = findLocalConfigPath(projectRoot)
  if (!filepath) {
    return null
  }

  const content = fs.readFile(filepath)
  if (!content.trim()) {
    return null
  }

  let parsed: unknown
  try {
    parsed = parseYaml(content)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== "object" || !("dashboard" in parsed)) {
    return null
  }

  const result = DashboardConfigSchema.safeParse((parsed as Record<string, unknown>).dashboard)
  if (!result.success) {
    return null
  }

  return result.data
}
