'use client';

import React, { useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        router.replace('/admin');
        router.refresh();
      } else {
        setError(data.message || 'رمز المرور غير صحيح');
        setPin('');
      }
    } catch {
      setError('تعذر الاتصال بالسيرفر. تحقق من الشبكة وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-slate-900/90 backdrop-blur-2xl border-2 border-amber-500/30 rounded-3xl p-7 text-center shadow-2xl space-y-4 animate-fadeIn"
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>WEDDINGPASS • لوحة الإدارة</span>
          </div>
          <h1 className="text-lg font-bold font-royal-heading gold-gradient-text">شاشة القفل المشفرة</h1>
          <p className="text-xs text-slate-400 mt-1">
            أدخل رمز المرور الإداري للوصول لقائمة الضيوف وإعدادات الحفل
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-bold"
          >
            {error}
          </div>
        )}

        <input
          type="password"
          inputMode="text"
          autoComplete="current-password"
          maxLength={64}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••••••••••"
          aria-label="رمز المرور الإداري"
          className="w-full text-center tracking-[0.35em] text-xl font-mono bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-amber-400 focus:outline-none font-data"
          autoFocus
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 gold-gradient-bg text-slate-950 font-bold rounded-xl text-xs shadow-md hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'جارٍ التحقق…' : 'دخول لوحة التحكم 🚀'}
        </button>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          الجلسة مشفرة بـ HMAC وتُحفظ في كوكي HttpOnly لمدة 4 ساعات.
          <br />
          رمز الإدارة مستقل عن رموز البوابات ويُضبط عبر متغير البيئة.
        </p>
      </form>
    </div>
  );
}
