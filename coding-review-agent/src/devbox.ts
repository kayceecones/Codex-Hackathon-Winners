import Runloop from '@runloop/api-client';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitStatus: number;
}

export class Devbox {
  private readonly client: Runloop;
  private id: string | null = null;

  constructor(apiKey: string) {
    this.client = new Runloop({ bearerToken: apiKey });
  }

  private get devboxId(): string {
    if (!this.id) throw new Error('Devbox not started - call start() first');
    return this.id;
  }

  async start(): Promise<string> {
    const devbox = await this.client.devboxes.create();
    this.id = devbox.id;
    await this.client.devboxes.awaitRunning(this.id);
    return this.id;
  }

  async exec(command: string): Promise<ExecResult> {
    const result = await this.client.devboxes.executeSync(this.devboxId, { command });
    return { stdout: result.stdout, stderr: result.stderr, exitStatus: result.exit_status };
  }

  async readFile(filePath: string): Promise<string> {
    return this.client.devboxes.readFileContents(this.devboxId, { file_path: filePath });
  }

  async writeFile(filePath: string, contents: string): Promise<void> {
    await this.client.devboxes.writeFileContents(this.devboxId, { file_path: filePath, contents });
  }

  async shutdown(): Promise<void> {
    if (!this.id) return;
    await this.client.devboxes.shutdown(this.id);
  }
}
