/**
 * Background Sync Engine (Offline-First FIFO Queue Processor)
 * 
 * Responsibilities:
 * 1. Monitors online/offline network connectivity (window online/offline).
 * 2. Drains Dexie IndexedDB syncQueue table in strict FIFO order.
 * 3. Applies Last-Write-Wins (LWW) conflict resolution using ISO timestamps.
 * 4. Implements Exponential Backoff with Jitter on intermittent network drops.
 * 5. Provides reactive state subscriptions for the UI (TopHeader & SettingsModal).
 */

import { db } from './dexie.ts';
import type { SyncQueueItem } from '../types/domain.ts';
import {
  isSupabaseConfigured,
  upsertCloudRecord,
  deleteCloudRecord,
} from './supabaseClient.ts';

export interface SyncEngineState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTimestamp: number | null;
  lastError: string | null;
}

const LAST_SYNC_KEY = 'lendtrack_last_sync_timestamp';

// Exponential backoff configuration
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;
let consecutiveFailures = 0;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let isCurrentlySyncing = false;

// Subscribers for real-time reactive UI updates
type SyncStateListener = (state: SyncEngineState) => void;
const listeners = new Set<SyncStateListener>();

/**
 * Calculate Exponential Backoff with randomized jitter.
 */
export function calculateBackoffWithJitter(failures: number): number {
  const exponential = BASE_BACKOFF_MS * Math.pow(2, Math.min(failures, 5));
  const jitter = Math.floor(Math.random() * 1000);
  return Math.min(MAX_BACKOFF_MS, exponential + jitter);
}

/**
 * Last-Write-Wins (LWW) Conflict Resolution Evaluator.
 * Returns true if incoming remote timestamp is strictly newer than local timestamp.
 */
export function isRemoteNewer(remoteUpdatedAt: string, localUpdatedAt: string): boolean {
  try {
    const remoteTime = new Date(remoteUpdatedAt).getTime();
    const localTime = new Date(localUpdatedAt).getTime();
    return remoteTime > localTime;
  } catch {
    return false;
  }
}

/**
 * Check if the browser currently reports network connectivity.
 */
export function checkIsOnline(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true;
}

/**
 * Get the stored timestamp of the last successful sync.
 */
export function getLastSyncTimestamp(): number | null {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const stored = globalThis.localStorage.getItem(LAST_SYNC_KEY);
      return stored ? parseInt(stored, 10) : null;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

/**
 * Save the timestamp of the last successful sync.
 */
function setLastSyncTimestamp(timestamp: number): void {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(LAST_SYNC_KEY, timestamp.toString());
    }
  } catch {
    // Ignore storage errors
  }
}

// In-memory fallback queue for Node CLI test environments where IndexedDB is absent
const inMemoryQueue: SyncQueueItem[] = [];
let nextMemoryId = 1;

export async function enqueueSyncItem(item: Omit<SyncQueueItem, 'id'>): Promise<number> {
  try {
    if (typeof indexedDB !== 'undefined') {
      return await db.syncQueue.add(item as SyncQueueItem);
    }
  } catch {
    // Fall through to in-memory fallback
  }
  const id = nextMemoryId++;
  const entry: SyncQueueItem = { ...item, id };
  inMemoryQueue.push(entry);
  return id;
}

export async function clearSyncQueue(): Promise<void> {
  try {
    if (typeof indexedDB !== 'undefined') {
      await db.syncQueue.clear();
      return;
    }
  } catch {
    // Fall through
  }
  inMemoryQueue.length = 0;
}

/**
 * Get current pending mutations count in the local sync queue.
 */
export async function getPendingSyncCount(): Promise<number> {
  try {
    if (typeof indexedDB !== 'undefined') {
      return await db.syncQueue.count();
    }
  } catch {
    // Fall through
  }
  return inMemoryQueue.length;
}

/**
 * Read the current snapshot of Sync Engine state.
 */
export async function getSyncEngineState(): Promise<SyncEngineState> {
  const pendingCount = await getPendingSyncCount();
  return {
    isOnline: checkIsOnline(),
    isSyncing: isCurrentlySyncing,
    pendingCount,
    lastSyncTimestamp: getLastSyncTimestamp(),
    lastError: consecutiveFailures > 0 ? `Connection retry in progress (${consecutiveFailures})` : null,
  };
}

/**
 * Notify all subscribed React hooks of state change.
 */
async function notifyListeners(): Promise<void> {
  if (listeners.size === 0) return;
  const state = await getSyncEngineState();
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      console.warn('Sync listener error:', err);
    }
  }
}

