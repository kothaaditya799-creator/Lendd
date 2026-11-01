import { runPhase4Verification } from './phase4Verification.ts';

async function run() {
  console.log('====================================================');
  console.log('📋  PHASE 4: DAILY COLLECTION SYSTEM TEST SUITE');
  console.log('====================================================');

  const suite = runPhase4Verification();
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
  }
}

run();

