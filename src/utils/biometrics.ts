/**
 * LendTrack Biometric Authentication Service (Phase 6)
 * 
 * Provides:
 * - Device platform authenticator check (Touch ID, Face ID, Android Biometric Prompt)
 * - WebAuthn API platform credential registration & verification
 * - 1-tap fast unlock with credential binding
 */

import { getSecurityConfig } from './security';

/**
 * Helper to encode / decode base64 for credential IDs.
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

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
 * Register a WebAuthn platform authenticator credential on this device.
 * Called when the user enables Biometrics in Settings.
 */
export async function registerBiometricCredential(
  userId: string = 'lendtrack-owner'
): Promise<string | null> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials?.create) {
    return null;
  }

  const supported = await isBiometricsSupported();
  if (!supported) return null;

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userHandle = new Uint8Array(16);
    window.crypto.getRandomValues(userHandle);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'LendTrack Secure Ledger',
          id: window.location.hostname || 'localhost',
        },
        user: {
          id: userHandle,
          name: userId,
          displayName: 'LendTrack Business Owner',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (credential && credential.rawId) {
      return bufferToBase64(credential.rawId);
    }
  } catch (err: unknown) {
    console.warn('Biometric credential creation cancelled or failed:', err);
  }

  return null;
}

/**
 * Trigger Biometric Authentication (Touch ID / Face ID / Fingerprint sensor).
 * Uses registered platform credential to verify identity.
 */
export async function authenticateWithBiometrics(
  _promptReason: string = 'Unlock LendTrack'
): Promise<boolean> {
  const config = getSecurityConfig();
  if (!config.biometricsEnabled) {
    return false;
  }

  const supported = await isBiometricsSupported();
  if (!supported || typeof window === 'undefined' || !navigator.credentials?.get) {
    return false;
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      rpId: window.location.hostname || 'localhost',
    };

    // If an existing registered credential ID is stored, bind to it
    if (config.biometricCredentialId) {
      try {
        const rawBuffer = base64ToBuffer(config.biometricCredentialId);
        publicKeyOptions.allowCredentials = [
          {
            id: rawBuffer,
            type: 'public-key',
          },
        ];
      } catch {
        // Continue without allowCredentials restriction
      }
    }

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyOptions,
    });

    return !!assertion;
  } catch (err: unknown) {
    console.warn('Biometric authentication cancelled or failed:', err);
    return false;
  }
}
