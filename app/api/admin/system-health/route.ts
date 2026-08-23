import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/db/supabase';
import { getDefaultEvent, getEventStats, getCheckInLogs } from '@/lib/db/store';
import { getVerifiedAdminSession } from '@/lib/security/adminAuth';
import { APP_VERSION } from '@/lib/appVersion';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 1. Strictly Protected Admin Endpoint
  const adminSession = await getVerifiedAdminSession(req);
  if (!adminSession) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'فحص صحة النظام الإداري يتطلب جلسة مشرف موثقة' },
      { status: 401 }
    );
  }

  const timestamp = new Date().toISOString();
  const checks: Record<string, any> = {};

  // Check Secrets
  checks.gate_session_secret = Boolean(process.env.GATE_SESSION_SECRET || process.env.NODE_ENV !== 'production') ? 'configured' : 'missing';
  checks.admin_secret = Boolean(process.env.ADMIN_SECRET || process.env.NODE_ENV !== 'production') ? 'configured' : 'missing';
  checks.supervisor_pin = Boolean(process.env.SUPERVISOR_PIN || process.env.NODE_ENV !== 'production') ? 'configured' : 'missing';

  // Check Database & Latency
  const startDb = Date.now();
  let eventStats: any = null;
  let recentLogsCount = 0;
  let dbLatencyMs = 0;

  try {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      throw new Error('Supabase server credentials are not configured');
    }

    const { error: connectionError } = await supabaseAdmin.from('events').select('id').limit(1);
    if (connectionError) throw connectionError;

    const event = await getDefaultEvent();
    dbLatencyMs = Date.now() - startDb;
    eventStats = await getEventStats(event.id);
    const logs = await getCheckInLogs(event.id);
    recentLogsCount = logs.length;

    checks.database_driver = 'supabase_postgresql_direct';
    checks.db_latency_ms = dbLatencyMs;
    checks.event_loaded = event.id ? 'ok' : 'error';
    checks.atomic_checkin_rpc = 'configured_for_service_role';
  } catch (err: any) {
    checks.database_error = err.message;
  }

  return NextResponse.json({
    success: true,
    status: checks.event_loaded === 'ok' ? 'operational' : 'degraded',
    timestamp,
    version: APP_VERSION,
    adminId: adminSession.adminId,
    adminRole: adminSession.role,
    diagnostics: checks,
    eventMetrics: eventStats
      ? {
          totalParties: eventStats.totalParties,
          totalAllowed: eventStats.totalAllowed,
          totalConfirmed: eventStats.totalConfirmed,
          totalCheckedIn: eventStats.totalCheckedIn,
          recentLogsCount,
        }
      : null,
  });
}
