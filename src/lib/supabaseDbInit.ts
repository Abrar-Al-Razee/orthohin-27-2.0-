import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let schemaInitialized = false;

function resolveSupabaseDbUrl(): string | null {
  const candidates = [process.env.SUPABASE_DB_URL, process.env.DATABASE_URL];
  for (const raw of candidates) {
    if (!raw) continue;
    const trimmed = raw.trim();
    if (
      trimmed.startsWith('postgres') &&
      trimmed.includes('ypoetsrjbdgzobrxbkfl.supabase.co') &&
      !trimmed.includes('[YOUR-PASSWORD]')
    ) {
      return trimmed;
    }
  }
  return null;
}

export async function ensureSupabaseSchema(): Promise<boolean> {
  if (schemaInitialized) return true;

  const dbUrl = resolveSupabaseDbUrl();
  if (!dbUrl) return false;

  const schemaPath = path.resolve(__dirname, '../../supabase/schema.sql');
  if (!fs.existsSync(schemaPath)) return false;

  const sql = fs.readFileSync(schemaPath, 'utf8');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    await pool.query(sql);
    schemaInitialized = true;
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`Supabase Postgres auto-init skipped: ${msg}`);
    return false;
  } finally {
    await pool.end().catch(() => {
      // Ignore pool shutdown errors
    });
  }
}
