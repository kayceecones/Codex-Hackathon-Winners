import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { Devbox } from './devbox';
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
}

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

function toMasterCodingStatus(status: string): 'completed' | 'failed' {
  return status === 'success' ? 'completed' : 'failed';
}

app.post('/execution-contract', async (req, res) => {
  const contract = req.body as ExecutionContract;
  const devbox = new Devbox(process.env.RUNLOOP_API_KEY ?? '');

  emitEvent('coding.started', { execution_contract_id: contract.execution_contract_id });

  try {
    await devbox.start();
    await seedDevbox(devbox);
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

    emitEvent('coding.completed', {
      execution_contract_id: contract.execution_contract_id,
      status: codingResult.status,
      summary: codingResult.summary,
      files_changed: codingResult.filesChanged,
      tests,
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

    await postMasterEvent(contract, 'review.completed', {
      review: {
        classification: reviewResult.classification,
        summary: reviewResult.detail,
        issues:
          reviewResult.classification === 'pass'
            ? []
            : [{ title: 'Review issue', detail: reviewResult.detail, severity: 'medium' }],
      },
    });

    res.json({
      status: codingResult.status,
      summary: codingResult.summary,
      files_changed: codingResult.filesChanged,
      tests,
      review: reviewResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emitEvent('coding.completed', {
      execution_contract_id: contract.execution_contract_id,
      status: 'failed',
      summary: message,
      files_changed: [],
      tests: { passed: 0, failed: 0 },
    });
    await postMasterEvent(contract, 'coding.completed', {
      execution: {
        executionContractId: contract.execution_contract_id,
        status: 'failed',
        summary: message,
        filesChanged: [],
        commandsRun: [],
        output: message,
      },
    });
    await postMasterEvent(contract, 'review.completed', {
      review: {
        classification: 'coding_issue',
        summary: `Coding failed before review could run: ${message}`,
        issues: [{ title: 'Coding execution failed', detail: message, severity: 'high' }],
      },
    });
    res.status(500).json({
      status: 'failed',
      summary: message,
      files_changed: [],
      tests: { passed: 0, failed: 0 },
    });
  } finally {
    await devbox.shutdown().catch(() => {});
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'coding-review-agent' });
});

app.listen(PORT, () => {
  console.log(`coding-review-agent listening on :${PORT}`);
});