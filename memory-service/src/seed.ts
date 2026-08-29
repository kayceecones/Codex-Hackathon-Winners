import "dotenv/config";
import { prisma } from "./db.js";
import { recordEvent } from "./events.js";
import { createPlanVersionPage } from "./notion.js";

async function main() {
  const project = await prisma.project.create({
    data: {
      name: "Codex Demo App",
      description: "Sample project seeded for the hackathon demo.",
    },
  });
  await recordEvent(project.id, "project.created", project);

  const proposal = await prisma.proposal.create({
    data: {
      projectId: project.id,
      memberName: "Alex",
      title: "Add dark mode",
      description: "Add a dark mode toggle so users can switch themes.",
      status: "confirmed",
    },
  });
  await recordEvent(project.id, "proposal.created", proposal);
  await recordEvent(project.id, "proposal.confirmed", proposal);

  const planV1 = await prisma.planVersion.create({
    data: {
      projectId: project.id,
      proposalId: proposal.id,
      version: 1,
      status: "superseded",
      content:
        "# Plan v1: Dark Mode\n\n- Add theme toggle to settings\n- Add dark theme tokens across frontend + backend config\n- Persist preference server-side per user",
    },
  });
  await createPlanVersionPage({
    projectId: project.id,
    version: planV1.version,
    status: planV1.status,
    diffSummary: null,
    content: planV1.content,
  });
  await recordEvent(project.id, "plan.created", planV1);

  await prisma.approval.create({
    data: {
      planVersionId: planV1.id,
      decision: "request_update",
      feedback: "Keep dark mode, but don't touch the backend — scope it to frontend only, and include persistence.",
      decidedBy: "Jordan (Leader)",
    },
  });
  await recordEvent(project.id, "plan.request_update", {
    planVersionId: planV1.id,
    feedback: "Scope to frontend only, include persistence.",
  });

  const planV2 = await prisma.planVersion.create({
    data: {
      projectId: project.id,
      proposalId: proposal.id,
      version: 2,
      status: "awaiting_decision",
      diffSummary: "Removed backend theme storage; persistence now handled via frontend localStorage/cookie only.",
      content:
        "# Plan v2: Dark Mode (frontend-only)\n\n- Add theme toggle to settings UI\n- Add dark theme tokens to frontend styles only\n- Persist preference via localStorage (no backend changes)",
    },
  });
  await createPlanVersionPage({
    projectId: project.id,
    version: planV2.version,
    status: planV2.status,
    diffSummary: planV2.diffSummary,
    content: planV2.content,
  });
  await recordEvent(project.id, "plan.updated", planV2);

  console.log("Seeded project:", project.id);
  console.log("Plan v2 is awaiting a leader decision — POST /plans/%s/decision to continue the demo.", planV2.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
