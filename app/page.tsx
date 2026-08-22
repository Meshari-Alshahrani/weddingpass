import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  QrCode,
  ShieldCheck,
  Zap,
  Users,
  MessageCircle,
  Activity,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Layers,
  Settings,
  HelpCircle,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200">
      {/* Decorative Top Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Navigation */}
      <nav className="w-full max-w-6xl mx-auto p-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl gold-gradient-bg flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20 font-serif text-lg">
            W
          </div>
          <span className="text-xl font-bold font-serif gold-gradient-text tracking-wide">
            WeddingPass
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="py-2 px-4 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-500/40 text-xs font-semibold text-slate-200 transition-colors"
          >
            لوحة الإدارة
          </Link>
          <Link
            href="/checkin"
            className="py-2 px-4 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold shadow-md hover:brightness-110 transition-all"
          >
            ماسح البوابة PWA
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="w-full max-w-5xl mx-auto px-6 py-12 text-center space-y-8 relative z-10 my-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>إدارة دعوات الزفاف، تأكيد الحضور، ودخول القاعة بالباركود</span>
        </div>

        <div className="space-y-4 max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-extrabold font-serif gold-gradient-text leading-tight sm:leading-tight">
            دعوتك الفاخرة، تأكيد حضور ضيوفك، وبطاقات الدخول
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            نظام متكامل يربط بين إرسال دعوات الزفاف عبر واتساب، تأكيد الحضور من الضيوف، وإصدار بطاقات الدخول الآمنة مع المسح السريع عند بوابات القاعة.
          </p>
        </div>

        {/* Action Portal Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-6 text-right">
          {/* Card 1: Guest Demo Invitation */}
          <Link
            href="/i/wp_inv_demo_1_أحم"
            className="p-6 rounded-3xl bg-slate-900/90 border border-amber-500/30 hover:border-amber-400/70 transition-all group shadow-xl hover:-translate-y-1 block"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100 font-serif">
              تجربة دعوة الضيف (RSVP)
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              معاينة صفحة الدعوة، تأكيد الحضور وعدد الأشخاص، وتوليد بطاقة الدخول بـ QR.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-amber-400 font-bold">
              <span>فتح نموذج الدعوة</span>
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Gate Scanner PWA */}
          <Link
            href="/checkin"
            className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition-all group shadow-xl hover:-translate-y-1 block"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100 font-serif">
              ماسح البوابة (Gate Mode)
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              تطبيق موظف الاستقبال لمسح باركود بطاقة الدخول عند وصول الضيوف للقاعة.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
              <span>تشغيل الماسح</span>
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Admin Dashboard */}
          <Link
            href="/admin"
            className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all group shadow-xl hover:-translate-y-1 block"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-300 mb-4 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100 font-serif">
              لوحة تحكم المنظم
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              تعديل بيانات الحفل، استيراد أسماء الضيوف من Excel، وإرسال رسائل WhatsApp.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-amber-300 font-bold">
              <span>الدخول للإدارة</span>
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* 3-Step Simple Explanation of the Workflow */}
        <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-8 max-w-4xl mx-auto text-right space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold font-serif gold-gradient-text">كيف يعمل النظام لزواجك في 3 خطوات؟</h2>
            <p className="text-xs text-slate-400">طريقة بسيطة وسلسة بدون أي تعقيد تقني</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-2 p-4 bg-slate-950/70 rounded-2xl border border-slate-800">
              <div className="w-7 h-7 rounded-lg gold-gradient-bg text-slate-950 font-bold flex items-center justify-center text-xs">
                1
              </div>
              <h3 className="text-sm font-bold text-slate-200">ضع بيانات الحفل والضيوف</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                في لوحة الإدارة، اكتب أسماء العروسين وتاريخ الحفل، وضع صورة كرت الدعوة إن وجدت، ثم ارفع ملف الإكسل بأسماء وأرقام الضيوف.
              </p>
            </div>

            <div className="space-y-2 p-4 bg-slate-950/70 rounded-2xl border border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                2
              </div>
              <h3 className="text-sm font-bold text-slate-200">أرسل عبر WhatsApp بضغطة زر</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                اضغط على زر &quot;واتساب&quot; بجانب كل ضيف ليفتح لك رسالة جاهزة برابط دعوته الخاصة، ليرى الدعوة ويؤكد حضوره ويستلم بطاقته.
              </p>
            </div>

            <div className="space-y-2 p-4 bg-slate-950/70 rounded-2xl border border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-cyan-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                3
              </div>
              <h3 className="text-sm font-bold text-slate-200">مسح البطاقات عند البوابة</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                يوم الزواج، يفتح موظف البوابة كاميرا الجوال لمسح باركود بطاقة الدخول، فيسجل الحضور فورياً ويمنع تكرار استخدام نفس البطاقة.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-right border-t border-slate-800/80">
          <div className="space-y-1.5 p-3">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
              <Lock className="w-4 h-4" />
              <span>منع تكرار البطاقة</span>
            </div>
            <p className="text-[11px] text-slate-400">
              حماية مباشرة تمنع استخدام نفس كود الدخول أكثر من مرة.
            </p>
          </div>

          <div className="space-y-1.5 p-3">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <MessageCircle className="w-4 h-4" />
              <span>إرسال واتساب مباشر</span>
            </div>
            <p className="text-[11px] text-slate-400">
              روابط واتساب سريعة ترسل من جهازك دون أي اشتراكات إضافية.
            </p>
          </div>

          <div className="space-y-1.5 p-3">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold">
              <Layers className="w-4 h-4" />
              <span>فصل الدعوة عن البطاقة</span>
            </div>
            <p className="text-[11px] text-slate-400">
              بطاقة الدخول لا تظهر إلا بعد تأكيد الضيف لحضوره.
            </p>
          </div>

          <div className="space-y-1.5 p-3">
            <div className="flex items-center gap-2 text-purple-400 text-xs font-bold">
              <Zap className="w-4 h-4" />
              <span>سرعة وسهولة عند الباب</span>
            </div>
            <p className="text-[11px] text-slate-400">
              تسجيل دخول الضيوف بنقرة واحدة مع تنبيهات صوتية واضحة.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto p-6 text-center text-xs text-slate-500 border-t border-slate-900 relative z-10">
        <p>WeddingPass • نظام إدارة بطاقات الدخول ودعوات الزواج © 2026</p>
      </footer>
    </div>
  );
}
