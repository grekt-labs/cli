import { Command } from "commander"
import { requireInitialized } from "#/shared/guards/guards"
import { getConfig, getLocalConfig, getProjectName } from "#/config/project/project"
import { getLockfile } from "#/context"
import { syncToDashboard } from "#/dashboard/dashboard"
import { readAndConsumeScanReport, readAndConsumeEvalReport } from "#/dashboard/reports/reports"
import { success, info, warning, log, newline, colors } from "#/shared/ui/ui"

async function handleSyncRegistries(): Promise<void> {
  const localConfig = getLocalConfig()
  const registries = localConfig?.registries

  if (!registries || Object.keys(registries).length === 0) {
    info("No registries configured. Nothing to sync.")
    return
  }

  let syncedCount = 0

  const synced = await syncToDashboard(async (reporter) => {
    syncedCount = await reporter.reportRegistries(registries)
  })

  if (synced && syncedCount > 0) {
    newline()
    success(`Synced ${syncedCount} ${syncedCount === 1 ? "registry" : "registries"} to dashboard.`)
  }
}

async function handleFullSync(): Promise<void> {
  const projectRoot = process.cwd()
  requireInitialized(projectRoot)

  const config = getConfig(projectRoot)
  const lockfile = getLockfile(projectRoot)
  const projectName = getProjectName(projectRoot)
  const localConfig = getLocalConfig(projectRoot)
  const artifactIds = Object.keys(lockfile.artifacts)

  const scanReport = readAndConsumeScanReport(projectRoot)
  const evalReport = readAndConsumeEvalReport(projectRoot)

  const synced = await syncToDashboard(async (reporter) => {
    // 1. Sync project + artifacts
    await reporter.reportProject(config, lockfile, projectRoot)
    log(`  ${colors.success("✓")} Project and ${artifactIds.length} artifact${artifactIds.length === 1 ? "" : "s"}`)

    // 2. Sync registries (if configured)
    const registries = localConfig?.registries
    if (registries && Object.keys(registries).length > 0) {
      const registryCount = await reporter.reportRegistries(registries)
      if (registryCount > 0) {
        log(`  ${colors.success("✓")} ${registryCount} ${registryCount === 1 ? "registry" : "registries"}`)
      }
    }

    // 3. Consume scan report
    if (scanReport) {
      await reporter.reportScan(
        scanReport.projectName,
        scanReport.results,
        scanReport.triggeredBy,
        scanReport.scanner,
      )
      log(`  ${colors.success("✓")} Scan results (${scanReport.results.length} artifact${scanReport.results.length === 1 ? "" : "s"})`)
    }

    // 4. Consume eval report
    if (evalReport) {
      await reporter.reportEval(
        evalReport.summary,
        evalReport.projectName,
        evalReport.triggeredBy,
      )
      log(`  ${colors.success("✓")} Eval results`)
    }

    // 5. Reconcile stale artifacts
    const removedCount = await reporter.reconcileArtifacts(projectName, artifactIds)
    if (removedCount > 0) {
      log(`  ${colors.success("✓")} Reconciled: removed ${removedCount} stale artifact${removedCount === 1 ? "" : "s"}`)
    }
  })

  if (synced) {
    newline()
    success("Dashboard sync complete.")
  } else {
    warning("Dashboard sync skipped (not configured or failed).")
  }
}

export const dashboardSyncCommand = new Command("sync")
  .description("Sync local data to the dashboard")
  .argument("[target]", "What to sync (omit for full sync, or 'registries' for registries only)")
  .action(async (target?: string) => {
    if (target === "registries") {
      await handleSyncRegistries()
      return
    }

    if (target && target !== "registries") {
      throw new Error(`Unknown sync target: "${target}". Available targets: registries`)
    }

    await handleFullSync()
  })
