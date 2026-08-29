import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { prisma } from "./db.js";
import { recordEvent } from "./events.js";
import { createPlanVersionPage, logReview } from "./notion.js";

const app = express();
app.use(cors());
app.use(express.json());

function handle(fn: (req: express.Request, res: express.Response) => Promise<void>) {
  return (req: express.Request, res: express.Response) => {
    fn(req, res).catch((err) => {
      console.error(err);
      res.status(400).json({ error: err instanceof Error ? err.message : "unknown error" });
    });
  };
}

// ---------- Projects ----------

app.post(
  "/projects",
  handle(async (req, res) => {
    const body = z.object({ name: z.string(), description: z.string().optional() }).parse(req.body);
    const project = await prisma.project.create({ data: body });
    await recordEvent(project.id, "project.created", project);
    res.json(project);
  })
);

app.get(
  "/projects",
  handle(async (_req, res) => {
    res.json(await prisma.project.findMany({ orderBy: { createdAt: "desc" } }));
  })
);

app.get(
  "/projects/:id/state",
  handle(async (req, res) => {
    const projectId = req.params.id;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return void res.status(404).json({ error: "project not found" });

    const proposals = await prisma.proposal.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    const latestPlan = await prisma.planVersion.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    const latestApproval = latestPlan
      ? await prisma.approval.findFirst({
          where: { planVersionId: latestPlan.id },
          orderBy: { decidedAt: "desc" },
        })
      : null;
    const executionContract = latestPlan
      ? await prisma.executionContract.findFirst({
          where: { planVersionId: latestPlan.id },
          orderBy: { createdAt: "desc" },
        })
      : null;
    const implementation = executionContract
      ? await prisma.implementation.findFirst({
          where: { executionContractId: executionContract.id },
          orderBy: { createdAt: "desc" },
        })
      : null;
    const review = implementation
      ? await prisma.review.findFirst({
          where: { implementationId: implementation.id },
          orderBy: { createdAt: "desc" },
        })
      : null;

    res.json({
      project,
      proposals,
      latestPlan,
      latestApproval,
      executionContract,
      implementation,
      review,
    });
  })
);

