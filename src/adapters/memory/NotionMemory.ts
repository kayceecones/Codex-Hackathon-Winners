/**
 * Read-only view of the Notion project memory.
 *
 * Per docs/MEMORY_ADAPTER.md the database is the operational source of truth
 * and Notion is the human-readable history, so nothing here writes and
 * nothing here feeds the state machine. It exists so the workspace can show
 * the durable record of a project after the in-memory store has moved on.
 *
 * Uses the REST API directly: one dependency-free POST per database.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface MemoryEvent {
  name: string;
  projectId: string;
  type: string;
  summary: string;
  at?: string;
}

export interface MemoryPlan {
  name: string;
  projectId: string;
  version: number;
  status: string;
  diffSummary: string;
  content: string;
}

export interface MemoryProject {
  projectId: string;
  events: number;
  latestType: string;
  latestAt?: string;
}

/** Minimal shapes of the Notion property types this reader touches. */
interface NotionProp {
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  number?: number | null;
  date?: { start?: string } | null;
}
interface NotionPage { properties?: Record<string, NotionProp> }
interface NotionQueryResponse { results?: NotionPage[]; has_more?: boolean; next_cursor?: string | null }

const text = (p?: NotionProp): string =>
  (p?.title ?? p?.rich_text ?? []).map((t) => t.plain_text).join("").trim();

export interface NotionMemoryConfig {
  token?: string;
  timelineDbId?: string;
  plansDbId?: string;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class NotionMemory {
  private readonly token?: string;
  private readonly timelineDbId?: string;
  private readonly plansDbId?: string;
  private readonly doFetch: typeof fetch;

  constructor(config: NotionMemoryConfig = {}) {
    this.token = config.token ?? process.env.NOTION_TOKEN;
    this.timelineDbId = config.timelineDbId ?? process.env.NOTION_TIMELINE_DB_ID;
    this.plansDbId = config.plansDbId ?? process.env.NOTION_PLANS_DB_ID;
    this.doFetch = config.fetchImpl ?? fetch;
  }

  get enabled(): boolean {
    return Boolean(this.token && (this.timelineDbId || this.plansDbId));
  }

  /** Which databases are wired up, for the status endpoint. */
  describe(): { enabled: boolean; timeline: boolean; plans: boolean } {
    return {
      enabled: this.enabled,
      timeline: Boolean(this.token && this.timelineDbId),
      plans: Boolean(this.token && this.plansDbId),
    };
  }

  /** Query one database, following pagination up to `cap` rows. */
  private async query(databaseId: string, cap = 300): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;

    do {
      const res = await this.doFetch(`${NOTION_API}/databases/${databaseId}/query`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "notion-version": NOTION_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
      });

      if (!res.ok) {
        throw new Error(`Notion query failed (${res.status}): ${await res.text().catch(() => "")}`.slice(0, 300));
      }

      const body = (await res.json()) as NotionQueryResponse;
      pages.push(...(body.results ?? []));
      cursor = body.has_more && body.next_cursor ? body.next_cursor : undefined;
    } while (cursor && pages.length < cap);

    return pages.slice(0, cap);
  }

  async listEvents(projectId?: string): Promise<MemoryEvent[]> {
    if (!this.token || !this.timelineDbId) return [];
    const rows = await this.query(this.timelineDbId);

    const events = rows.map((page): MemoryEvent => {
      const p = page.properties ?? {};
      return {
        name: text(p.Name),
        projectId: text(p.Project),
        type: text(p.Type),
        summary: text(p.Summary),
        at: p.Timestamp?.date?.start,
      };
    });

    const filtered = projectId ? events.filter((e) => e.projectId === projectId) : events;
    // Newest first; rows without a timestamp sort last rather than crashing.
    return filtered.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  }

  async listPlans(projectId?: string): Promise<MemoryPlan[]> {
    if (!this.token || !this.plansDbId) return [];
    const rows = await this.query(this.plansDbId);

    const plans = rows.map((page): MemoryPlan => {
      const p = page.properties ?? {};
      return {
        name: text(p.Name),
        projectId: text(p.Project),
        version: p.Version?.number ?? 0,
        status: text(p.Status),
        diffSummary: text(p.DiffSummary),
        content: text(p.Content),
      };
    });

    const filtered = projectId ? plans.filter((x) => x.projectId === projectId) : plans;
    return filtered.sort((a, b) => a.version - b.version);
  }

  /** Distinct projects present in the timeline, most recently active first. */
  async listProjects(): Promise<MemoryProject[]> {
    const events = await this.listEvents();
    const byProject = new Map<string, MemoryProject>();

    for (const e of events) {
      if (!e.projectId) continue;
      const seen = byProject.get(e.projectId);
      if (!seen) {
        // listEvents is newest-first, so the first row seen is the latest.
        byProject.set(e.projectId, { projectId: e.projectId, events: 1, latestType: e.type, latestAt: e.at });
      } else {
        seen.events += 1;
      }
    }

    return [...byProject.values()].sort((a, b) => (b.latestAt ?? "").localeCompare(a.latestAt ?? ""));
  }
}
