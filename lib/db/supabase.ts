import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 2026 Modern & Legacy Variable Resolution
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Server data access is valid only with the service-role key.  Treating a
// publishable key as an admin client can silently bypass the production path.
export const isSupabaseConfigured = Boolean(supabaseUrl && secretKey);
export const isSupabasePublicConfigured = Boolean(supabaseUrl && publishableKey);

// Public Client (Browser / Next.js Public Client)
export const supabase: SupabaseClient | null = isSupabasePublicConfigured
  ? createClient(supabaseUrl, publishableKey)
  : null;

// Server-Side Secret Client (Direct Database & Atomic RPC Execution with Bypass of RLS)
export const supabaseAdmin: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
