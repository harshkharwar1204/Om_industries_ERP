import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
// Server-only client. Prefer the service_role secret (bypasses RLS); fall back to
// SUPABASE_KEY where the secret isn't set. NEVER import this into a client component —
// it would leak the secret to the browser. Frontend talks to our own /api routes instead.
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!;

if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_KEY env vars');

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
