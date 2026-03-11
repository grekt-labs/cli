import type {
  ProjectConfig,
  Lockfile,
  LockfileEntry,
  ArtifactInfo,
  EvalSummary,
  EvalElementResult,
  LocalConfig,
  Category,
} from "@grekt/engine"

const ELEMENT_CATEGORIES: Category[] = ["skills", "agents", "commands", "mcps", "rules", "hooks"]

export function mapProjectToRecord(
  config: ProjectConfig,
  projectRoot: string,
): Record<string, unknown> {
  return {
    name: config.name ?? projectRoot.split("/").pop() ?? "unnamed",
    description: config.description ?? "",
    targets: config.targets,
    default_registry: config.registry ?? "",
    repository: config.repository ?? "",
  }
}

export function mapArtifactToRecord(
  artifactId: string,
  lockEntry: LockfileEntry,
  artifactInfo: ArtifactInfo | null,
  projectId: string,
): Record<string, unknown> {
  const elementCount = artifactInfo
    ? ELEMENT_CATEGORIES.reduce((sum, cat) => sum + artifactInfo[cat].length, 0)
    : 0

  const scope = artifactId.startsWith("@") ? artifactId.split("/")[0] : ""

  return {
    project: projectId,
    artifact_id: artifactId,
    version: lockEntry.version,
    name: artifactInfo?.manifest.name ?? artifactId,
    description: artifactInfo?.manifest.description ?? "",
    mode: lockEntry.mode,
    element_count: elementCount,
    registry_scope: scope,
    registry_url: lockEntry.resolved ?? "",
  }
}

export function mapElementsToRecords(
  artifactInfo: ArtifactInfo,
  projectArtifactId: string,
): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = []

  for (const category of ELEMENT_CATEGORIES) {
    for (const file of artifactInfo[category]) {
      const name = file.parsed.frontmatter["grk-name"] ?? file.path
      records.push({
        project_artifact: projectArtifactId,
        name,
        type: category,
        has_eval: false,
      })
    }
  }

  return records
}

export function mapEvalRunToRecord(
  summary: EvalSummary,
  projectId: string,
  triggeredBy: "cli" | "ci",
): Record<string, unknown> {
  return {
    project: projectId,
    triggered_by: triggeredBy,
    overall_score: summary.overallScore,
    overall_grade: summary.overallGrade,
    total_passed: summary.totalPassed,
    total_tests: summary.totalTests,
    total_issues: summary.totalIssues,
  }
}

export function mapEvalResultToRecord(
  result: EvalElementResult,
  evalRunId: string,
  projectArtifactId: string,
): Record<string, unknown> {
  return {
    eval_run: evalRunId,
    project_artifact: projectArtifactId,
    element_name: result.elementName,
    element_type: result.elementType,
    passed: result.passed,
    total: result.total,
    score: result.score,
    grade: result.grade,
    failures: result.failures,
  }
}

export function mapRegistryToRecord(
  scope: string,
  registry: NonNullable<LocalConfig["registries"]>[string],
): Record<string, unknown> {
  return {
    scope,
    name: scope,
    type: registry.type,
    host: registry.host ?? "",
    url: registry.host ? `https://${registry.host}` : "",
    artifact_count: 0,
  }
}
