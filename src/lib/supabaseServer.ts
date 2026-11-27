import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed.startsWith('http')) return '';
  return trimmed.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

function isValidSupabaseKey(rawKey: string | undefined, requireSecret = false): rawKey is string {
  if (!rawKey) return false;
  const trimmed = rawKey.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (requireSecret) {
    return trimmed.startsWith('sb_secret_') || trimmed.startsWith('eyJ');
  }
  return (
    trimmed.startsWith('sb_secret_') ||
    trimmed.startsWith('sb_publishable_') ||
    trimmed.startsWith('eyJ')
  );
}

const envServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const envPublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL);
export const SUPABASE_KEY = isValidSupabaseKey(envServiceKey, true)
  ? envServiceKey.trim()
  : isValidSupabaseKey(envPublishableKey)
    ? envPublishableKey.trim()
    : '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

const fetchWithTimeout: typeof fetch = (input, init) => {
  if (init?.signal) {
    return fetch(input, init);
  }
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(4000),
  });
};

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'http://127.0.0.1:54321',
  SUPABASE_KEY || 'unconfigured',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: fetchWithTimeout,
    },
  }
);

