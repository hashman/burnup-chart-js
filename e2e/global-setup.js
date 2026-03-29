import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TEST_BACKEND_PORT, TEST_FRONTEND_PORT } from './test-config.js';

const TEST_DB_PATH = resolve(import.meta.dirname, '..', 'backend', 'data', 'test.sqlite3');
const BACKEND_URL = `http://127.0.0.1:${TEST_BACKEND_PORT}`;

/** Wait until the backend responds to health checks. */
async function waitForBackend(url, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Backend did not start within ${timeoutMs}ms`);
}

export default async function globalSetup() {
  // 1. Remove stale test DB to ensure a clean state
  await rm(TEST_DB_PATH, { force: true });

  // 2. Start backend with test DB
  const backend = spawn(
    'python', ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(TEST_BACKEND_PORT)],
    {
      cwd: resolve(import.meta.dirname, '..', 'backend'),
      env: {
        ...process.env,
        BURNUP_DB_PATH: TEST_DB_PATH,
        BURNUP_CORS_ORIGINS: `http://127.0.0.1:${TEST_FRONTEND_PORT},http://127.0.0.1:5173`,
      },
      stdio: 'pipe',
    },
  );

  backend.stderr.on('data', (d) => {
    const msg = d.toString();
    if (msg.includes('ERROR')) process.stderr.write(`[test-backend] ${msg}`);
  });

  backend.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[test-backend] exited with code ${code}`);
    }
  });

  // 3. Wait for backend to be ready
  await waitForBackend(BACKEND_URL);

  // Store reference so teardown can kill it
  globalThis.__TEST_BACKEND__ = backend;
  globalThis.__TEST_DB_PATH__ = TEST_DB_PATH;
}
