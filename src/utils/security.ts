/**
 * LendTrack Security & Cryptography Service (Phase 6)
 * 
 * Provides:
 * - SHA-256 salted PIN hashing using browser Web Crypto API
 * - Device-level security configuration persistence
 * - Brute-force rate limiting with 30-second cooldown after 5 failed attempts
 * - Biometric unlock preference management
 * - Inactivity timeout configuration
 * - Emergency wipe safeguards
 */

export interface SecurityConfig {
  isConfigured: boolean;
  pinHash: string;
  salt: string;
  biometricsEnabled: boolean;
  biometricCredentialId?: string;
  autoLockMinutes: number; // e.g. 1, 2, 5
  failedAttempts: number;
  lockoutUntil: number | null; // epoch ms
  recoveryPhone?: string;
  recoveryEmail?: string;
}

const STORAGE_KEY = 'lendtrack_security_config';
const MAX_FAILED_ATTEMPTS = 5;
const COOLDOWN_DURATION_MS = 30 * 1000; // 30 seconds

// In-memory fallback for environments without localStorage (e.g. CLI tests)
let inMemoryConfig: SecurityConfig | null = null;

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  isConfigured: false,
  pinHash: '',
  salt: '',
  biometricsEnabled: false,
  autoLockMinutes: 2,
  failedAttempts: 0,
  lockoutUntil: null,
  recoveryPhone: '',
  recoveryEmail: '',
};

/**
 * Generate a random 16-byte cryptographic salt in hex format.
 */
export function generateSalt(): string {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback if getRandomValues unavailable
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Hash a 4-digit PIN with a cryptographic salt using SHA-256.
 * Zero plaintext PIN is ever stored.
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${pin.trim()}`);
  
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Graceful fallback if subtle crypto is completely absent
  let hash = 0;
  const str = `${salt}:${pin.trim()}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash).toString(16)}`;
}

/**
 * Get current device security configuration.
 */
export function getSecurityConfig(): SecurityConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_SECURITY_CONFIG, ...JSON.parse(raw) };
      }
    }
  } catch {
    // Ignore storage errors
  }

  return inMemoryConfig || { ...DEFAULT_SECURITY_CONFIG };
}

/**
 * Persist device security configuration.
 */
export function saveSecurityConfig(config: SecurityConfig): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  } catch {
    // Ignore storage errors
  }
  inMemoryConfig = { ...config };
}

/**
 * Set up a new 4-digit PIN for first-time use or after authorized reset.
 */
export async function setupInitialPin(
  pin: string,
  recoveryPhone?: string,
  recoveryEmail?: string
): Promise<SecurityConfig> {
  const cleanPin = pin.trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    throw new Error('PIN must be exactly 4 digits (0-9).');
  }

  const salt = generateSalt();
  const pinHash = await hashPin(cleanPin, salt);

  const current = getSecurityConfig();
  const updated: SecurityConfig = {
    ...current,
    isConfigured: true,
    pinHash,
    salt,
    failedAttempts: 0,
    lockoutUntil: null,
    recoveryPhone: recoveryPhone?.trim() || current.recoveryPhone || '',
    recoveryEmail: recoveryEmail?.trim() || current.recoveryEmail || '',
  };

  saveSecurityConfig(updated);
  return updated;
}

/**
 * Verify entered PIN against stored salted hash with brute-force rate-limiting.
 */
export async function verifyEnteredPin(enteredPin: string): Promise<{
  success: boolean;
  isLockedOut: boolean;
  lockoutSeconds: number;
  remainingAttempts: number;
}> {
  const config = getSecurityConfig();

  // If no PIN has been set up yet, allow entry to configure it
  if (!config.isConfigured || !config.pinHash) {
    return {
      success: true,
      isLockedOut: false,
      lockoutSeconds: 0,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
    };
  }

  // 1. Check existing lockout status
  const now = Date.now();
  if (config.lockoutUntil && config.lockoutUntil > now) {
    const remainingSeconds = Math.ceil((config.lockoutUntil - now) / 1000);
    return {
      success: false,
      isLockedOut: true,
      lockoutSeconds: remainingSeconds,
      remainingAttempts: 0,
    };
  }

  // If lockout expired, reset attempts
  if (config.lockoutUntil && config.lockoutUntil <= now) {
    config.failedAttempts = 0;
    config.lockoutUntil = null;
    saveSecurityConfig(config);
  }

  // 2. Validate PIN format
  const cleanPin = enteredPin.trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    return {
      success: false,
      isLockedOut: false,
      lockoutSeconds: 0,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - config.failedAttempts),
    };
  }

  // 3. Compute hash and verify match
  const testHash = await hashPin(cleanPin, config.salt);
  if (testHash === config.pinHash) {
    // Correct PIN: Reset failed attempts & clear lockout
    config.failedAttempts = 0;
    config.lockoutUntil = null;
    saveSecurityConfig(config);
    return {
      success: true,
      isLockedOut: false,
      lockoutSeconds: 0,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
    };
  }

  // 4. Incorrect PIN: Increment failed attempts
  const newFailedAttempts = config.failedAttempts + 1;
  const isNowLockedOut = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
  const lockoutUntil = isNowLockedOut ? now + COOLDOWN_DURATION_MS : null;

  saveSecurityConfig({
    ...config,
    failedAttempts: newFailedAttempts,
    lockoutUntil,
  });

  return {
    success: false,
    isLockedOut: isNowLockedOut,
    lockoutSeconds: isNowLockedOut ? Math.ceil(COOLDOWN_DURATION_MS / 1000) : 0,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - newFailedAttempts),
  };
}

/**
 * Change PIN by validating old PIN and storing new salted hash.
 */
export async function changeExistingPin(oldPin: string, newPin: string): Promise<boolean> {
  const verifyResult = await verifyEnteredPin(oldPin);
  if (!verifyResult.success) {
    return false;
  }

  await setupInitialPin(newPin);
  return true;
}

/**
 * Toggle Biometric unlock authorization.
 */
export function toggleBiometricsConfig(enabled: boolean, credentialId?: string): void {
  const current = getSecurityConfig();
  saveSecurityConfig({
    ...current,
    biometricsEnabled: enabled,
    biometricCredentialId: enabled ? credentialId || current.biometricCredentialId : undefined,
  });
}

/**
 * Set Inactivity Auto-Lock duration in minutes (1, 2, 5, etc.).
 */
export function setAutoLockMinutesConfig(minutes: number): void {
  const current = getSecurityConfig();
  saveSecurityConfig({ ...current, autoLockMinutes: Math.max(1, minutes) });
}

/**
 * Clear security settings (for tests or complete reset).
 */
export function clearSecurityConfig(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
  inMemoryConfig = null;
}

/**
 * Emergency local data wipe safeguard.
 * Wipes local IndexedDB tables (borrowers, loans, schedules) and security config.
 */
export async function emergencyWipeAllData(): Promise<void> {
  clearSecurityConfig();
  try {
    if (typeof window !== 'undefined') {
      const { db } = await import('../db/dexie');
      await db.clearAllData();
    }
  } catch (err) {
    console.error('Failed to clear database during emergency wipe:', err);
  }
}
