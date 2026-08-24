import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/db/supabase';
import { getDefaultEvent, getEventStats, getCheckInLogs } from '@/lib/db/store';
import { getVerifiedAdminSession } from '@/lib/security/adminAuth';
import { APP_VERSION } from '@/lib/appVersion';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

// Cache the deep diagnostics for 60s so repeated dashboard refreshes or
// pre-event checks do not hammer Supabase with probes.
let cachedDiagnostics: { at: number; payload: Record<string, any> } | null = null;
const DIAGNOSTICS_TTL_MS = 60_000;

/**
 * Non-mutating RPC reachability probe.
 *
 * process_secure_checkin writes an audit row even on NOT_FOUND, so we probe
 * with event_id=NULL and a sentinel hash tagged station 'health-probe': the
 * call is guaranteed to take the NOT_FOUND path, touches no guest data, and
 * leaves a single self-identifying audit record instead of hidden side effects.
 */
async function probeAtomicCheckinRpc(): Promise<{ reachable: boolean; detail: string }> {
  if (!supabaseAdmin) return { reachable: false, detail: 'supabase client unavailable' };
  try {
    const sentinelHash = crypto.createHash('sha256').update(`health-probe:${Date.now()}`).digest('hex');
    const { data, error } = await supabaseAdmin.rpc('process_secure_checkin', {
      p_event_id: null,
      p_pass_token_hash: sentinelHash,
      p_station_name: 'health-probe',
      p_operator_name: 'system-health',
      p_checkin_type: 'QR_SCAN',
      p_override_count: null,
      p_gate_section: 'general',
      p_force_cross_section: false,
      p_queue_id: null,
      p_device_metadata: null,
    });
    if (error) return { reachable: false, detail: error.message };
    const ok = data?.code === 'NOT_FOUND';
    return { reachable: ok, detail: ok ? 'NOT_FOUND as expected' : `unexpected code: ${data?.code}` };
  } catch (err: any) {
    return { reachable: false, detail: err.message };
  }
}

async function probeStorage(): Promise<{ configured: boolean; detail: string }> {
  if (!supabaseAdmin) return { configured: false, detail: 'supabase client unavailable' };
  try {
    const { error } = await supabaseAdmin.storage.from('moments').list('', { limit: 1 });
    return { configured: !error, detail: error ? error.message : 'bucket accessible' };
  } catch (err: any) {
    return { configured: false, detail: err.message };
  }
}

async function probeRateLimiter(): Promise<{ mode: string; distributedStoreReachable: boolean | null }> {
  const mode = process.env.RATE_LIMITER_MODE || (process.env.NODE_ENV === 'production' ? 'distributed' : 'local');
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (mode === 'local') return { mode, distributedStoreReachable: null };
  if (!kvUrl || !kvToken) return { mode, distributedStoreReachable: false };

  try {
    const res = await fetch(`${kvUrl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', `rl:health:${Math.floor(Date.now() / 60_000)}`], ['EXPIRE', `rl:health:${Math.floor(Date.now() / 60_000)}`, 120]]),
    });
    return { mode, distributedStoreReachable: res.ok };
  } catch {
    return { mode, distributedStoreReachable: false };
  }
}

function checkSecrets() {
  const prod = process.env.NODE_ENV === 'production';
  return {
    gate_session_secret: Boolean(process.env.GATE_SESSION_SECRET || !prod) ? 'configured' : 'missing',
    admin_secret: Boolean(process.env.ADMIN_SECRET || !prod) ? 'configured' : 'missing',
    supervisor_pin: Boolean(process.env.SUPERVISOR_PIN || !prod) ? 'configured' : 'missing',
    admin_pin: Boolean(process.env.ADMIN_PIN || !prod) ? 'configured' : 'missing',
  };
}

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

  // 2. Serve cached diagnostics when fresh
  if (cachedDiagnostics && Date.now() - cachedDiagnostics.at < DIAGNOSTICS_TTL_MS) {
    return NextResponse.json({
      success: true,
      cached: true,
      timestamp,
      version: APP_VERSION,
      adminId: adminSession.adminId,
      adminRole: adminSession.role,
      ...cachedDiagnostics.payload,
    });
  }

  const checks: Record<string, any> = {};
  checks.secrets = checkSecrets();
  checks.rpc_probe = await probeAtomicCheckinRpc();
  checks.storage = await probeStorage();
  checks.rate_limiter = await probeRateLimiter();

  // Check Database connection + operational snapshot
  const startDb = Date.now();
  let eventStats: any = null;
  let recentLogsCount = 0;

  try {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      throw new Error('Supabase server credentials are not configured');
    }

    const { error: connectionError } = await supabaseAdmin.from('events').select('id').limit(1);
    if (connectionError) throw connectionError;

    const event = await getDefaultEvent();
    checks.db_latency_ms = Date.now() - startDb;
    checks.database_driver = 'supabase_postgresql_direct';
    checks.event_loaded = event.id ? 'ok' : 'error';
    checks.event_bound_to_session = adminSession.eventId === event.id;

    [eventStats, recentLogsCount] = await Promise.all([
      getEventStats(event.id),
      getCheckInLogs(event.id).then((logs) => logs.length).catch(() => 0),
    ]);
  } catch (err: any) {
    checks.database_error = err.message;
  }

  const dbOk = !checks.database_error && checks.event_loaded === 'ok';
  const allCriticalOk =
    dbOk &&
    checks.rpc_probe.reachable &&
    Object.values(checks.secrets).every((v) => v === 'configured');

  const payload = {
    status: allCriticalOk ? 'operational' : 'degraded',
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
  };

  cachedDiagnostics = { at: Date.now(), payload };

  return NextResponse.json({
    success: true,
    cached: false,
    timestamp,
    version: APP_VERSION,
    adminId: adminSession.adminId,
    adminRole: adminSession.role,
    ...payload,
  });
}
