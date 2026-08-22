'use client';

import React, { useState, useEffect } from 'react';
import { GroupInviteLink, WeddingEvent, Party, EntryPass } from '@/types/database';
import { EntryPassCard } from './EntryPassCard';
import confetti from 'canvas-confetti';
import {
  Calendar,
  Clock,
  MapPin,
  Heart,
  Sparkles,
  Check,
  UserCheck,
  Navigation,
  CalendarPlus,
  Home,
  Users,
  Search,
  RefreshCw,
  Phone,
  User,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

interface GroupInviteViewProps {
  group: GroupInviteLink;
  event: WeddingEvent;
}

export function GroupInviteView({ group, event }: GroupInviteViewProps) {
  const [mounted, setMounted] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [selectedSeats, setSelectedSeats] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result state
  const [confirmedParty, setConfirmedParty] = useState<Party | null>(null);
  const [entryPass, setEntryPass] = useState<EntryPass | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Phone recovery state
  const [isRecoverOpen, setIsRecoverOpen] = useState(false);
  const [recoverPhoneInput, setRecoverPhoneInput] = useState('');
  const [recovering, setRecovering] = useState(false);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    setMounted(true);

    // Check localStorage for previously saved pass for this event/group
    const localPass = localStorage.getItem(`weddingpass_pass_${event.id}`);
    const localParty = localStorage.getItem(`weddingpass_party_${event.id}`);
    if (localPass && localParty) {
      try {
        setEntryPass(JSON.parse(localPass));
        setConfirmedParty(JSON.parse(localParty));
      } catch (e) {
        console.warn('LocalStorage parse error:', e);
      }
    }

    const targetDate = new Date(`${event.event_date}T${event.event_time}`);
    const updateCountdown = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [event.id, event.event_date, event.event_time]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setErrorMsg('يرجى كتابة الاسم الكريم');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: group.slug,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          seatsCount: selectedSeats,
          notes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setConfirmedParty(data.party);
        setEntryPass(data.entryPass);
        setStatusMessage(data.message);

        // Persist in localStorage for instant retrieval on next visit
        localStorage.setItem(`weddingpass_pass_${event.id}`, JSON.stringify(data.entryPass));
        localStorage.setItem(`weddingpass_party_${event.id}`, JSON.stringify(data.party));

        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#F3E5AB', '#ffffff', '#10B981'],
        });
      } else {
        setErrorMsg(data.message || 'تعذر تسجيل الحضور');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverByPhone = async () => {
    if (!recoverPhoneInput.trim()) return;
    setRecovering(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/join?recoverPhone=${encodeURIComponent(recoverPhoneInput.trim())}`);
      const data = await res.json();

      if (data.success && data.party && data.entryPass) {
        setConfirmedParty(data.party);
        setEntryPass(data.entryPass);
        setStatusMessage(data.message);
        setIsRecoverOpen(false);

        localStorage.setItem(`weddingpass_pass_${event.id}`, JSON.stringify(data.entryPass));
        localStorage.setItem(`weddingpass_party_${event.id}`, JSON.stringify(data.party));
      } else {
        alert(data.message || 'لم يتم العثور على حجز مسجل بهذا الرقم');
      }
    } catch (err) {
      console.error('Recovery error:', err);
    } finally {
      setRecovering(false);
    }
  };

  const isStrictFull = group.limit_mode === 'strict' && group.max_capacity && group.confirmed_count >= group.max_capacity;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center py-8 px-4 sm:px-6">
      {/* Background Decorative Gold Light */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-amber-600/5 rounded-full blur-3xl" />
      </div>

      <main className="w-full max-w-xl relative z-10 space-y-6">
        {/* Top Header Link */}
        <div className="flex justify-between items-center px-2">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>WeddingPass</span>
          </Link>
          <span className="text-[11px] text-amber-300/80 bg-amber-500/10 px-3 py-0.5 rounded-full border border-amber-500/20 font-semibold">
            {group.group_name}
          </span>
        </div>

        {/* Main Luxury Invitation Card */}
        <div className="rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-amber-500/30 p-6 sm:p-10 shadow-[0_0_50px_-15px_rgba(212,175,55,0.2)] text-center relative overflow-hidden">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full" />
          </div>

          <div className="space-y-3 mb-8">
            <p className="text-sm font-serif text-amber-300/80">بِسْمِ اللَّـهِ الرَّحْمَـٰنِ الرَّحِيمِ</p>
            {event.welcome_verse && (
              <p className="text-xs sm:text-sm text-amber-200/70 font-serif leading-relaxed px-4">
                &ldquo;{event.welcome_verse}&rdquo;
              </p>
            )}
          </div>

          <div className="my-6 inline-block px-5 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm font-semibold">
            دعوة كريمة موجهة لـ: <span className="text-amber-100 font-bold">{group.group_name}</span>
          </div>

          {/* Custom Card Image (If provided) */}
          {event.invitation_image_url ? (
            <div className="my-6 rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl">
              <img
                src={event.invitation_image_url}
                alt="بطاقة الدعوة"
                className="w-full h-auto object-cover max-h-[450px]"
              />
            </div>
          ) : (
            <div className="my-8 space-y-3">
              <p className="text-xs uppercase tracking-widest text-amber-400/70 font-semibold">
                نتشرف بدعوتكم لحفل زفاف
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 my-2">
                <h1 className="text-2xl sm:text-3xl font-bold font-serif gold-gradient-text">
                  {event.groom_name}
                </h1>
                <Heart className="w-6 h-6 text-amber-400 fill-amber-400/20 animate-pulse hidden sm:block" />
                <h1 className="text-2xl sm:text-3xl font-bold font-serif gold-gradient-text">
                  {event.bride_name}
                </h1>
              </div>
              <p className="text-xs text-amber-200/60 font-serif">
                وذلك بمشيئة الله تعالى وتوفيقه
              </p>
            </div>
          )}

          {/* Date & Location */}
          <div className="grid grid-cols-2 gap-3 my-6 text-right">
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-amber-500/20 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-amber-300/60">تاريخ الحفل</p>
                <p className="text-sm font-bold text-amber-100 mt-0.5">{event.event_date}</p>
              </div>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-2xl border border-amber-500/20 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-amber-300/60">الوقت</p>
                <p className="text-sm font-bold text-amber-100 mt-0.5">{event.event_time.slice(0, 5)} مساءً</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/70 p-4 rounded-2xl border border-amber-500/20 text-right space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-amber-300/60">مكان الحفل</p>
                <p className="text-sm font-bold text-amber-100 mt-0.5">{event.venue_name}</p>
                {event.venue_address && (
                  <p className="text-xs text-amber-200/60 mt-1">{event.venue_address}</p>
                )}
              </div>
            </div>

            {event.venue_maps_url && (
              <a
                href={event.venue_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>فتح الموقع على خرائط Google Maps</span>
              </a>
            )}
          </div>

          {/* Countdown */}
          {mounted && (
            <div className="my-4 pt-4 border-t border-amber-500/20">
              <p className="text-xs text-amber-300/70 mb-3 font-semibold">المتبقي على موعد الحفل</p>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/20">
                  <span className="text-lg font-bold text-amber-200">{timeLeft.days}</span>
                  <span className="block text-[10px] text-amber-300/60 mt-0.5">يوم</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/20">
                  <span className="text-lg font-bold text-amber-200">{timeLeft.hours}</span>
                  <span className="block text-[10px] text-amber-300/60 mt-0.5">ساعة</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/20">
                  <span className="text-lg font-bold text-amber-200">{timeLeft.minutes}</span>
                  <span className="block text-[10px] text-amber-300/60 mt-0.5">دقيقة</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/20">
                  <span className="text-lg font-bold text-amber-200">{timeLeft.seconds}</span>
                  <span className="block text-[10px] text-amber-300/60 mt-0.5">ثانية</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* If Already Registered -> Show Entry Pass Directly */}
        {confirmedParty && entryPass ? (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold text-sm">
                <Check className="w-4 h-4" />
                <span>تم تأكيد حضورك بنجاح!</span>
              </div>
              <p className="text-xs text-emerald-200/80">
                {statusMessage || `أهلاً بك يا ${confirmedParty.party_name}، تم إصدار بطاقة دخولك وتجهيز الباركود.`}
              </p>
            </div>

            <EntryPassCard
              partyName={confirmedParty.party_name}
              confirmedCount={confirmedParty.confirmed_count}
              section={confirmedParty.section}
              passToken={entryPass.raw_pass_token || `wp_pass_${confirmedParty.id}`}
              eventGroom={event.groom_name}
              eventBride={event.bride_name}
              eventDate={event.event_date}
              eventTime={event.event_time}
              venueName={event.venue_name}
            />

            <div className="text-center pt-2">
              <button
                onClick={() => {
                  setConfirmedParty(null);
                  setEntryPass(null);
                  localStorage.removeItem(`weddingpass_pass_${event.id}`);
                  localStorage.removeItem(`weddingpass_party_${event.id}`);
                }}
                className="text-xs text-slate-400 hover:text-amber-300 underline cursor-pointer"
              >
                تسجيل شخص آخر أو تعديل البيانات
              </button>
            </div>
          </div>
        ) : isStrictFull ? (
          /* Strict Quota Full Notice */
          <div className="rounded-3xl bg-slate-900/90 border border-rose-500/40 p-8 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-100">عذراً، اكتمل العدد المخصص لهذا القروب 🌹</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              تم الوصول للحد الأقصى المسموح به من المقاعد لهذه المجموعة. إذا كنت قد سجلت مسبقاً، يمكنك استرجاع بطاقتك أدناه.
            </p>
            <button
              onClick={() => setIsRecoverOpen(true)}
              className="py-2.5 px-5 rounded-xl bg-slate-800 text-amber-300 text-xs font-bold border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              استرجاع بطاقة دخولي برقم الجوال
            </button>
          </div>
        ) : (
          /* Fast 3-Second RSVP Form */
          <div className="rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-amber-500/30 p-6 sm:p-8 shadow-xl text-right space-y-5">
            <div className="border-b border-amber-500/20 pb-3 text-center">
              <h2 className="text-base font-bold text-amber-100 flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>تسجيل الحضور واستلام بطاقة الدخول</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
              <p className="text-xs text-amber-200/70 mt-1">
                سجل اسمك ورقم جوالك لاستلام باركود الدخول المباشر للقاعة.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              {/* Name Field (with autocomplete) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-amber-300/90 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>الاسم الكريم (يظهر في بطاقة الدخول) *</span>
                </label>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="مثال: خالد محمد العتيبي"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Phone Field (with autocomplete) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-amber-300/90 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  <span>رقم الجوال *</span>
                </label>
                <input
                  type="tel"
                  name="tel"
                  autoComplete="tel"
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 text-left font-mono"
                  dir="ltr"
                />
              </div>

              {/* Seats selector (if allowed > 1) */}
              {group.max_seats_per_guest > 1 && (
                <div className="space-y-2 pt-2 border-t border-amber-500/10">
                  <label className="text-xs font-semibold text-amber-300/90 block">
                    عدد الأشخاص الحاضرين من هذه الدعوة:
                  </label>
                  <div className="flex gap-2">
                    {Array.from({ length: group.max_seats_per_guest }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSelectedSeats(num)}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                          selectedSeats === num
                            ? 'gold-gradient-bg text-slate-950 border-amber-400 shadow-md scale-105'
                            : 'bg-slate-950/60 border-slate-700 text-slate-300 hover:border-amber-500/40'
                        }`}
                      >
                        {num === 1 ? 'شخص واحد (أنا فقط)' : `${num} أشخاص (مع مرافق)`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-center text-xs text-rose-300 font-semibold">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-2xl font-bold text-sm gold-gradient-bg text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري تأكيد الحضور وتوليد البطاقة...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-5 h-5" />
                    <span>تأكيد الحضور واستلام بطاقة الدخول</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsRecoverOpen(true)}
                className="text-xs text-amber-400 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>سجلت مسبقاً؟ استرجع بطاقة دخولك برقم الجوال</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Phone Recovery Modal */}
      {isRecoverOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-400" />
              <span>استرجاع بطاقة الدخول برقم الجوال</span>
            </h3>
            <p className="text-xs text-slate-400">
              أدخل رقم الجوال الذي قمت بالتسجيل به مسبقاً لاسترجاع باركود بطاقتك مباشرة:
            </p>

            <div>
              <input
                type="tel"
                value={recoverPhoneInput}
                onChange={(e) => setRecoverPhoneInput(e.target.value)}
                placeholder="05XXXXXXXX"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                dir="ltr"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsRecoverOpen(false)}
                className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleRecoverByPhone}
                disabled={recovering || !recoverPhoneInput.trim()}
                className="py-2 px-5 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {recovering ? 'جاري البحث...' : 'استرجاع البطاقة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
