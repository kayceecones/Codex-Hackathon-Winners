import Runloop from '@runloop/api-client';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitStatus: number;
}

/** Tunnel URLs are built client-side: https://{port}-{tunnel_key}.tunnel.runloop.ai */
const TUNNEL_DOMAIN = 'tunnel.runloop.ai';

export class Devbox {
  private readonly client: Runloop;
  private id: string | null = null;
  private tunnelKey: string | null = null;

  constructor(apiKey: string) {
    this.client = new Runloop({ bearerToken: apiKey });
  }

  private get devboxId(): string {
    if (!this.id) throw new Error('Devbox not started - call start() first');
    return this.id;
  }

  /** The devbox id, or null if not started. Safe to read before start(). */
  get idOrNull(): string | null {
    return this.id;
  }

  /**
   * Boot a devbox. With a snapshotId, the box starts from that saved state
   * (cumulative project history); without one, it starts from a base image and
   * the caller is expected to seed files in.
   */
  async start(snapshotId?: string): Promise<string> {
    const devbox = snapshotId
      ? await this.client.devboxes.create({ snapshot_id: snapshotId })
      : await this.client.devboxes.create();
    this.id = devbox.id;
    await this.client.devboxes.awaitRunning(this.id);
    return this.id;
  }

  async exec(command: string): Promise<ExecResult> {
    const result = await this.client.devboxes.executeSync(this.devboxId, { command });
    return { stdout: result.stdout, stderr: result.stderr, exitStatus: result.exit_status };
  }

  /** Fire-and-forget - used to start the long-running preview server. */
  async execAsync(command: string): Promise<void> {
    await this.client.devboxes.executeAsync(this.devboxId, { command });
  }

  async readFile(filePath: string): Promise<string> {
    return this.client.devboxes.readFileContents(this.devboxId, { file_path: filePath });
  }

  async writeFile(filePath: string, contents: string): Promise<void> {
    await this.client.devboxes.writeFileContents(this.devboxId, { file_path: filePath, contents });
  }

  /**
   * Open a public HTTP tunnel into the box. auth_mode 'open' is deliberate: an
   * authenticated tunnel needs an X-Runloop-Tunnel-Authorization header, which a
   * plain <iframe> in the frontend cannot send.
   */
  async enableTunnel(): Promise<string> {
    const tunnel = await this.client.devboxes.enableTunnel(this.devboxId, {
      auth_mode: 'open',
      wake_on_http: true,
    });
    this.tunnelKey = tunnel.tunnel_key;
    return this.tunnelKey;
  }

  /** Null until enableTunnel() has run. One tunnel serves every port. */
  previewUrl(port: number): string | null {
    return this.tunnelKey ? `https://${port}-${this.tunnelKey}.${TUNNEL_DOMAIN}` : null;
  }

  /**
   * Snapshot the disk as a named, message-carrying commit. Returns the snapshot
   * id immediately - the snapshot completes in the background, so callers should
   * not block a response on it.
   */
  async snapshot(
    name: string,
    commitMessage: string,
    metadata: Record<string, string> = {},
  ): Promise<string> {
    const snapshot = await this.client.devboxes.snapshotDiskAsync(this.devboxId, {
      name,
      commit_message: commitMessage,
      metadata,
    });
    return snapshot.id;
  }

  /** Wait for a previously started snapshot to finish writing. */
  async awaitSnapshot(snapshotId: string): Promise<void> {
    await this.client.devboxes.diskSnapshots.awaitCompleted(snapshotId);
  }

  /** Pause the box but keep its disk and tunnel - the preview URL stays live. */
  async suspend(): Promise<void> {
    if (!this.id) return;
    await this.client.devboxes.suspend(this.id);
  }

  async shutdown(): Promise<void> {
    if (!this.id) return;
    await this.client.devboxes.shutdown(this.id);
  }
}
