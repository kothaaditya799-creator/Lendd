/**
 * LendTrack - Lender Identification Utility
 *
 * Provides persistent RFC 4122 v4 UUID for multi-device tenant isolation and Supabase Cloud Sync.
 * Ensures strict PostgreSQL UUID type compliance across Dexie and Cloud PostgREST.
 */

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const LENDER_ID_STORAGE_KEY = 'lendtrack_lender_id';
export const DEFAULT_FALLBACK_UUID = '00000000-0000-4000-8000-000000000001';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

/**
 * Retrieves the persistent lender UUID for this installation,
 * or generates and saves one if not already present.
 */
export function getOrCreateLenderId(): string {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const existing = globalThis.localStorage.getItem(LENDER_ID_STORAGE_KEY);
      if (existing && isValidUUID(existing)) {
        return existing;
      }
      const newId = generateUUID();
      globalThis.localStorage.setItem(LENDER_ID_STORAGE_KEY, newId);
      return newId;
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return DEFAULT_FALLBACK_UUID;
}

/**
 * Updates the active lender UUID on this device (used when linking a new/secondary phone
 * to an existing cloud ledger for restore).
 */
export function setLenderId(newLenderId: string): boolean {
  const trimmed = newLenderId.trim().toLowerCase();
  if (!isValidUUID(trimmed)) {
    return false;
  }
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(LENDER_ID_STORAGE_KEY, trimmed);
      return true;
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return false;
}
