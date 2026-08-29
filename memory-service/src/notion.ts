import { Client } from "@notionhq/client";

const { NOTION_TOKEN, NOTION_TIMELINE_DB_ID, NOTION_PLANS_DB_ID, NOTION_REVIEWS_DB_ID } =
  process.env;

const enabled = Boolean(NOTION_TOKEN);

if (!enabled) {
  console.warn(
    "[notion] NOTION_TOKEN not set — Notion sync is disabled (no-op). DB writes still work normally."
  );
}

const notion = enabled ? new Client({ auth: NOTION_TOKEN }) : null;

// Notion rich_text blocks cap out at 2000 chars each.
function truncate(text: string, max = 1900): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
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

export async function logTimelineEvent(params: {
  projectId: string;
  type: string;
  payload: unknown;
}) {
  if (!NOTION_TIMELINE_DB_ID) return;
  await safeCreate("timeline event", () =>
    notion!.pages.create({
      parent: { database_id: NOTION_TIMELINE_DB_ID },
      properties: {
        Name: { title: richText(params.type) },
        Project: { rich_text: richText(params.projectId) },
        Type: { rich_text: richText(params.type) },
        Summary: { rich_text: richText(JSON.stringify(params.payload ?? {})) },
        Timestamp: { date: { start: new Date().toISOString() } },
      },
    })
  );
}

export async function createPlanVersionPage(params: {
  projectId: string;
  version: number;
  status: string;
  diffSummary?: string | null;
  content: string;
}) {
  if (!NOTION_PLANS_DB_ID) return;
  await safeCreate("plan version", () =>
    notion!.pages.create({
      parent: { database_id: NOTION_PLANS_DB_ID },
      properties: {
        Name: { title: richText(`v${params.version}`) },
        Project: { rich_text: richText(params.projectId) },
        Version: { number: params.version },
        Status: { rich_text: richText(params.status) },
        DiffSummary: { rich_text: richText(params.diffSummary ?? "") },
        Content: { rich_text: richText(params.content) },
      },
    })
  );
}

export async function logReview(params: {
  projectId: string;
  verdict: string;
  notes?: string | null;
}) {
  if (!NOTION_REVIEWS_DB_ID) return;
  await safeCreate("review", () =>
    notion!.pages.create({
      parent: { database_id: NOTION_REVIEWS_DB_ID },
      properties: {
        Name: { title: richText(params.verdict) },
        Project: { rich_text: richText(params.projectId) },
        Verdict: { rich_text: richText(params.verdict) },
        Notes: { rich_text: richText(params.notes ?? "") },
      },
    })
  );
}
