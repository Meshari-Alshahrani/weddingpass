import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/db/supabase';
import { getDefaultEvent, getEventStats } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  const timestamp = new Date().toISOString();
  const checks: Record<string, string> = {};

  // 1. Check Auth Secrets Configuration
  const hasGateSecret = Boolean(process.env.GATE_SESSION_SECRET);
  const hasAdminSecret = Boolean(process.env.ADMIN_SECRET);
  const hasSupervisorPin = Boolean(process.env.SUPERVISOR_PIN);

  checks.gate_secret = hasGateSecret ? 'ok' : 'missing';
  checks.admin_secret = hasAdminSecret ? 'ok' : 'missing';
  checks.supervisor_pin = hasSupervisorPin ? 'ok' : 'missing';

  // 2. Check Database Connectivity
  let dbStatus = 'ok';
  let eventStatus = 'ok';
  let eventStats: any = null;

  try {
    const event = await getDefaultEvent();
    if (!event || !event.id) {
      eventStatus = 'failed_to_load';
    } else {
      eventStats = await getEventStats(event.id);
    }
  } catch (err: any) {
    dbStatus = `error: ${err.message}`;
    eventStatus = 'unreachable';
  }

  checks.database_connected = isSupabaseConfigured ? 'supabase_postgresql' : 'in_memory_dev_mode';
  checks.event_data = eventStatus;

  const isHealthy = (
    (process.env.NODE_ENV !== 'production' || (hasGateSecret && hasAdminSecret && hasSupervisorPin)) &&
    eventStatus === 'ok'
  );

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp,
      version: '5.7.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      stats: eventStats
        ? {
            totalParties: eventStats.totalParties,
            totalConfirmed: eventStats.totalConfirmed,
            totalCheckedIn: eventStats.totalCheckedIn,
          }
        : null,
    },
    { status: isHealthy ? 200 : 503 }
  );
}
