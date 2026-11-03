/**
 * Auto-Lock & Inactivity Timer Hook (Phase 6)
 * 
 * Features:
 * - 2-minute default inactivity auto-lock
 * - 45-second background grace period for seamless WhatsApp receipt sharing
 * - Multitasking visibility tracking
 * - User interaction listener (touch, click, keydown, scroll)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSecurityConfig } from '../utils/security';

const WHATSAPP_GRACE_PERIOD_MS = 45 * 1000; // 45 seconds for WhatsApp / phone calls

export interface UseAutoLockReturn {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
  isPrivacyCurtainVisible: boolean;
}

export function useAutoLock(): UseAutoLockReturn {
  const config = getSecurityConfig();
  
  // Start locked if PIN has been set up
  const [isLocked, setIsLocked] = useState<boolean>(() => config.isConfigured);
  const [isPrivacyCurtainVisible, setIsPrivacyCurtainVisible] = useState<boolean>(false);

  const lastActiveRef = useRef<number>(Date.now());
  const backgroundTimestampRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const lock = useCallback(() => {
    const currentConfig = getSecurityConfig();
    if (currentConfig.isConfigured) {
      setIsLocked(true);
    }
  }, []);

  const unlock = useCallback(() => {
    lastActiveRef.current = Date.now();
    backgroundTimestampRef.current = null;
    setIsLocked(false);
  }, []);

  // Update activity timestamp on user interaction
  const recordActivity = useCallback(() => {
    lastActiveRef.current = Date.now();
  }, []);

  useEffect(() => {
    // 1. Inactivity Checker Interval (checks every 5 seconds)
    const checkInactivity = () => {
      const currentConfig = getSecurityConfig();
      if (!currentConfig.isConfigured || isLocked) return;

      const timeoutMs = (currentConfig.autoLockMinutes || 2) * 60 * 1000;
      const inactiveDuration = Date.now() - lastActiveRef.current;

      if (inactiveDuration >= timeoutMs) {
        lock();
      }
    };

    timerRef.current = window.setInterval(checkInactivity, 5000);

    // 2. Activity Event Listeners (throttled activity recording)
    const events = ['touchstart', 'mousedown', 'keydown', 'scroll'];
    events.forEach((evt) => {
      window.addEventListener(evt, recordActivity, { passive: true });
    });

    // 3. Visibility Change Listener (Grace Period for App Switching + Privacy Curtain)
    const handleVisibilityChange = () => {
      const currentConfig = getSecurityConfig();
      if (!currentConfig.isConfigured) return;

      if (document.hidden) {
        // App is moving to background (multitasking card / WhatsApp / lock screen)
        backgroundTimestampRef.current = Date.now();
        setIsPrivacyCurtainVisible(true);
      } else {
        // App is resuming to foreground
        setIsPrivacyCurtainVisible(false);
        const bgTime = backgroundTimestampRef.current;
        if (bgTime !== null) {
          const timeInBackground = Date.now() - bgTime;
          // If in background for longer than grace period (45s), lock app
          if (timeInBackground > WHATSAPP_GRACE_PERIOD_MS) {
            lock();
          }
        }
        backgroundTimestampRef.current = null;
        lastActiveRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      events.forEach((evt) => {
        window.removeEventListener(evt, recordActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLocked, lock, recordActivity]);

  return {
    isLocked,
    lock,
    unlock,
    isPrivacyCurtainVisible,
  };
}

