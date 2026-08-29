import OpenAI from 'openai';
import type { Devbox } from './devbox';

const MAX_ITERATIONS = 10;

const tools: OpenAI.Responses.Tool[] = [
  {
    type: 'function',
    name: 'read_file',
    description: 'Read the contents of a file in the devbox, relative to the home directory.',
    parameters: {
      type: 'object',
      properties: { file_path: { type: 'string' } },
      required: ['file_path'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'write_file',
    description: 'Write (overwrite) a file in the devbox with new contents.',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string' },
        contents: { type: 'string' },
      },
      required: ['file_path', 'contents'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'run_command',
    description: 'Run a shell command in the devbox and get back stdout/stderr/exit status.',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'done',
    description: 'Call this once the requested changes are complete. Ends the session.',
    parameters: {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
      additionalProperties: false,
    },
    strict: true,
  },
];

export interface ExecutionContractTask {
  tasks: string[];
  constraints: string[];
  filesOrAreas: string[];
  context: string[];
}

export interface CodingAgentResult {
  status: 'success' | 'failed';
  summary: string;
  filesChanged: string[];
  iterations: number;
}

function buildTaskDescription(task: ExecutionContractTask): string {
  const section = (title: string, items: string[]) =>
    items.length ? `${title}:\n${items.map((item) => `- ${item}`).join('\n')}` : '';

  return [
    section('Tasks', task.tasks),
    section('Constraints', task.constraints),
    section('Files/areas in scope', task.filesOrAreas),
    section('Context', task.context),
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function runCodingAgent(devbox: Devbox, task: ExecutionContractTask): Promise<CodingAgentResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? 'gpt-5.6';

  const instructions = [
    'You are a coding agent editing a small customer-support dashboard demo app inside a sandboxed devbox.',
    'Known files: demo-app/index.html, demo-app/style.css, demo-app/app.js.',
    'Implement the requested tasks with minimal, scoped changes. Do not touch files outside the listed areas/constraints.',
    'If demo-app/verify.js exists, run it with run_command (`node demo-app/verify.js`) before calling done, and fix any FAILED lines it reports.',
    'When finished, call the done tool with a one-sentence summary of what you changed.',
  ].join('\n');

  let input: OpenAI.Responses.ResponseInput = [{ role: 'user', content: buildTaskDescription(task) }];
  const filesChanged = new Set<string>();

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    const response = await openai.responses.create({ model, instructions, tools, input });

    const functionCalls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === 'function_call',
    );

    if (functionCalls.length === 0) {
      return {
        status: 'failed',
        summary: 'Model stopped without calling the done tool.',
        filesChanged: [...filesChanged],
        iterations: iteration,
      };
    }

    // response.output items round-trip as input items (this is the documented
    // pattern), but their union types aren't structurally identical - cast.
    input = [...input, ...(response.output as unknown as OpenAI.Responses.ResponseInputItem[])];

    for (const call of functionCalls) {
      const args = JSON.parse(call.arguments || '{}') as Record<string, string>;

      if (call.name === 'done') {
        return {
          status: 'success',
          summary: args.summary ?? 'Done.',
          filesChanged: [...filesChanged],
          iterations: iteration,
        };
      }

      let output: string;
      try {
        if (call.name === 'read_file') {
          output = await devbox.readFile(args.file_path);
        } else if (call.name === 'write_file') {
          await devbox.writeFile(args.file_path, args.contents);
          filesChanged.add(args.file_path);
          output = 'ok';
        } else if (call.name === 'run_command') {
          const result = await devbox.exec(args.command);
          output = `exit ${result.exitStatus}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
        } else {
          output = `unknown tool: ${call.name}`;
        }
      } catch (err) {
        output = `error: ${err instanceof Error ? err.message : String(err)}`;
      }

      input.push({ type: 'function_call_output', call_id: call.call_id, output });
    }
  }

  return {
    status: 'failed',
    summary: `Hit the ${MAX_ITERATIONS}-iteration cap without calling done.`,
    filesChanged: [...filesChanged],
    iterations: MAX_ITERATIONS,
  };
}
