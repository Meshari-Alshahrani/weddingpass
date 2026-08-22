import { isSupabaseConfigured, supabaseAdmin } from '../db/supabase.ts';
import { SupabaseRepository } from './supabase/SupabaseRepository.ts';
import { MockRepository } from './mock/MockRepository.ts';

let supabaseRepoInstance: SupabaseRepository | null = null;
let mockRepoInstance: MockRepository | null = null;

export function getRepository() {
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, enforce Supabase Repository strictly (Fail-Closed)
  if (isProduction) {
    if (!supabaseRepoInstance) {
      supabaseRepoInstance = new SupabaseRepository();
    }
    return supabaseRepoInstance;
  }

  // In development, if Supabase keys exist, use Supabase
  if (isSupabaseConfigured && supabaseAdmin) {
    if (!supabaseRepoInstance) {
      supabaseRepoInstance = new SupabaseRepository();
    }
    return supabaseRepoInstance;
  }

  // In local test / zero-config dev mode, use isolated MockRepository
  if (!mockRepoInstance) {
    mockRepoInstance = new MockRepository();
  }
  return mockRepoInstance;
}

export * from './types.ts';
