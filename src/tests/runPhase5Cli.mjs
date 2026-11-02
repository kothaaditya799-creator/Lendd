import { runPhase5Tests } from './phase5Verification.ts';

const result = runPhase5Tests();
if (result.failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
