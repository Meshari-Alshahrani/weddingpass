import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/db/supabase';
import { getDefaultEvent } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const timestamp = new Date().toISOString();
  let dbStatus = 'ok';

  try {
    const event = await getDefaultEvent();
    if (!event || !event.id) {
      dbStatus = 'unavailable';
    }
  } catch (err: any) {
    dbStatus = 'unreachable';
  }

  const isHealthy = dbStatus === 'ok';

  // Public Health Endpoint: Pure infrastructure status without leaking business metrics
  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp,
      version: '5.8.0',
      database: dbStatus,
    },
    { status: isHealthy ? 200 : 503 }
  );
}
