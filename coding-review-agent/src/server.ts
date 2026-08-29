import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { Devbox } from './devbox';
import { PREVIEW_SERVER_PORT, PREVIEW_SERVER_SOURCE } from './preview-server';
import { runCodingAgent, type ExecutionContractTask } from './coding-agent';
import { review, type ReviewInput } from './review-agent';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 4005);
const MASTER_API_URL = process.env.MASTER_API_URL?.replace(/\/+$/, '');
const SEED_DIR = path.join(__dirname, '..', 'seed');
const VERIFY_DIR = path.join(__dirname, 'verify');

interface ExecutionContract {
  execution_contract_id: string;
  project_id: string;
  plan_version: number;
  tasks: string[];
  files_or_areas: string[];
  constraints: string[];
  acceptance_criteria: string[];
  context: string[] | Record<string, unknown>;
  verify_script?: string;
  /**
   * Snapshot of the previous approved execution. When present the devbox boots
   * from it, so the project accumulates (dark mode is still there when the next
   * request runs). When absent we seed from scratch exactly as before - the same
   * graceful-no-op pattern used for files_or_areas, so this lights up the moment
   * Person 1 can carry the field.
   */
  base_snapshot_id?: string;
}

/**
 * Devboxes left suspended so their preview URLs stay clickable. These still
 * consume quota, so they are tracked and reapable via POST /cleanup rather than
 * silently accumulating through a demo.
 */
interface LiveDevbox {
  devbox: Devbox;
  devboxId: string;
  executionContractId: string;
  previewUrl: string | null;
  snapshotId: string | null;
  suspendedAt: string;
}

const liveDevboxes = new Map<string, LiveDevbox>();

// Transport back to the Master Agent is still open (HTTP callback vs queue vs
// in-process) - logging for now, per CODING_AGENT_PLAN.md §7.
function emitEvent(type: string, payload: Record<string, unknown>): void {
  console.log(`[event] ${type}`, JSON.stringify(payload));
}

