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

/**
 * Retrieves the persistent lender UUID for this installation,
 * or generates and saves one if not already present.
 */
export function getOrCreateLenderId(): string {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const existing = globalThis.localStorage.getItem(LENDER_ID_STORAGE_KEY);
      if (existing && existing.length === 36) {
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
