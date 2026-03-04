/**
 * Terminal output for eval results.
 */

import { colors, symbols, log, newline } from "#/shared/ui/ui";
import type { EvalSummary, EvalElementResult, EvalGrade } from "@grekt/engine";

function gradeColor(grade: EvalGrade): (text: string) => string {
  switch (grade) {
    case "A":
    case "B":
      return colors.success;
    case "C":
    case "D":
      return colors.warning;
    case "F":
    default:
      return colors.error;
  }
}

function formatDots(name: string, maxWidth: number): string {
  const dotsNeeded = maxWidth - name.length;
  const dots = dotsNeeded > 2 ? " " + ".".repeat(dotsNeeded - 2) + " " : " ";
  return colors.dim(dots);
}

export function displaySummary(summary: EvalSummary): void {
  // Group results by artifact
  const byArtifact = new Map<string, EvalElementResult[]>();
  for (const result of summary.results) {
    const existing = byArtifact.get(result.artifactId) ?? [];
    existing.push(result);
    byArtifact.set(result.artifactId, existing);
  }

  // Find max element path width for alignment
  const maxNameWidth = Math.max(
    ...summary.results.map((r) => `${r.elementType}/${r.elementName}`.length),
    20,
  );

  for (const [artifactId, results] of byArtifact) {
    log(colors.bold(artifactId));

    for (const result of results) {
      const elementPath = `${result.elementType}/${result.elementName}`;
      const dots = formatDots(elementPath, maxNameWidth);
      const passText = `${result.passed}/${result.total} passed`;
      const gradeText = gradeColor(result.grade)(result.grade);

      log(`  ${elementPath}${dots}${passText}  ${gradeText}`);
    }

    newline();
  }

  // Overall
  const overallColor = gradeColor(summary.overallGrade);
  log(`Overall: ${overallColor(summary.overallGrade)} (${summary.overallScore}/100)`);

  if (summary.totalIssues > 0) {
    log(`${summary.totalIssues} issue${summary.totalIssues === 1 ? "" : "s"} found`);
    log(`Run ${colors.highlight("grekt eval --details")} for more info`);
  }
}

export function displayDetails(summary: EvalSummary): void {
  displaySummary(summary);

  const failingResults = summary.results.filter((r) => r.failures.length > 0);
  if (failingResults.length === 0) return;

  newline();
  log(colors.bold("Failures:"));
  newline();

  for (const result of failingResults) {
    log(`  ${colors.bold(`${result.elementType}/${result.elementName}`)} (${result.artifactId})`);

    for (const failure of result.failures) {
      log(`    ${symbols.error} ${failure.testDescription}`);
      log(`      ${colors.dim("assertion:")} ${failure.assertionType}`);
      if (failure.expected) {
        log(`      ${colors.dim("expected:")} ${failure.expected}`);
      }
      if (failure.actual) {
        log(`      ${colors.dim("actual:")}   ${failure.actual}`);
      }
    }

    newline();
  }
}

export function displayJson(summary: EvalSummary): void {
  log(JSON.stringify(summary, null, 2));
}
