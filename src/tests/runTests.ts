import { runPhase2GuardRailTests } from './phase2Verification';

export function executePhase2TestSuite() {
  const summary = runPhase2GuardRailTests();

  console.log('====================================================');
  console.log('🛡️  PHASE 2 GUARD RAIL AUTOMATED TEST SUITE');
  console.log('====================================================');

  for (const test of summary.results) {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} [${test.suite}] ${test.testName}`);
    if (test.error) {
      console.error(`   Error: ${test.error}`);
    }
  }

  console.log('----------------------------------------------------');
  console.log(`Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}`);
  console.log('====================================================');

  return summary;
}

// Auto-run in development
if (import.meta.env.DEV) {
  executePhase2TestSuite();
}
