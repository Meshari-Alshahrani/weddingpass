import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 2026 Modern & Legacy Variable Resolution
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && (publishableKey || secretKey));

// Public Client (Browser / Next.js Public Client)
export const supabase: SupabaseClient | null = isSupabaseConfigured && publishableKey
  ? createClient(supabaseUrl, publishableKey)
  : null;

// Server-Side Secret Client (Direct Database & Atomic RPC Execution with Bypass of RLS)
export const supabaseAdmin: SupabaseClient | null = isSupabaseConfigured && secretKey
  ? createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabase;
