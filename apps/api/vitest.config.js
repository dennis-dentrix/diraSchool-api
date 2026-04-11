import { defineConfig } from 'vitest/config';
import os from 'os';
import path from 'path';

// Persistent binary cache in the home directory — survives across runs.
// /Users/mac/.cache is owned by root on this machine so we use ~/mongodb-binaries.
const MONGO_BIN_DIR = path.join(os.homedir(), '.mongodb-binaries');
process.env.MONGOMS_DOWNLOAD_DIR = MONGO_BIN_DIR;

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Run all test files in a single forked process, sequentially.
    // Prevents OverwriteModelError (Mongoose model re-registration across workers)
    // and avoids MongoMemoryReplSet port conflicts.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    // Pass the binary cache path into every worker fork's environment so
    // mongodb-memory-server writes / reads from the same persistent location.
    env: {
      MONGOMS_DOWNLOAD_DIR: MONGO_BIN_DIR,
      NODE_ENV: 'test',
      MONGO_URI: 'mongodb://localhost:27017/test',
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long-xx',
      CLIENT_URL: 'http://localhost:3000',
      REDIS_URL: 'redis://localhost:6379',
    },
    // With the growing integration suite and MongoMemory replica set startup,
    // some transactional tests can exceed 30s under load.
    testTimeout: 60000,
    // 2-minute hook timeout — the first run downloads a ~66 MB MongoDB binary;
    // subsequent runs hit the local cache and complete in milliseconds.
    hookTimeout: 120000,
  },
});
