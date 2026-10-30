/**
 * Request Persistent Storage from the browser/OS.
 * On modern Android and Chromium browsers, this prevents the OS from
 * automatically evicting IndexedDB data when the device runs low on storage.
 */
export async function requestStoragePersistence(): Promise<{
  isPersisted: boolean;
  quotaBytes?: number;
  usageBytes?: number;
}> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { isPersisted: false };
  }

  try {
    // 1. Check if already persisted
    let isPersisted = false;
    if (navigator.storage.persisted) {
      isPersisted = await navigator.storage.persisted();
    }

    // 2. If not persisted, request persistence
    if (!isPersisted && navigator.storage.persist) {
      isPersisted = await navigator.storage.persist();
    }

    // 3. Inspect quota estimates if available
    let quotaBytes: number | undefined;
    let usageBytes: number | undefined;
    if (navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      quotaBytes = estimate.quota;
      usageBytes = estimate.usage;
    }

    return { isPersisted, quotaBytes, usageBytes };
  } catch (error) {
    console.warn('[StoragePersistence] Could not check storage persistence:', error);
    return { isPersisted: false };
  }
}

