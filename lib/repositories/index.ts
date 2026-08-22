import { isSupabaseConfigured, supabaseAdmin } from '../db/supabase.ts';
import { SupabaseRepository } from './supabase/SupabaseRepository.ts';
import { MockRepository } from './mock/MockRepository.ts';

let supabaseRepoInstance: SupabaseRepository | null = null;
let mockRepoInstance: MockRepository | null = null;

export function getRepository() {
  // If Supabase keys are configured in environment, use Supabase Repository
  if (isSupabaseConfigured && supabaseAdmin) {
    if (!supabaseRepoInstance) {
      supabaseRepoInstance = new SupabaseRepository();
    }
    return supabaseRepoInstance;
  }

  // Fallback to MockRepository if Supabase is not yet configured in environment variables
  if (!mockRepoInstance) {
    mockRepoInstance = new MockRepository();
  }
  return mockRepoInstance;
}

export * from './types.ts';
