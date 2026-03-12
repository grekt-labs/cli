import { DashboardReporter } from "#/dashboard/reporter/reporter"
import { warning } from "#/shared/ui/ui"

export { DashboardReporter } from "#/dashboard/reporter/reporter"

export async function syncToDashboard(
  callback: (reporter: DashboardReporter) => Promise<void>,
): Promise<boolean> {
  try {
    const reporter = DashboardReporter.create()

    if (!reporter) {
      return false
    }

    await callback(reporter)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    warning(`Dashboard: ${message}`)
    return false
  }
}
