import { rm } from 'node:fs/promises';

export default async function globalTeardown() {
  // Kill the test backend process
  const backend = globalThis.__TEST_BACKEND__;
  if (backend && !backend.killed) {
    backend.kill('SIGTERM');
  }

  // Clean up the test database
  const dbPath = globalThis.__TEST_DB_PATH__;
  if (dbPath) {
    await rm(dbPath, { force: true });
  }
}