async function postMasterEvent(
  contract: ExecutionContract,
  type: 'coding.completed' | 'review.completed',
  payload: Record<string, unknown>
): Promise<void> {
  if (!MASTER_API_URL) return;

  const response = await fetch(`${MASTER_API_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      projectId: contract.project_id,
      actor: { name: 'Coding + Review Agent', role: 'person_5' },
      payload,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.warn(`[master-callback] ${type} failed with ${response.status}: ${body}`);
  }
}

async function seedDevbox(devbox: Devbox): Promise<void> {
  for (const file of fs.readdirSync(SEED_DIR)) {
    const contents = fs.readFileSync(path.join(SEED_DIR, file), 'utf8');
    await devbox.writeFile(`demo-app/${file}`, contents);
  }
}

async function writeVerifyScript(devbox: Devbox, verifyScript: string | undefined): Promise<void> {
  const scriptPath = path.join(VERIFY_DIR, `${verifyScript ?? 'noop'}.js`);
  const contents = fs.existsSync(scriptPath)
    ? fs.readFileSync(scriptPath, 'utf8')
    : "console.log('0 passed, 0 failed');";
  await devbox.writeFile('demo-app/verify.js', contents);
}

function parseTestCounts(stdout: string): { passed: number; failed: number } {
  const match = stdout.match(/(\d+)\s+passed,\s+(\d+)\s+failed/);
  return match ? { passed: Number(match[1]), failed: Number(match[2]) } : { passed: 0, failed: 0 };
}

/**
 * Serve the demo app over a public tunnel so the whole team can open the same
 * live result instead of reading a diff. Never fatal: a run that produced real
 * code changes is still a successful run if only the preview failed.
 */
async function startPreview(devbox: Devbox): Promise<string | null> {
  try {
    await devbox.writeFile('preview-server.js', PREVIEW_SERVER_SOURCE);
    await devbox.execAsync(`node preview-server.js demo-app > preview.log 2>&1`);
    await devbox.enableTunnel();
    return devbox.previewUrl(PREVIEW_SERVER_PORT);
  } catch (err) {
    console.warn('[preview] failed to start:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Snapshot the result as a named commit so this plan version becomes a bootable
 * environment. Kicked off but never awaited to completion inline - snapshotting
 * is not instant and must not block the response.
 */
async function snapshotResult(
  devbox: Devbox,
  contract: ExecutionContract,
  summary: string,
): Promise<string | null> {
  try {
    return await devbox.snapshot(
      `plan-v${contract.plan_version}`,
      summary.slice(0, 1000),
      {
        plan_version: String(contract.plan_version),
        project_id: contract.project_id,
        execution_contract_id: contract.execution_contract_id,
      },
    );
  } catch (err) {
    console.warn('[snapshot] failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

app.post('/execution-contract', async (req, res) => {
  const contract = req.body as ExecutionContract;
  const devbox = new Devbox(process.env.RUNLOOP_API_KEY ?? '');
  let succeeded = false;

  emitEvent('coding.started', {
    execution_contract_id: contract.execution_contract_id,
    base_snapshot_id: contract.base_snapshot_id ?? null,
  });

  try {
    await devbox.start(contract.base_snapshot_id);

    // A snapshot already carries the project's files; only a cold start needs seeding.
    if (!contract.base_snapshot_id) {
      await seedDevbox(devbox);
    }
    await writeVerifyScript(devbox, contract.verify_script);

    const task: ExecutionContractTask = {
      tasks: contract.tasks ?? [],
      constraints: contract.constraints ?? [],
      filesOrAreas: contract.files_or_areas ?? [],
      context: contract.context ?? [],
    };

    const codingResult = await runCodingAgent(devbox, task);

    const verifyRun = await devbox.exec('node demo-app/verify.js');
    const tests = parseTestCounts(verifyRun.stdout);

    succeeded = codingResult.status === 'success';

    const previewUrl = succeeded ? await startPreview(devbox) : null;
    const snapshotId = succeeded ? await snapshotResult(devbox, contract, codingResult.summary) : null;

    emitEvent('coding.completed', {
      execution_contract_id: contract.execution_contract_id,
      status: codingResult.status,
      summary: codingResult.summary,
      files_changed: codingResult.filesChanged,
      tests,
      preview_url: previewUrl,
      snapshot_id: snapshotId,
    });

    await postMasterEvent(contract, 'coding.completed', {
      execution: {
        executionContractId: contract.execution_contract_id,
        status: toMasterCodingStatus(codingResult.status),
        summary: codingResult.summary,
        filesChanged: codingResult.filesChanged,
        commandsRun: ['runloop coding agent', 'node demo-app/verify.js'],
        output: JSON.stringify({ tests, iterations: codingResult.iterations }),
      },
    });

    emitEvent('review.started', { execution_contract_id: contract.execution_contract_id });

    const reviewInput: ReviewInput = {
      filesOrAreas: contract.files_or_areas ?? [],
      filesChanged: codingResult.filesChanged,
      tests,
      acceptanceCriteria: contract.acceptance_criteria ?? [],
    };
    const reviewResult =
      codingResult.status === 'success'
        ? review(reviewInput)
        : { classification: 'coding_issue' as const, detail: `Coding failed: ${codingResult.summary}` };

    if (reviewResult.classification === 'pass') {
      emitEvent('review.passed', { execution_contract_id: contract.execution_contract_id });
    } else {
      emitEvent('review.issue', {
        execution_contract_id: contract.execution_contract_id,
        classification: reviewResult.classification === 'coding_issue' ? 'coding' : 'plan',
        detail: reviewResult.detail,
      });
    }

    const devboxId = devbox.idOrNull;
    if (succeeded && devboxId) {
      // Suspend rather than shut down: the disk and tunnel survive, so the
      // preview URL stays clickable and wakes the box on demand.
      await devbox.suspend();
      liveDevboxes.set(devboxId, {
        devbox,
        devboxId,
        executionContractId: contract.execution_contract_id,
        previewUrl,
        snapshotId,
        suspendedAt: new Date().toISOString(),
      });
    } else {
      await devbox.shutdown();
    }

    res.json({
      status: codingResult.status,
      summary: codingResult.summary,
      files_changed: codingResult.filesChanged,
      tests,
      review: reviewResult,
      preview_url: previewUrl,
      snapshot_id: snapshotId,
      devbox_id: devboxId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emitEvent('coding.completed', {
      execution_contract_id: contract.execution_contract_id,
      status: 'failed',
      summary: message,
      files_changed: [],
      tests: { passed: 0, failed: 0 },
      preview_url: null,
      snapshot_id: null,
    });
    await devbox.shutdown().catch(() => {});
    res.status(500).json({
      status: 'failed',
      summary: message,
      files_changed: [],
      tests: { passed: 0, failed: 0 },
      preview_url: null,
      snapshot_id: null,
    });
  }
});

/** What is still running and costing us. */
app.get('/devboxes', (_req, res) => {
  res.json({
    count: liveDevboxes.size,
    devboxes: [...liveDevboxes.values()].map(({ devbox: _devbox, ...rest }) => rest),
  });
});

/** Reap every suspended devbox this service left alive. */
app.post('/cleanup', async (_req, res) => {
  const shutdown: string[] = [];
  const failed: string[] = [];

  for (const entry of [...liveDevboxes.values()]) {
    try {
      await entry.devbox.shutdown();
      liveDevboxes.delete(entry.devboxId);
      shutdown.push(entry.devboxId);
    } catch {
      failed.push(entry.devboxId);
    }
  }

  res.json({ shutdown, failed });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, live_devboxes: liveDevboxes.size });
});

app.listen(PORT, () => {
  console.log(`coding-review-agent listening on :${PORT}`);
});