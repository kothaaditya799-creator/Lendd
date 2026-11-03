/**
 * Phase 6 Verification Test Suite
 * 
 * Comprehensive tests for:
 * - SHA-256 salted PIN hashing
 * - Salt randomness and determinism
 * - 4-digit PIN setup and input validation
 * - PIN verification and matching
 * - Brute-force rate limiting (5 failed attempts -> 30s lockout)
 * - Lockout expiration and recovery
 * - Change PIN flow
 * - Biometrics preference toggle
 * - Auto-lock duration preference
 * - Emergency wipe safeguard
 */

import {
  generateSalt,
  hashPin,
  setupInitialPin,
  verifyEnteredPin,
  changeExistingPin,
  toggleBiometricsConfig,
  setAutoLockMinutesConfig,
  clearSecurityConfig,
  getSecurityConfig,
  emergencyWipeAllData,
} from '../utils/security.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

export async function runPhase6Verification(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  const assert = (name: string, condition: boolean, details?: string) => {
    results.push({ name, passed: condition, details });
  };

  // Reset before starting
  clearSecurityConfig();

  // =========================================================================
  // 1. CRYPTOGRAPHIC SALT & HASH TESTS
  // =========================================================================
  const salt1 = generateSalt();
  const salt2 = generateSalt();
  assert('Salt Generation: Produces non-empty string', typeof salt1 === 'string' && salt1.length > 0);
  assert('Salt Randomness: Two generated salts are distinct', salt1 !== salt2);

  const hash1 = await hashPin('1234', salt1);
  const hash2 = await hashPin('1234', salt1);
  const hashDiffSalt = await hashPin('1234', salt2);
  const hashDiffPin = await hashPin('5678', salt1);

  assert('Hash Format: Produces 64-character SHA-256 hex string', hash1.length === 64);
  assert('Hash Determinism: Same PIN and salt produces identical hash', hash1 === hash2);
  assert('Salt Defense: Same PIN with different salts produces completely different hash', hash1 !== hashDiffSalt);
  assert('PIN Distinction: Different PINs with same salt produce different hash', hash1 !== hashDiffPin);

  // =========================================================================
  // 2. SETUP & INPUT VALIDATION
  // =========================================================================
  let threwOnShort = false;
  try {
    await setupInitialPin('12');
  } catch {
    threwOnShort = true;
  }
  assert('Validation: Rejects PIN with fewer than 4 digits', threwOnShort);

  let threwOnLong = false;
  try {
    await setupInitialPin('12345');
  } catch {
    threwOnLong = true;
  }
  assert('Validation: Rejects PIN with more than 4 digits', threwOnLong);

  let threwOnAlpha = false;
  try {
    await setupInitialPin('abcd');
  } catch {
    threwOnAlpha = true;
  }
  assert('Validation: Rejects non-numeric characters in PIN', threwOnAlpha);

  const setupResult = await setupInitialPin('4321', '9876543210', 'lender@example.com');
  assert('Setup: Configured flag is set to true', setupResult.isConfigured === true);
  assert('Setup: Salt is generated and stored', !!setupResult.salt);
  assert('Setup: Salted hash is stored', !!setupResult.pinHash);
  assert('Setup: Recovery phone saved', setupResult.recoveryPhone === '9876543210');
  assert('Setup: Recovery email saved', setupResult.recoveryEmail === 'lender@example.com');

  // =========================================================================
  // 3. PIN VERIFICATION & ACCESS CONTROL
  // =========================================================================
  const verifySuccess = await verifyEnteredPin('4321');
  assert('Verification: Correct PIN returns success = true', verifySuccess.success === true);
  assert('Verification: Correct PIN is not locked out', verifySuccess.isLockedOut === false);
  assert('Verification: Full remaining attempts available', verifySuccess.remainingAttempts === 5);

  const verifyWrong = await verifyEnteredPin('9999');
  assert('Verification: Wrong PIN returns success = false', verifyWrong.success === false);
  assert('Verification: Wrong PIN decrements remaining attempts', verifyWrong.remainingAttempts === 4);

  // =========================================================================
  // 4. BRUTE FORCE RATE LIMITING & LOCKOUT
  // =========================================================================
  // Failed attempt 2
  const attempt2 = await verifyEnteredPin('0000');
  assert('Rate Limit: 2nd failed attempt leaves 3 attempts', attempt2.remainingAttempts === 3);

  // Failed attempt 3
  const attempt3 = await verifyEnteredPin('1111');
  assert('Rate Limit: 3rd failed attempt leaves 2 attempts', attempt3.remainingAttempts === 2);

  // Failed attempt 4
  const attempt4 = await verifyEnteredPin('2222');
  assert('Rate Limit: 4th failed attempt leaves 1 attempt', attempt4.remainingAttempts === 1);

  // Failed attempt 5 -> LOCKOUT!
  const attempt5 = await verifyEnteredPin('3333');
  assert('Rate Limit: 5th failed attempt triggers isLockedOut = true', attempt5.isLockedOut === true);
  assert('Rate Limit: Lockout seconds is between 25 and 30', attempt5.lockoutSeconds >= 25 && attempt5.lockoutSeconds <= 30);
  assert('Rate Limit: Remaining attempts is 0 during lockout', attempt5.remainingAttempts === 0);

  // Attempting with correct PIN during active lockout should be rejected!
  const blockedCorrectPin = await verifyEnteredPin('4321');
  assert('Anti-Tampering: Correct PIN is blocked while lockout is active', blockedCorrectPin.success === false && blockedCorrectPin.isLockedOut === true);

  // Simulate lockout expiration
  const currentConfig = getSecurityConfig();
  currentConfig.lockoutUntil = Date.now() - 1000; // Expired 1 second ago
  const afterExpiry = await verifyEnteredPin('4321');
  assert('Lockout Expiry: Correct PIN unlocks after cooldown expires', afterExpiry.success === true);
  assert('Lockout Expiry: Lockout status cleared', afterExpiry.isLockedOut === false);

  // =========================================================================
  // 5. CHANGE PIN FLOW
  // =========================================================================
  const changeFail = await changeExistingPin('0000', '8888');
  assert('Change PIN: Fails if old PIN is incorrect', changeFail === false);

  const changeOk = await changeExistingPin('4321', '8888');
  assert('Change PIN: Succeeds with correct old PIN', changeOk === true);

  const testOldPin = await verifyEnteredPin('4321');
  assert('Change PIN: Old PIN no longer works', testOldPin.success === false);

  const testNewPin = await verifyEnteredPin('8888');
  assert('Change PIN: New PIN unlocks successfully', testNewPin.success === true);

  // =========================================================================
  // 6. PREFERENCES & CONFIGURATION
  // =========================================================================
  toggleBiometricsConfig(true);
  assert('Biometrics: Toggles enabled state to true', getSecurityConfig().biometricsEnabled === true);

  toggleBiometricsConfig(false);
  assert('Biometrics: Toggles enabled state to false', getSecurityConfig().biometricsEnabled === false);

  setAutoLockMinutesConfig(5);
  assert('Auto-Lock: Updates inactivity duration to 5 mins', getSecurityConfig().autoLockMinutes === 5);

  setAutoLockMinutesConfig(0); // Clamped minimum
  assert('Auto-Lock: Clamps invalid duration to at least 1 min', getSecurityConfig().autoLockMinutes === 1);

  // =========================================================================
  // 7. EMERGENCY LOCAL WIPE
  // =========================================================================
  await emergencyWipeAllData();
  const wipedConfig = getSecurityConfig();
  assert('Emergency Wipe: Clears isConfigured back to false', wipedConfig.isConfigured === false);
  assert('Emergency Wipe: Clears pinHash', wipedConfig.pinHash === '');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return { total, passed, failed, results };
}