app.get(
  "/projects/:id/timeline",
  handle(async (req, res) => {
    const events = await prisma.event.findMany({
      where: { projectId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    res.json(events.map((e) => ({ ...e, payload: JSON.parse(e.payload) })));
  })
);

app.get(
  "/projects/:id/plans",
  handle(async (req, res) => {
    const plans = await prisma.planVersion.findMany({
      where: { projectId: req.params.id },
      orderBy: { version: "asc" },
    });
    res.json(plans);
  })
);

// ---------- Generic event ingestion (agent lifecycle logging etc.) ----------

app.post(
  "/events",
  handle(async (req, res) => {
    const body = z
      .object({ projectId: z.string(), type: z.string(), payload: z.unknown().optional() })
      .parse(req.body);
    const event = await recordEvent(body.projectId, body.type, body.payload);
    res.json(event);
  })
);

// ---------- Proposals ----------

app.post(
  "/proposals",
  handle(async (req, res) => {
    const body = z
      .object({
        projectId: z.string(),
        memberName: z.string(),
        title: z.string(),
        description: z.string(),
      })
      .parse(req.body);
    const proposal = await prisma.proposal.create({ data: { ...body, status: "pending" } });
    await recordEvent(proposal.projectId, "proposal.created", proposal);
    res.json(proposal);
  })
);

app.post(
  "/proposals/:id/confirm",
  handle(async (req, res) => {
    const proposal = await prisma.proposal.update({
      where: { id: req.params.id },
      data: { status: "confirmed" },
    });
    await recordEvent(proposal.projectId, "proposal.confirmed", proposal);
    res.json(proposal);
  })
);

// ---------- Plan versions ----------

app.post(
  "/plans",
  handle(async (req, res) => {
    const body = z
      .object({
        projectId: z.string(),
        proposalId: z.string().optional(),
        content: z.string(),
        diffSummary: z.string().optional(),
      })
      .parse(req.body);

    const previous = await prisma.planVersion.findFirst({
      where: { projectId: body.projectId },
      orderBy: { version: "desc" },
    });
    const nextVersion = (previous?.version ?? 0) + 1;

    if (previous && ["awaiting_decision", "needs_revision"].includes(previous.status)) {
      await prisma.planVersion.update({
        where: { id: previous.id },
        data: { status: "superseded" },
      });
    }

    const plan = await prisma.planVersion.create({
      data: { ...body, version: nextVersion, status: "awaiting_decision" },
    });

    await createPlanVersionPage({
      projectId: plan.projectId,
      version: plan.version,
      status: plan.status,
      diffSummary: plan.diffSummary,
      content: plan.content,
    });
    await recordEvent(plan.projectId, previous ? "plan.updated" : "plan.created", plan);
    res.json(plan);
  })
);

app.post(
  "/plans/:id/decision",
  handle(async (req, res) => {
    const body = z
      .object({
        decision: z.enum(["approve", "request_update", "hold", "exit"]),
        feedback: z.string().optional(),
        decidedBy: z.string(),
      })
      .parse(req.body);

    const plan = await prisma.planVersion.findUnique({ where: { id: req.params.id } });
    if (!plan) return void res.status(404).json({ error: "plan not found" });

    await prisma.approval.create({
      data: { planVersionId: plan.id, ...body },
    });

    const statusByDecision: Record<string, string> = {
      approve: "approved",
      request_update: "needs_revision",
      hold: "held",
      exit: "rejected",
    };
    const updatedPlan = await prisma.planVersion.update({
      where: { id: plan.id },
      data: { status: statusByDecision[body.decision] },
    });

    await recordEvent(plan.projectId, `plan.${body.decision}`, {
      planVersionId: plan.id,
      feedback: body.feedback,
      decidedBy: body.decidedBy,
    });

    let executionContract = null;
    if (body.decision === "approve") {
      executionContract = await prisma.executionContract.create({
        data: {
          projectId: plan.projectId,
          planVersionId: plan.id,
          scope: plan.content,
          acceptanceCriteria: body.feedback ?? "See approved plan content.",
        },
      });
      await recordEvent(plan.projectId, "coding.ready", executionContract);
    }

    res.json({ plan: updatedPlan, executionContract });
  })
);

// ---------- Execution / Coding ----------

app.post(
  "/implementations",
  handle(async (req, res) => {
    const body = z
      .object({
        projectId: z.string(),
        executionContractId: z.string(),
        runloopSessionId: z.string().optional(),
        filesChanged: z.array(z.string()).optional(),
        testResults: z.string().optional(),
        status: z.enum(["running", "complete", "failed"]).optional(),
      })
      .parse(req.body);

    const implementation = await prisma.implementation.create({
      data: {
        ...body,
        filesChanged: body.filesChanged ? JSON.stringify(body.filesChanged) : undefined,
        status: body.status ?? "running",
        finishedAt: body.status && body.status !== "running" ? new Date() : undefined,
      },
    });
    await recordEvent(
      body.projectId,
      implementation.status === "running" ? "coding.started" : `coding.${implementation.status}`,
      implementation
    );
    res.json(implementation);
  })
);

app.patch(
  "/implementations/:id",
  handle(async (req, res) => {
    const body = z
      .object({
        status: z.enum(["running", "complete", "failed"]).optional(),
        filesChanged: z.array(z.string()).optional(),
        testResults: z.string().optional(),
      })
      .parse(req.body);

    const implementation = await prisma.implementation.update({
      where: { id: req.params.id },
      data: {
        ...body,
        filesChanged: body.filesChanged ? JSON.stringify(body.filesChanged) : undefined,
        finishedAt: body.status && body.status !== "running" ? new Date() : undefined,
      },
    });
    await recordEvent(
      implementation.projectId,
      `coding.${implementation.status}`,
      implementation
    );
    res.json(implementation);
  })
);

// ---------- Review ----------

app.post(
  "/reviews",
  handle(async (req, res) => {
    const body = z
      .object({
        projectId: z.string(),
        implementationId: z.string(),
        verdict: z.enum(["pass", "coding_issue", "plan_issue"]),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const review = await prisma.review.create({ data: body });
    await logReview({ projectId: body.projectId, verdict: body.verdict, notes: body.notes });
    await recordEvent(body.projectId, `review.${body.verdict}`, review);
    res.json(review);
  })
);

// ---------- Agent runs (raw agent invocation log) ----------

app.post(
  "/agent-runs",
  handle(async (req, res) => {
    const body = z
      .object({
        projectId: z.string(),
        agentType: z.enum(["brainstorm", "planning", "coding", "review"]),
        input: z.string(),
      })
      .parse(req.body);
    const run = await prisma.agentRun.create({ data: { ...body, status: "running" } });
    res.json(run);
  })
);

app.patch(
  "/agent-runs/:id",
  handle(async (req, res) => {
    const body = z
      .object({ status: z.enum(["done", "error"]), output: z.string().optional() })
      .parse(req.body);
    const run = await prisma.agentRun.update({
      where: { id: req.params.id },
      data: { ...body, finishedAt: new Date() },
    });
    res.json(run);
  })
);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`[memory-service] listening on http://localhost:${port}`);
});
