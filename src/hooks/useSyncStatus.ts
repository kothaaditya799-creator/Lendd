import { useState, useEffect, useCallback } from 'react';
import {
  SyncEngineState,
  subscribeSyncState,
  triggerManualSync,
  getSyncEngineState,
  initSyncEngine,
} from '../db/syncEngine';

export function useSyncStatus() {
  const [state, setState] = useState<SyncEngineState>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTimestamp: null,
    lastError: null,
    dataRevision: 0,
  });

  useEffect(() => {
    // Initialize network listeners
    const cleanupSyncEngine = initSyncEngine();

    // Subscribe to state changes
    const unsubscribe = subscribeSyncState((newState) => {
      setState(newState);
    });

    // Initial query
    getSyncEngineState().then(setState);

    return () => {
      unsubscribe();
      cleanupSyncEngine();
    };
  }, []);

  const syncNow = useCallback(async () => {
    await triggerManualSync();
  }, []);

  return {
    ...state,
    syncNow,
  };
}

