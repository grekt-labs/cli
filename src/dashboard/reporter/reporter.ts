import { join } from "path"
import type { ProjectConfig, Lockfile, EvalSummary, LocalConfig } from "@grekt/engine"
import { getDashboardConfig } from "#/dashboard/config/config"
import { DashboardClient } from "#/dashboard/client/client"
import { scanArtifact } from "#/context"
import { ARTIFACTS_DIR } from "#/config/paths/paths"
import { warning } from "#/shared/ui/ui"
import {
  mapProjectToRecord,
  mapArtifactToRecord,
  mapElementsToRecords,
  mapEvalRunToRecord,
  mapEvalResultToRecord,
  mapRegistryToRecord,
} from "@grekt/engine"

export class DashboardReporter {
  private client: DashboardClient

  private constructor(client: DashboardClient) {
    this.client = client
  }

  static create(): DashboardReporter | null {
    const config = getDashboardConfig()

    if (!config) {
      return null
    }

    const client = new DashboardClient(config.url, config.token)
    return new DashboardReporter(client)
  }

  async reportProject(
    config: ProjectConfig,
    lockfile: Lockfile,
    projectRoot: string,
  ): Promise<void> {
    const projectName = config.name ?? projectRoot.split("/").pop() ?? "unnamed"
    const projectData = mapProjectToRecord(config, projectRoot)
    const project = await this.client.upsertByFilter(
      "projects",
      `name = "${projectName}"`,
      projectData,
    )

    for (const [artifactId, lockEntry] of Object.entries(lockfile.artifacts)) {
      const artifactDir = join(projectRoot, ARTIFACTS_DIR, artifactId)
      const artifactInfo = scanArtifact(artifactDir)

      const artifactData = mapArtifactToRecord(artifactId, lockEntry, artifactInfo, project.id)
      const projectArtifact = await this.client.upsertByFilter(
        "project_artifacts",
        `project = "${project.id}" && artifact_id = "${artifactId}"`,
        artifactData,
      )

      if (artifactInfo) {
        const elements = mapElementsToRecords(artifactInfo, projectArtifact.id)
        for (const element of elements) {
          await this.client.upsertByFilter(
            "elements",
            `project_artifact = "${projectArtifact.id}" && name = "${element.name}" && type = "${element.type}"`,
            element,
          )
        }
      }
    }
  }

  async reportEval(
    summary: EvalSummary,
    projectName: string,
    triggeredBy: "cli" | "ci",
  ): Promise<void> {
    const project = await this.client.findRecord("projects", `name = "${projectName}"`)

    if (!project) {
      warning(`Dashboard: project "${projectName}" not found, skipping eval report`)
      return
    }

    const evalRunData = mapEvalRunToRecord(summary, project.id, triggeredBy)
    const evalRun = await this.client.createRecord("eval_runs", evalRunData)

    for (const result of summary.results) {
      const projectArtifact = await this.client.findRecord(
        "project_artifacts",
        `project = "${project.id}" && artifact_id = "${result.artifactId}"`,
      )

      if (!projectArtifact) {
        continue
      }

      const resultData = mapEvalResultToRecord(result, evalRun.id, projectArtifact.id)
      await this.client.createRecord("eval_results", resultData)
    }
  }

  async reportRegistries(registries: NonNullable<LocalConfig["registries"]>): Promise<void> {
    for (const [scope, registry] of Object.entries(registries)) {
      const data = mapRegistryToRecord(scope, registry)
      await this.client.upsertByFilter("registries", `scope = "${scope}"`, data)
    }
  }
}
