'use client';

import React, { useState, useEffect } from 'react';
import { WeddingEvent, CheckInLog } from '@/types/database';
import {
  Activity,
  Users,
  UserCheck,
  QrCode,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Home,
} from 'lucide-react';
import Link from 'next/link';

interface LiveMonitorProps {
  initialEvent: WeddingEvent;
  initialStats: any;
  initialLogs: CheckInLog[];
}

export function LiveMonitor({ initialEvent, initialStats, initialLogs }: LiveMonitorProps) {
  const [stats, setStats] = useState(initialStats);
  const [logs, setLogs] = useState<CheckInLog[]>(initialLogs);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    setLastUpdate(new Date().toLocaleTimeString('ar-SA'));
    const fetchLatest = async () => {
      try {
        const res = await fetch('/api/admin');
        const data = await res.json();
        if (data.success) {
          setStats(data.stats);
          setLogs(data.logs);
          setLastUpdate(new Date().toLocaleTimeString('ar-SA'));
        }
      } catch (err) {
        console.error('Live polling error:', err);
      }
    };

    const interval = setInterval(fetchLatest, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10 flex flex-col justify-between space-y-8">
      {/* Top Banner */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-serif gold-gradient-text">
              شاشة المراقبة المباشرة للحضور • حفل زفاف {initialEvent.groom_name} & {initialEvent.bride_name}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              تحديث تلقائي مستمر {lastUpdate ? `• آخر تحديث: ${lastUpdate}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="py-2 px-3.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>الرئيسية</span>
          </Link>

          <Link
            href="/admin"
            className="py-2 px-4 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>لوحة الإدارة</span>
          </Link>
        </div>
      </header>

      {/* Big KPI Monitor Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>المتوقع حضورهم</span>
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-4xl sm:text-5xl font-extrabold text-slate-100 font-serif">
            {stats.expectedGuests}
          </p>
          <p className="text-xs text-slate-500">من أصل {stats.confirmedParties} دعوة مؤكدة</p>
        </div>

        <div className="bg-emerald-950/30 rounded-3xl p-6 border border-emerald-500/40 shadow-2xl space-y-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold">
            <span>أشخاص دخلوا القاعة</span>
            <UserCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-4xl sm:text-5xl font-extrabold text-emerald-300 font-serif">
            {stats.totalAdmittedIndividuals}
          </p>
          <p className="text-xs text-emerald-400/80 font-bold">
            {stats.usedPasses} بطاقة تم مسحها عند الأبواب
          </p>
        </div>

        <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>في انتظار الوصول</span>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-4xl sm:text-5xl font-extrabold text-amber-300 font-serif">
            {Math.max(0, stats.expectedGuests - stats.totalAdmittedIndividuals)}
          </p>
          <p className="text-xs text-amber-400/70">أفراد لم يدخلوا بعد</p>
        </div>

        <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>نسبة الحضور الحالية</span>
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <p className="text-4xl sm:text-5xl font-extrabold text-cyan-300 font-serif">
            {stats.attendanceRate}%
          </p>
          <div className="w-full bg-slate-800 rounded-full h-2 mt-2">
            <div
              className="bg-cyan-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, stats.attendanceRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Live Check-in Stream Feed */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl flex-1 flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>بث عمليات الدخول المباشرة عند الأبواب</span>
          </h2>
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>مباشر</span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[420px] pr-1">
          {logs.length === 0 && (
            <div className="text-center py-16 text-slate-500 text-sm">
              لم يتم تسجيل أي حركة دخول حتى الآن. بانتظار وصول الضيوف...
            </div>
          )}

          {logs.map((log) => {
            const timeStr = new Date(log.created_at).toLocaleTimeString('ar-SA', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={log.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                  log.scan_result === 'SUCCESS'
                    ? 'bg-slate-950/80 border-emerald-500/30 text-emerald-200'
                    : log.scan_result === 'ALREADY_CHECKED_IN'
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    {log.scan_result === 'SUCCESS' ? (
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      <span>{log.scan_result === 'SUCCESS' ? 'دخول مصرح' : 'تنبيه: محاولة مسح مكررة'}</span>
                      <span className="text-[11px] font-normal bg-slate-800 px-2 py-0.5 rounded-md text-slate-300">
                        {log.station_name}
                      </span>
                      {log.checkin_type === 'MANUAL_SEARCH' && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                          يدوي
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      المسؤول: {log.operator_name} • {log.admitted_count > 0 ? `${log.admitted_count} أفراد` : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-slate-300">{timeStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
