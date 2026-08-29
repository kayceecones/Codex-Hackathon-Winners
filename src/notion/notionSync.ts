import { Client } from "@notionhq/client";
import type { WorkflowTransition } from "../master/stateMachine.js";
import type { WorkflowEventRecord } from "../contracts/workflow.js";

const { NOTION_TOKEN, NOTION_TIMELINE_DB_ID, NOTION_PLANS_DB_ID, NOTION_REVIEWS_DB_ID } = process.env;

const enabled = Boolean(NOTION_TOKEN);

if (!enabled) {
  console.warn(
    "[notion] NOTION_TOKEN not set - Notion sync is disabled (no-op). Master state transitions still persist normally."
  );
}

const notion = enabled ? new Client({ auth: NOTION_TOKEN }) : null;

// Notion rich_text blocks cap out at 2000 chars each.
function truncate(text: string, max = 1900): string {
  return text.length <= max ? text : text.slice(0, max) + "…";
}

function richText(text: string) {
  return [{ type: "text" as const, text: { content: truncate(text) } }];
}

async function safeCreate(label: string, fn: () => Promise<unknown>) {
  if (!enabled) return;
  try {
    await fn();
  } catch (err) {
    console.error(`[notion] failed to sync ${label}:`, err instanceof Error ? err.message : err);
  }
}

async function logTimelineEvent(record: WorkflowEventRecord) {
  if (!NOTION_TIMELINE_DB_ID) return;
  const summary = [
    `${record.fromState} -> ${record.toState}`,
    record.message,
    record.actor ? `Actor: ${record.actor.name}${record.actor.role ? ` (${record.actor.role})` : ""}` : undefined
  ]
    .filter(Boolean)
    .join("\n");

  await safeCreate("timeline event", () =>
    notion!.pages.create({
      parent: { database_id: NOTION_TIMELINE_DB_ID },
      properties: {
        Name: { title: richText(record.type) },
        Project: { rich_text: richText(record.projectId) },
        Type: { rich_text: richText(record.type) },
        Summary: { rich_text: richText(summary) },
        Timestamp: { date: { start: record.occurredAt } }
      }
    })
  );
}

async function logPlanVersion(projectId: string, plan: NonNullable<WorkflowTransition["created"]["plan"]>) {
  if (!NOTION_PLANS_DB_ID) return;
  const content = [
    `Summary: ${plan.summary}`,
    plan.feedbackAddressed ? `Feedback addressed: ${plan.feedbackAddressed}` : undefined,
    "Steps:",
    ...plan.steps.map((step) => `- ${step.title}: ${step.description}`),
    "Acceptance criteria:",
    ...plan.acceptanceCriteria.map((item) => `- ${item}`)
  ]
    .filter(Boolean)
    .join("\n");

  await safeCreate("plan version", () =>
    notion!.pages.create({
      parent: { database_id: NOTION_PLANS_DB_ID },
      properties: {
        Name: { title: richText(`v${plan.version}: ${plan.title}`) },
        Project: { rich_text: richText(projectId) },
        Version: { number: plan.version },
        Status: { rich_text: richText("awaiting_decision") },
        DiffSummary: { rich_text: richText(plan.feedbackAddressed ?? "") },
        Content: { rich_text: richText(content) }
      }
    })
  );
}

async function logReview(projectId: string, review: NonNullable<WorkflowTransition["created"]["review"]>) {
  if (!NOTION_REVIEWS_DB_ID) return;
  const notes = [
    review.summary,
    ...review.issues.map((issue) => `[${issue.severity}] ${issue.title}: ${issue.detail}`)
  ].join("\n");

  await safeCreate("review", () =>
    notion!.pages.create({
      parent: { database_id: NOTION_REVIEWS_DB_ID },
      properties: {
        Name: { title: richText(review.classification) },
        Project: { rich_text: richText(projectId) },
        Verdict: { rich_text: richText(review.classification) },
        Notes: { rich_text: richText(notes) }
      }
    })
  );
}

export async function syncTransition(transition: WorkflowTransition): Promise<void> {
  await logTimelineEvent(transition.eventRecord);
  if (transition.created.plan) {
    await logPlanVersion(transition.project.id, transition.created.plan);
  }
  if (transition.created.review) {
    await logReview(transition.project.id, transition.created.review);
  }
}
