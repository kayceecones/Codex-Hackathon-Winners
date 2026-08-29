export type ReviewClassification = 'pass' | 'coding_issue' | 'plan_issue';

export interface ReviewInput {
  filesOrAreas: string[];
  filesChanged: string[];
  tests: { passed: number; failed: number };
  acceptanceCriteria: string[];
}

export interface ReviewResult {
  classification: ReviewClassification;
  detail: string;
}

function isWithinScope(filePath: string, filesOrAreas: string[]): boolean {
  // Person 3's PlanVersion has no file-path-level field (only prose `scope`
  // and `impactedOwners`) - until Person 1 derives real paths for the
  // execution contract, filesOrAreas arrives empty and this check no-ops.
  if (filesOrAreas.length === 0) return true;
  return filesOrAreas.some((area) => {
    const prefix = area.endsWith('/') ? area : `${area}/`;
    return filePath === area || filePath.startsWith(prefix);
  });
}

/**
 * Deterministic-first classification, per CODING_AGENT_PLAN.md §6: reliability
 * over sophistication for a 4-hour build. The plan-issue path is intentionally
 * narrow - it only needs to fire once, reliably, for the demo's recovery path.
 */
export function review(input: ReviewInput): ReviewResult {
  if (input.tests.failed > 0) {
    return { classification: 'coding_issue', detail: `${input.tests.failed} verify check(s) failed.` };
  }

  const outOfScope = input.filesChanged.filter((file) => !isWithinScope(file, input.filesOrAreas));
  if (outOfScope.length > 0) {
    return {
      classification: 'coding_issue',
      detail: `Changed files outside the plan's declared scope: ${outOfScope.join(', ')}.`,
    };
  }

  if (input.acceptanceCriteria.length > 0 && input.filesChanged.length === 0) {
    return {
      classification: 'plan_issue',
      detail: 'Acceptance criteria were given but no files changed - the plan is likely missing a concrete task.',
    };
  }

  return { classification: 'pass', detail: 'All checks passed.' };
}
