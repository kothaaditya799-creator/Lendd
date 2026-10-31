import { runPhase2GuardRailTests } from './phase2Verification';
import { runPhase3Verification } from './phase3Verification';

export async function executeAllTestSuites() {
  console.log('====================================================');
  console.log('🛡️  PHASE 2 GUARD RAIL AUTOMATED TEST SUITE');
  console.log('====================================================');

  const p2 = runPhase2GuardRailTests();
  for (const test of p2.results) {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} [${test.suite}] ${test.testName}`);
    if (test.error) {
      console.error(`   Error: ${test.error}`);
    }
  }
  console.log(`Phase 2: ${p2.passed}/${p2.total} passed`);

  console.log('====================================================');
  console.log('📐  PHASE 3 LOAN ENGINE & SCHEDULE MATH SUITE');
  console.log('====================================================');

  const p3 = await runPhase3Verification();
  for (const test of p3.results) {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
    if (test.error) {
      console.error(`   Error: ${test.error}`);
    }
  }
  console.log(`Phase 3: ${p3.passed}/${p3.total} passed`);
  console.log('====================================================');

  return {
    phase2: p2,
    phase3: p3,
    allPassed: p2.failed === 0 && p3.failed === 0,
  };
}

// Auto-run in development
if (import.meta.env.DEV) {
  executeAllTestSuites();
}
