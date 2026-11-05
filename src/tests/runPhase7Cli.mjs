import { runPhase7Verification } from './phase7Verification.ts';

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
    for (const test of suite.results) {
      const icon = test.passed ? '✅' : '❌';
      console.log(`${icon} ${test.name}`);
      if (test.details && !test.passed) {
        console.error(`   Details: ${test.details}`);
      }
    }

    console.log('----------------------------------------------------');
    console.log(`TOTAL TESTS: ${suite.total} | PASSED: ${suite.passed} | FAILED: ${suite.failed}`);
    console.log('====================================================');

    if (suite.failed > 0) {
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

