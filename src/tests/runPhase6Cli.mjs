import { runPhase6Verification } from './phase6Verification.ts';

async function main() {
  console.log('====================================================');
  console.log('🔒  PHASE 6: SECURITY & PIN LOCK TEST SUITE');
  console.log('====================================================');

  const { total, passed, failed, results } = await runPhase6Verification();

  results.forEach((r) => {
    if (r.passed) {
      console.log(`✅ ${r.name}`);
    } else {
      console.log(`❌ ${r.name} - ${r.details || 'Assertion failed'}`);
    }
  });

  console.log('----------------------------------------------------');
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();

