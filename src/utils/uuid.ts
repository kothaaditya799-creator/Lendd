/**
 * Universal RFC 4122 Version 4 UUID Generator.
 * 
 * Works reliably across all environments:
 * 1. Native crypto.randomUUID() when in a Secure Context (HTTPS or localhost).
 * 2. crypto.getRandomValues() when available.
 * 3. High-entropy Math.random() fallback for non-secure contexts (e.g. testing on mobile over http://192.168.x.x).
 */
export function generateUUID(): string {
  // 1. Try native crypto.randomUUID
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through to fallback if it fails in edge cases
    }
  }

  // 2. Try crypto.getRandomValues if available
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);

      // Set RFC 4122 version 4 and variant
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch {
      // Fall through to Math.random
    }
  }

  // 3. Robust fallback (RFC 4122 v4 compliant string template)
  let d = new Date().getTime();
  let d2 = (typeof performance !== 'undefined' && performance.now && performance.now() * 1000) || 0;

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    let r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
