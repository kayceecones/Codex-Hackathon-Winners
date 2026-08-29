-- CreateTable
CREATE TABLE "ProjectRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "leader" TEXT,
    "currentProposalId" TEXT,
    "currentPlanId" TEXT,
    "approvedPlanId" TEXT,
    "currentExecutionContractId" TEXT,
    "currentExecutionId" TEXT,
    "currentReviewId" TEXT,
    "previousStateBeforeHold" TEXT,
    "exitReason" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ProposalRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "proposer" TEXT NOT NULL,
    "rationale" TEXT,
    "acceptanceCriteria" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "PlanVersionRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "feedbackAddressed" TEXT,
    "createdAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ApprovalRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "planId" TEXT,
    "decision" TEXT NOT NULL,
    "leader" TEXT NOT NULL,
    "feedback" TEXT,
    "reason" TEXT,
    "createdAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ExecutionContractRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planVersion" INTEGER NOT NULL,
    "proposalId" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL,
    "constraints" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CodingResultRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "executionContractId" TEXT,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "filesChanged" TEXT NOT NULL,
    "commandsRun" TEXT NOT NULL,
    "output" TEXT,
    "createdAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ReviewResultRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "executionId" TEXT,
    "classification" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "issues" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "EventRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor" TEXT,
    "occurredAt" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "ProposalRow_projectId_idx" ON "ProposalRow"("projectId");

-- CreateIndex
CREATE INDEX "PlanVersionRow_projectId_idx" ON "PlanVersionRow"("projectId");

-- CreateIndex
CREATE INDEX "ApprovalRow_projectId_idx" ON "ApprovalRow"("projectId");

-- CreateIndex
CREATE INDEX "ExecutionContractRow_projectId_idx" ON "ExecutionContractRow"("projectId");

-- CreateIndex
CREATE INDEX "CodingResultRow_projectId_idx" ON "CodingResultRow"("projectId");

-- CreateIndex
CREATE INDEX "ReviewResultRow_projectId_idx" ON "ReviewResultRow"("projectId");

-- CreateIndex
CREATE INDEX "EventRow_projectId_idx" ON "EventRow"("projectId");
