import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://ypoetsrjbdgzobrxbkfl.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kCzHckV7IPhC7EDN8xrP4A_dj6OH4rc';

function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  const trimmed = (rawUrl || DEFAULT_SUPABASE_URL).trim();
  if (!trimmed.startsWith('http')) return DEFAULT_SUPABASE_URL;
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

export const SUPABASE_PROJECT_ID = 'ypoetsrjbdgzobrxbkfl';
export const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL);
export const SUPABASE_KEY = isValidSupabaseKey(envServiceKey, true)
  ? envServiceKey.trim()
  : isValidSupabaseKey(envPublishableKey)
    ? envPublishableKey.trim()
    : DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
