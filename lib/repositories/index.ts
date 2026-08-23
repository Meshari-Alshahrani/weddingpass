import { isSupabaseConfigured, supabaseAdmin } from '../db/supabase.ts';
import { SupabaseRepository } from './supabase/SupabaseRepository.ts';
import { MockRepository } from './mock/MockRepository.ts';

let supabaseRepoInstance: SupabaseRepository | null = null;
let mockRepoInstance: MockRepository | null = null;

export function getRepository() {
  const isProduction = process.env.NODE_ENV === 'production';

  // Production must never fall back to ephemeral process memory.  A missing
  // service-role configuration is an operational error, not a development mode.
  if (isProduction && (!isSupabaseConfigured || !supabaseAdmin)) {
    throw new Error('FATAL CONFIGURATION ERROR: Supabase URL and service-role key are required in production.');
  }

  if (isSupabaseConfigured && supabaseAdmin) {
    if (!supabaseRepoInstance) {
      supabaseRepoInstance = new SupabaseRepository();
    }
    return supabaseRepoInstance;
  }

  // Mock data is intentionally opt-in outside tests so a local deployment cannot
  // mistake ephemeral data for the real guest list.
  if (process.env.NODE_ENV !== 'test' && process.env.WEDDINGPASS_ALLOW_MOCK !== 'true') {
    throw new Error('Supabase is not configured. Set WEDDINGPASS_ALLOW_MOCK=true only for local development.');
  }

  if (!mockRepoInstance) {
    mockRepoInstance = new MockRepository();
  }
  return mockRepoInstance;
}

export * from './types.ts';
