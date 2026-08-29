/**
 * Milestone 0 - prove the Runloop path works against a real API key.
 *
 * Nothing in this service had ever run against real Runloop credentials; every
 * feature built on top (preview tunnels, snapshot chaining) is worthless if the
 * base path is broken. This script exercises each capability in order and says
 * exactly which one fails, then always cleans up so a failed run does not leak
 * a paid devbox.
 *
 *   npm run milestone0
 */
import 'dotenv/config';
import { Devbox } from '../src/devbox';
import { PREVIEW_SERVER_PORT, PREVIEW_SERVER_SOURCE } from '../src/preview-server';

const steps: Array<{ name: string; ok: boolean; detail: string }> = [];

function record(name: string, ok: boolean, detail: string): void {
  steps.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
}

async function main(): Promise<void> {
  const apiKey = process.env.RUNLOOP_API_KEY;
  if (!apiKey) {
    console.error('RUNLOOP_API_KEY is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  const devbox = new Devbox(apiKey);
  let snapshotId: string | null = null;

  try {
    const started = Date.now();
    const devboxId = await devbox.start();
    record('create + awaitRunning', true, `${devboxId} in ${Date.now() - started}ms`);

    await devbox.writeFile('demo-app/hello.txt', 'weave milestone 0');
    record('writeFile', true, 'demo-app/hello.txt');

    const readBack = await devbox.readFile('demo-app/hello.txt');
    record('readFile', readBack.includes('weave milestone 0'), JSON.stringify(readBack.trim()));

    const nodeVersion = await devbox.exec('node --version');
    record(
      'exec (node present)',
      nodeVersion.exitStatus === 0,
      nodeVersion.stdout.trim() || nodeVersion.stderr.trim(),
    );

    // Idea 1's core risk: does a public tunnel actually serve the app?
    try {
      await devbox.writeFile('demo-app/index.html', '<h1>weave preview ok</h1>');
      await devbox.writeFile('preview-server.js', PREVIEW_SERVER_SOURCE);
      await devbox.execAsync('node preview-server.js demo-app > preview.log 2>&1');
      await devbox.enableTunnel();
      const url = devbox.previewUrl(PREVIEW_SERVER_PORT);
      record('enableTunnel', Boolean(url), url ?? 'no url returned');

      if (url) {
        // Give the async server a moment to bind before probing.
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const response = await fetch(url);
        const body = await response.text();
        record(
          'preview URL serves the app',
          response.ok && body.includes('weave preview ok'),
          `HTTP ${response.status}`,
        );
        console.log(`\n  Open this in a browser: ${url}\n`);
      }
    } catch (err) {
      record('tunnel/preview', false, err instanceof Error ? err.message : String(err));
    }

    // Idea 2's core risk: can we commit the disk and boot from it later?
    try {
      snapshotId = await devbox.snapshot('milestone0', 'Weave milestone 0 verification', {
        source: 'milestone0',
      });
      record('snapshotDiskAsync', Boolean(snapshotId), snapshotId ?? '');

      await devbox.awaitSnapshot(snapshotId);
      record('snapshot completed', true, snapshotId);
    } catch (err) {
      record('snapshot', false, err instanceof Error ? err.message : String(err));
    }
  } catch (err) {
    record('run', false, err instanceof Error ? err.message : String(err));
  } finally {
    try {
      await devbox.shutdown();
      console.log('\ncleaned up devbox');
    } catch (err) {
      console.error('\nWARNING: could not shut down devbox:', err);
    }
  }

  // Booting from the snapshot needs its own box - verifies the chaining that
  // Idea 2b depends on.
  if (snapshotId) {
    const restored = new Devbox(process.env.RUNLOOP_API_KEY!);
    try {
      await restored.start(snapshotId);
      const contents = await restored.readFile('demo-app/hello.txt');
      record(
        'boot from snapshot (state survives)',
        contents.includes('weave milestone 0'),
        JSON.stringify(contents.trim()),
      );
    } catch (err) {
      record('boot from snapshot', false, err instanceof Error ? err.message : String(err));
    } finally {
      await restored.shutdown().catch(() => {});
      console.log('cleaned up restored devbox');
    }
  }

  const failed = steps.filter((step) => !step.ok);
  console.log(`\n${steps.length - failed.length}/${steps.length} steps passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
