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
const SEED_DIR = path.join(__dirname, '..', 'seed');
const VERIFY_DIR = path.join(__dirname, 'verify');

// Proposed shape from CODING_AGENT_PLAN.md §8 - field names to confirm with
// Person 1 (Master Agent) and Person 3 (Planning) once their contracts settle.
interface ExecutionContract {
  execution_contract_id: string;
  project_id: string;
  plan_version: number;
  tasks: string[];
  files_or_areas: string[];
  constraints: string[];
  acceptance_criteria: string[];
  context: string[];
  /** Name of a script in src/verify/ (without .js), e.g. "dark-mode". */
  verify_script?: string;
}

// Transport back to the Master Agent is still open (HTTP callback vs queue vs
// in-process) - logging for now, per CODING_AGENT_PLAN.md §7.
function emitEvent(type: string, payload: Record<string, unknown>): void {
  console.log(`[event] ${type}`, JSON.stringify(payload));
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

    emitEvent('review.started', { execution_contract_id: contract.execution_contract_id });

    const reviewInput: ReviewInput = {
      filesOrAreas: contract.files_or_areas ?? [],
      filesChanged: codingResult.filesChanged,
      tests,
      acceptanceCriteria: contract.acceptance_criteria ?? [],
    };
    const reviewResult = review(reviewInput);

    if (reviewResult.classification === 'pass') {
      emitEvent('review.passed', { execution_contract_id: contract.execution_contract_id });
    } else {
      emitEvent('review.issue', {
        execution_contract_id: contract.execution_contract_id,
        classification: reviewResult.classification === 'coding_issue' ? 'coding' : 'plan',
        detail: reviewResult.detail,
      });
    }

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
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`coding-review-agent listening on :${PORT}`);
});