/**
 * Subscribe to Sync Engine state changes.
 */
export function subscribeSyncState(listener: SyncStateListener): () => void {
  listeners.add(listener);
  // Initial fire
  getSyncEngineState().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * CORE WORKER: Drain the Dexie syncQueue in FIFO Order.
 */
export async function drainSyncQueue(): Promise<{
  processedCount: number;
  remainingCount: number;
  success: boolean;
  error?: string;
}> {
  // Prevent concurrent executions
  if (isCurrentlySyncing) {
    const remaining = await getPendingSyncCount();
    return { processedCount: 0, remainingCount: remaining, success: true };
  }

  // Check online status
  if (!checkIsOnline()) {
    const remaining = await getPendingSyncCount();
    await notifyListeners();
    return {
      processedCount: 0,
      remainingCount: remaining,
      success: false,
      error: 'Device is offline',
    };
  }

  isCurrentlySyncing = true;
  await notifyListeners();

  let processedCount = 0;

  try {
    // Read queue items in strict FIFO order (by auto-incrementing id)
    let queueItems: SyncQueueItem[] = [];
    try {
      if (typeof indexedDB !== 'undefined') {
        queueItems = await db.syncQueue.orderBy('id').toArray();
      } else {
        queueItems = [...inMemoryQueue].sort((a, b) => (a.id || 0) - (b.id || 0));
      }
    } catch {
      queueItems = [...inMemoryQueue].sort((a, b) => (a.id || 0) - (b.id || 0));
    }

    if (queueItems.length === 0) {
      consecutiveFailures = 0;
      setLastSyncTimestamp(Date.now());
      isCurrentlySyncing = false;
      await notifyListeners();
      return { processedCount: 0, remainingCount: 0, success: true };
    }

    const hasCloudCredentials = isSupabaseConfigured();

    for (const item of queueItems) {
      if (!item.id) continue;

      if (hasCloudCredentials) {
        // Send mutation to Supabase PostgREST
        let res: { ok: boolean; error?: string };

        if (item.action === 'DELETE') {
          res = await deleteCloudRecord(item.table, item.recordId);
        } else {
          // INSERT or UPDATE
          res = await upsertCloudRecord(item.table, item.payload);
        }

        if (!res.ok) {
          // Cloud failure (network or server error)
          throw new Error(res.error || 'Failed to sync record to cloud');
        }
      }

      // Mutation successfully applied to cloud (or cleared in local-first demo mode)
      try {
        if (typeof indexedDB !== 'undefined') {
          await db.syncQueue.delete(item.id);
        } else {
          const idx = inMemoryQueue.findIndex((q) => q.id === item.id);
          if (idx !== -1) inMemoryQueue.splice(idx, 1);
        }
      } catch {
        const idx = inMemoryQueue.findIndex((q) => q.id === item.id);
        if (idx !== -1) inMemoryQueue.splice(idx, 1);
      }
      processedCount++;
    }

    // Successfully processed entire queue
    consecutiveFailures = 0;
    setLastSyncTimestamp(Date.now());
    isCurrentlySyncing = false;
    await notifyListeners();

    return { processedCount, remainingCount: 0, success: true };
  } catch (err: unknown) {
    consecutiveFailures++;
    isCurrentlySyncing = false;
    const remaining = await getPendingSyncCount();
    await notifyListeners();

    const errorMessage = err instanceof Error ? err.message : 'Unknown sync error';

    // Schedule exponential backoff retry if online
    if (checkIsOnline() && !backoffTimer) {
      const delay = calculateBackoffWithJitter(consecutiveFailures);
      backoffTimer = setTimeout(() => {
        backoffTimer = null;
        drainSyncQueue();
      }, delay);
    }

    return {
      processedCount,
      remainingCount: remaining,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Manually trigger sync execution on demand.
 */
export async function triggerManualSync(): Promise<{
  processedCount: number;
  remainingCount: number;
  success: boolean;
  error?: string;
}> {
  if (backoffTimer) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
  return await drainSyncQueue();
}

/**
 * Register global browser network listeners (online/offline).
 */
export function initSyncEngine(): () => void {
  const onOnline = () => {
    consecutiveFailures = 0;
    notifyListeners();
    drainSyncQueue();
  };

  const onOffline = () => {
    if (backoffTimer) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }
    notifyListeners();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Initial check and drain
    if (checkIsOnline()) {
      setTimeout(() => drainSyncQueue(), 500);
    }
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    }
    if (backoffTimer) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }
  };
}
