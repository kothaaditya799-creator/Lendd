/**
 * PWA Service Worker Registration & Installation Manager
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

/**
 * Register Service Worker.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('LendTrack PWA Service Worker registered with scope:', registration.scope);
      })
      .catch((err) => {
        console.warn('LendTrack PWA Service Worker registration failed:', err);
      });
  });

  // Capture install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyInstallListeners(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyInstallListeners(false);
    console.log('LendTrack PWA installed successfully');
  });
}

function notifyInstallListeners(canInstall: boolean): void {
  for (const listener of installListeners) {
    try {
      listener(canInstall);
    } catch {
      // Ignore
    }
  }
}

/**
 * Check if the app is currently running as an installed standalone PWA.
 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari standalone check
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Check if the PWA can currently be prompted for install.
 */
export function canPromptPwaInstall(): boolean {
  return deferredPrompt !== null;
}

/**
 * Trigger the native PWA install prompt dialog.
 */
export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }

  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notifyInstallListeners(false);
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

/**
 * Subscribe to installability state changes.
 */
export function subscribePwaInstall(listener: (canInstall: boolean) => void): () => void {
  installListeners.add(listener);
  listener(canPromptPwaInstall());
  return () => {
    installListeners.delete(listener);
  };
}
