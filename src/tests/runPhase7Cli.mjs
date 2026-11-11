import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPhase7Verification } from './phase7Verification.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Node polyfill for localStorage if missing
if (typeof globalThis.localStorage === 'undefined') {
  const memoryStore = new Map();
  globalThis.localStorage = {
    getItem: (k) => memoryStore.get(k) || null,
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k),
    clear: () => memoryStore.clear(),
  };
}

// Node polyfill for navigator.onLine if missing
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { onLine: true };
}

async function run() {
  console.log('====================================================');
  console.log('🌐  PHASE 7: CLOUD SYNC & PWA SERVICE WORKER SUITE');
  console.log('====================================================');

  try {
    const suite = await runPhase7Verification();

    // Node FS assertions for PWA static assets
    const manifestPath = path.join(PROJECT_ROOT, 'public/manifest.json');
    const swPath = path.join(PROJECT_ROOT, 'public/sw.js');

    const manifestExists = fs.existsSync(manifestPath);
    let manifestValid = false;
    if (manifestExists) {
      try {
        const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifestValid =
          parsed.display === 'standalone' &&
          parsed.start_url === '/' &&
          Array.isArray(parsed.icons) &&
          parsed.icons.length > 0;
      } catch {
        manifestValid = false;
      }
    }

    const swExists = fs.existsSync(swPath);
    const swContent = swExists ? fs.readFileSync(swPath, 'utf8') : '';
    const swValid =
      swExists &&
      swContent.includes('CACHE_NAME') &&
      swContent.includes("addEventListener('install'") &&
      swContent.includes("addEventListener('fetch'");

    const fsChecks = [
      {
        name: 'PWA Manifest: Exists and defines standalone shell + icon',
        passed: manifestExists && manifestValid,
        details: manifestPath,
      },
      {
        name: 'PWA Service Worker: Exists with install & fetch offline handlers',
        passed: swValid,
        details: swPath,
      },
    ];

    const allResults = [...suite.results, ...fsChecks];
    const total = allResults.length;
    const passed = allResults.filter((r) => r.passed).length;
    const failed = allResults.filter((r) => !r.passed).length;

    for (const test of allResults) {
      const icon = test.passed ? '✅' : '❌';
      console.log(`${icon} ${test.name}`);
      if (test.details && !test.passed) {
        console.error(`   Details: ${test.details}`);
      }
    }

    console.log('----------------------------------------------------');
    console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

run();

