import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://ypoetsrjbdgzobrxbkfl.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kCzHckV7IPhC7EDN8xrP4A_dj6OH4rc';

function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  const trimmed = (rawUrl || DEFAULT_SUPABASE_URL).trim();
  return trimmed.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

export const SUPABASE_PROJECT_ID = 'ypoetsrjbdgzobrxbkfl';
export const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL);
export const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
