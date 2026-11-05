/**
 * Supabase Cloud REST Client (Zero-Dependency & Offline-Resilient)
 * 
 * Provides atomic, type-safe REST communication with Supabase PostgREST endpoints.
 * Automatically handles camelCase <-> snake_case transformations, authentication headers,
 * and graceful fallback when credentials are not configured or network is disconnected.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const SUPABASE_CONFIG_STORAGE_KEY = 'lendtrack_supabase_config';

/**
 * Utility to convert camelCase object keys to snake_case (for Postgres).
 */
export function toSnakeCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

/**
 * Utility to convert snake_case object keys to camelCase (for TypeScript domain).
 */
export function toCamelCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

/**
 * Get active Supabase URL and Anon Key.
 * Checks localStorage first (runtime UI config), then Vite env variables.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const stored = globalThis.localStorage.getItem(SUPABASE_CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore storage errors
  }

  // Vite environment variables
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey };
  }

  return null;
}

/**
 * Save custom Supabase credentials from Settings UI.
 */
export function saveSupabaseConfig(config: SupabaseConfig): void {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(SUPABASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear custom Supabase credentials.
 */
export function clearSupabaseConfig(): void {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.removeItem(SUPABASE_CONFIG_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if valid Supabase credentials exist.
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

/**
 * Execute an authenticated Supabase REST request.
 */
export async function executeSupabaseRest(
  endpoint: string,
  options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    timeoutMs?: number;
  }
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const config = getSupabaseConfig();

  // If no cloud credentials configured, simulate local-only success/offline
  if (!config) {
    return {
      ok: false,
      status: 0,
      error: 'Supabase credentials not configured (operating in local-first mode)',
    };
  }

  // Normalize base URL
  const baseUrl = config.url.replace(/\/+$/, '');
  const url = `${baseUrl}/rest/v1/${endpoint.replace(/^\/+/, '')}`;

  const defaultHeaders: Record<string, string> = {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation, resolution=merge-duplicates',
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

  try {
    const response = await fetch(url, {
      method: options.method,
      headers: defaultHeaders,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data: unknown = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      const errorMsg =
        typeof data === 'object' && data !== null && 'message' in data
          ? String((data as { message: unknown }).message)
          : `HTTP error ${response.status}`;
      return { ok: false, status: response.status, data, error: errorMsg };
    }

    return { ok: true, status: response.status, data };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      error: isAbort ? 'Request timed out' : err instanceof Error ? err.message : 'Network error',
    };
  }
}

/**
 * PostgREST Upsert (Insert or Update on conflict of primary key).
 */
export async function upsertCloudRecord(
  table: string,
  record: Record<string, unknown>
): Promise<{ ok: boolean; status: number; error?: string }> {
  const snakeRecord = toSnakeCase(record);
  return await executeSupabaseRest(table, {
    method: 'POST',
    body: snakeRecord,
    headers: {
      Prefer: 'return=minimal, resolution=merge-duplicates',
    },
  });
}

/**
 * PostgREST Delete record by ID.
 */
export async function deleteCloudRecord(
  table: string,
  recordId: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  return await executeSupabaseRest(`${table}?id=eq.${recordId}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });
}
