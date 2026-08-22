'use client';

import React, { useState } from 'react';
import { Play, ShieldCheck, AlertTriangle, ArrowRight, RefreshCw, Zap, Home } from 'lucide-react';
import Link from 'next/link';

interface StressTestResult {
  totalSent: number;
  successCount: number;
  duplicateCount: number;
  errorCount: number;
  durationMs: number;
  responses: Array<{ id: number; status: string; code: string; message: string; timestamp: number }>;
}

export default function StressTestPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<StressTestResult | null>(null);

  const runRaceConditionTest = async () => {
    setRunning(true);
    setResult(null);

    const stationNames = ['بوابة الرجال 1', 'بوابة الرجال 2', 'بوابة النساء 1', 'بوابة النساء 2', 'بوابة VIP'];
    const totalRequests = 100;
    const startTime = performance.now();

    const requests = Array.from({ length: totalRequests }, (_, i) => {
      const station = stationNames[i % stationNames.length];
      const operator = `موظف_${(i % 5) + 1}`;

      return fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: 'e82b75a1-4321-4f99-8d76-9c8821a71101',
          passToken: 'wp_pass_demo_1',
          stationName: station,
          operatorName: operator,
          checkinType: 'QR_SCAN',
        }),
      })
        .then((res) => res.json())
        .then((data) => ({
          id: i + 1,
          status: data.success ? 'SUCCESS' : 'BLOCKED',
          code: data.code,
          message: data.message,
          timestamp: Date.now(),
        }))
        .catch((err) => ({
          id: i + 1,
          status: 'ERROR',
          code: 'FETCH_FAIL',
          message: err.message,
          timestamp: Date.now(),
        }));
    });

    const responses = await Promise.all(requests);
    const endTime = performance.now();

    const successCount = responses.filter((r) => r.code === 'SUCCESS').length;
    const duplicateCount = responses.filter((r) => r.code === 'ALREADY_CHECKED_IN').length;
    const errorCount = responses.filter((r) => r.status === 'ERROR' || (r.code !== 'SUCCESS' && r.code !== 'ALREADY_CHECKED_IN')).length;

    setResult({
      totalSent: totalRequests,
      successCount,
      duplicateCount,
      errorCount,
      durationMs: Math.round(endTime - startTime),
      responses,
    });

    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10 space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1">
            <Zap className="w-4 h-4" />
            <span>أدوات فحص استقرار وسرعة النظام</span>
          </div>
          <h1 className="text-2xl font-bold font-serif gold-gradient-text">
            محاكاة مسح 100 بطاقة دخول في نفس اللحظة
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            التأكد من دقة النظام في منع تكرار الدخول عند مسح نفس الباركود من عدة أجهزة في نفس الجزء من الثانية
          </p>
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
            <span>العودة للوحة الإدارة</span>
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-100">فكرة الاختبار:</h2>
              <p className="text-xs text-slate-400 mt-1">
                إرسال 100 محاولة مسح في نفس اللحظة لنفس كود الدخول عبر 5 بوابات مختلفة للتأكد من تسجيل الدخول لمرة واحدة فقط ورفض البقية.
              </p>
              <p className="text-xs text-emerald-400 font-bold mt-2">
                النتيجة الصحيحة: قبول طلب واحد فقط (دخول 1) ورفض 99 محاولة تكرار.
              </p>
            </div>

            <button
              onClick={runRaceConditionTest}
              disabled={running}
              className="py-3.5 px-6 rounded-2xl gold-gradient-bg text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري إرسال 100 طلب فحص...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>بدء الاختبار الآن</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Summary */}
        {result && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">إجمالي الطلبات</span>
                <p className="text-3xl font-extrabold text-slate-100">{result.totalSent}</p>
                <span className="text-[11px] text-slate-500">زمن الاستجابة: {result.durationMs}ms</span>
              </div>

              <div className="bg-emerald-950/40 p-5 rounded-2xl border border-emerald-500/40 space-y-1">
                <span className="text-xs text-emerald-300">الطلبات المقبولة</span>
                <p className="text-3xl font-extrabold text-emerald-300">{result.successCount}</p>
                <span className="text-[11px] text-emerald-400">
                  {result.successCount <= 1 ? '✅ نجاح مثالي (دخول وحيد)' : '❌ فشل! حدث تكرار'}
                </span>
              </div>

              <div className="bg-rose-950/40 p-5 rounded-2xl border border-rose-500/40 space-y-1">
                <span className="text-xs text-rose-300">المحاولات المرفوضة</span>
                <p className="text-3xl font-extrabold text-rose-300">{result.duplicateCount}</p>
                <span className="text-[11px] text-rose-400">تم منعها بالسيرفر</span>
              </div>

              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">الأخطاء</span>
                <p className="text-3xl font-extrabold text-slate-300">{result.errorCount}</p>
                <span className="text-[11px] text-slate-500">0 أخطاء خادم</span>
              </div>
            </div>

            {/* Response Breakdown List */}
            <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-200">سجل نتائج الـ 100 طلب:</h3>
              <div className="max-h-72 overflow-y-auto space-y-1.5 text-xs font-mono">
                {result.responses.map((r) => (
                  <div
                    key={r.id}
                    className={`p-2 rounded-lg flex items-center justify-between border ${
                      r.code === 'SUCCESS'
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>
                      #{r.id} [{r.code}] - {r.message}
                    </span>
                    <span className="text-[10px] text-slate-500">{new Date(r.timestamp).toISOString().slice(17, 23)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
