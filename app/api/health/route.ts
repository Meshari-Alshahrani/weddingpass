import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/db/supabase';
import { APP_VERSION } from '@/lib/appVersion';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const timestamp = new Date().toISOString();
  let dbStatus = 'unavailable';

  try {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      throw new Error('Supabase server credentials are not configured');
    }

    const { error } = await supabaseAdmin.from('events').select('id').limit(1);
    if (error) throw error;
    dbStatus = 'connected';
  } catch (err: any) {
    dbStatus = 'unreachable';
  }

  const isHealthy = dbStatus === 'connected';

  // Public Health Endpoint: Pure infrastructure status without leaking business metrics
  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp,
      version: APP_VERSION,
      database: dbStatus,
    },
    { status: isHealthy ? 200 : 503 }
  );
}
