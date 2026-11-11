import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Unified CLI Test Orchestrator
 * Executes all offline Node-compatible verification suites across Phases 3–7.
 */
const suites = [
  { file: 'runPhase3Cli.mjs', args: [] },
  { file: 'runPhase4Cli.mjs', args: ['--experimental-strip-types'] },
  { file: 'runPhase5Cli.mjs', args: ['--experimental-strip-types'] },
  { file: 'runPhase6Cli.mjs', args: ['--experimental-strip-types'] },
  { file: 'runPhase7Cli.mjs', args: ['--experimental-strip-types'] },
];

for (const suite of suites) {
  const scriptPath = path.join(__dirname, suite.file);
  const res = spawnSync(process.execPath, [...suite.args, scriptPath], {
    stdio: 'inherit',
  });

  if (res.error) {
    console.error(`Failed to launch ${suite.file}:`, res.error);
    process.exit(1);
  }

  if (res.status !== 0) {
    console.error(`Test suite ${suite.file} failed with exit code ${res.status}`);
    process.exit(res.status ?? 1);
  }
}

console.log('✅ All CLI verification suites passed successfully.');

