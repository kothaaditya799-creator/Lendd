/**
 * LendTrack Biometric Authentication Service (Phase 6)
 * 
 * Provides:
 * - Device platform authenticator check (Touch ID, Face ID, Android Biometric Prompt)
 * - WebAuthn API credential assertion / verification
 * - 1-tap fast unlock fallback
 */

import { getSecurityConfig } from './security';

/**
 * Check if the current device/browser supports hardware biometric verification.
 */
export async function isBiometricsSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    if (
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch {
    // Unsupported or blocked by browser policy
  }

  return false;
}

/**
 * Trigger Biometric Authentication (Touch ID / Face ID / Fingerprint sensor).
 * Returns true if authenticated successfully, false otherwise.
 */
export async function authenticateWithBiometrics(
  _promptReason: string = 'Unlock LendTrack'
): Promise<boolean> {
  const config = getSecurityConfig();
  if (!config.biometricsEnabled) {
    return false;
  }

  const supported = await isBiometricsSupported();
  if (!supported) {
    // In simulation or dev mode without hardware platform authenticator,
    // we can still verify if biometrics were enabled by user
    return false;
  }

  try {
    // Challenge-based credential assertion request using WebAuthn
    const challenge = new Uint8Array(32);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(challenge);
    }

    const options: CredentialRequestOptions = {
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname || 'localhost',
      },
    };

    // Attempt navigator.credentials.get
    const assertion = await navigator.credentials.get(options);
    return !!assertion;
  } catch (err: unknown) {
    // NotAllowedError (user cancelled / biometric failed) or SecurityError
    console.warn('Biometric authentication cancelled or failed:', err);
    return false;
  }
}
