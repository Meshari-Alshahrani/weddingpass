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
  ExternalLink,
  Download,
  MessageSquareHeart,
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
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    setMounted(true);

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
    if (honeypot.trim()) {
      // Silent rejection of automated bot registration
      console.warn('Bot attempt blocked via Honeypot trap');
      return;
    }

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

  const cleanDate = event.event_date.replace(/-/g, '');
  const cleanTime = event.event_time.replace(/:/g, '').slice(0, 4) + '00';
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    `حفل زفاف ${event.groom_name} & ${event.bride_name}`
  )}&dates=${cleanDate}T${cleanTime}/${cleanDate}T235900&details=${encodeURIComponent(
    `يشرفنا حضوركم لحفل زفافنا في ${event.venue_name}`
  )}&location=${encodeURIComponent(event.venue_name)}&ctz=Asia/Riyadh`;

  const appleCalendarUrl = `/api/calendar?guest=${encodeURIComponent(group.group_name)}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center py-6 px-4 sm:px-6">
      {/* Background Decorative Gold Lights */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-amber-600/5 rounded-full blur-3xl" />
      </div>

      <main className="w-full max-w-lg relative z-10 space-y-4">
        {/* Top Header */}
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
        <div className="rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-amber-500/30 p-6 sm:p-8 shadow-[0_0_50px_-15px_rgba(212,175,55,0.2)] text-center relative overflow-hidden space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-serif text-amber-300/80">بِسْمِ اللَّـهِ الرَّحْمَـٰنِ الرَّحِيمِ</p>
            {event.welcome_verse && (
              <p className="text-xs text-amber-200/70 font-serif leading-relaxed px-2">
                &ldquo;{event.welcome_verse}&rdquo;
              </p>
            )}
          </div>

          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-semibold">
            دعوة كريمة موجهة لـ: <span className="text-amber-100 font-bold">{group.group_name}</span>
          </div>

          {event.invitation_image_url ? (
            <div className="my-3 rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl">
              <img
                src={event.invitation_image_url}
                alt="بطاقة الدعوة"
                className="w-full h-auto object-cover max-h-[380px]"
              />
            </div>
          ) : (
            <div className="my-4 space-y-2">
              <p className="text-[11px] uppercase tracking-widest text-amber-400/70 font-semibold">
                نتشرف بدعوتكم لحفل زفاف
              </p>
              <div className="flex items-center justify-center gap-3 my-1">
                <h1 className="text-2xl font-bold font-serif gold-gradient-text">
                  {event.groom_name}
                </h1>
                <Heart className="w-5 h-5 text-amber-400 fill-amber-400/20 animate-pulse" />
                <h1 className="text-2xl font-bold font-serif gold-gradient-text">
                  {event.bride_name}
                </h1>
              </div>
              <p className="text-xs text-amber-200/60 font-serif">
                وذلك بمشيئة الله تعالى وتوفيقه
              </p>
            </div>
          )}

          {/* Date, Time & Venue */}
          <div className="grid grid-cols-2 gap-2 text-right">
            <div className="bg-slate-950/70 p-3 rounded-2xl border border-amber-500/20 flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-amber-300/60">تاريخ الحفل</p>
                <p className="text-xs font-bold text-amber-100">{event.event_date}</p>
              </div>
            </div>

            <div className="bg-slate-950/70 p-3 rounded-2xl border border-amber-500/20 flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-amber-300/60">الوقت</p>
                <p className="text-xs font-bold text-amber-100">{event.event_time.slice(0, 5)} مساءً</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-amber-500/20 text-right space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-amber-300/60">مكان الحفل</p>
                <p className="text-xs font-bold text-amber-100">{event.venue_name}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1 border-t border-amber-500/10">
              <a
                href={event.venue_maps_url || `https://maps.google.com/?q=${encodeURIComponent(event.venue_name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>موقع القاعة (خرائط)</span>
              </a>

              <button
                onClick={() => setIsCalendarModalOpen(true)}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>إضافة للتقويم</span>
              </button>
            </div>
          </div>

          {/* Wedding Timeline Widget */}
          <div className="bg-slate-950/80 rounded-2xl border border-amber-500/20 p-3.5 text-right space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300 border-b border-amber-500/10 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>جدول فقرات المساء</span>
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>🕢 استقبال الضيوف ومراسم الترحيب</span>
                <span className="font-mono text-amber-400 font-bold">{event.timeline_reception || '08:00 م'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>🕘 العرضة النجدية ودخول العريس</span>
                <span className="font-mono text-amber-400 font-bold">{event.timeline_ardah || '09:30 م'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>🕥 مأدبة العشاء</span>
                <span className="font-mono text-amber-400 font-bold">{event.timeline_dinner || '10:30 م'}</span>
              </div>
            </div>
          </div>

          {/* Countdown */}
          {mounted && (
            <div className="pt-2 border-t border-amber-500/20">
              <p className="text-[11px] text-amber-300/70 mb-2 font-semibold">المتبقي على موعد الحفل</p>
              <div className="grid grid-cols-4 gap-1.5">
                <div className="bg-slate-950/80 p-2 rounded-xl border border-amber-500/20">
                  <span className="text-base font-bold text-amber-200">{timeLeft.days}</span>
                  <span className="block text-[9px] text-amber-300/60 mt-0.5">يوم</span>
                </div>
                <div className="bg-slate-950/80 p-2 rounded-xl border border-amber-500/20">
                  <span className="text-base font-bold text-amber-200">{timeLeft.hours}</span>
                  <span className="block text-[9px] text-amber-300/60 mt-0.5">ساعة</span>
                </div>
                <div className="bg-slate-950/80 p-2 rounded-xl border border-amber-500/20">
                  <span className="text-base font-bold text-amber-200">{timeLeft.minutes}</span>
                  <span className="block text-[9px] text-amber-300/60 mt-0.5">دقيقة</span>
                </div>
                <div className="bg-slate-950/80 p-2 rounded-xl border border-amber-500/20">
                  <span className="text-base font-bold text-amber-200">{timeLeft.seconds}</span>
                  <span className="block text-[9px] text-amber-300/60 mt-0.5">ثانية</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* If Already Registered -> Show Entry Pass Directly */}
        {confirmedParty && entryPass ? (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold text-xs">
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
              venueMapsUrl={event.venue_maps_url}
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
          <div className="rounded-3xl bg-slate-900/90 border border-rose-500/40 p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-100">عذراً، اكتمل العدد المخصص لهذا القروب 🌹</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              تم الوصول للحد الأقصى المسموح به من المقاعد لهذه المجموعة. إذا كنت قد سجلت مسبقاً، يمكنك استرجاع بطاقتك أدناه.
            </p>
            <button
              onClick={() => setIsRecoverOpen(true)}
              className="py-2.5 px-4 rounded-xl bg-slate-800 text-amber-300 text-xs font-bold border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              استرجاع بطاقة دخولي برقم الجوال
            </button>
          </div>
        ) : (
          /* Fast 3-Second RSVP Form */
          <div className="rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-amber-500/30 p-5 shadow-xl text-right space-y-4">
            <div className="border-b border-amber-500/10 pb-2 text-center">
              <h2 className="text-sm font-bold text-amber-100 flex items-center justify-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>تسجيل الحضور واستلام بطاقة الدخول</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
            </div>

            <form onSubmit={handleRegister} className="space-y-3.5">
              {/* Invisible Honeypot field for anti-bot defense */}
              <div className="hidden opacity-0 pointer-events-none absolute -left-[9999px]" aria-hidden="true">
                <input
                  type="text"
                  name="user_website_trap"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>الاسم الكريم *</span>
                </label>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="مثال: خالد محمد العتيبي"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
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
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 font-mono text-left"
                  dir="ltr"
                />
              </div>

              {group.max_seats_per_guest > 1 && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-amber-300 block">
                    عدد المقاعد:
                  </label>
                  <div className="flex gap-2">
                    {Array.from({ length: group.max_seats_per_guest }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSelectedSeats(num)}
                        className={`flex-1 py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                          selectedSeats === num
                            ? 'gold-gradient-bg text-slate-950 border-amber-400 shadow-md scale-105'
                            : 'bg-slate-950 border-slate-700 text-slate-300'
                        }`}
                      >
                        {num === 1 ? 'شخص واحد' : `${num} أشخاص`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-slate-400 block">تهنئة أو كلمة للعروسين (اختياري)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="بارك الله لكما وبارك عليكما..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-500/40 rounded-xl text-center text-xs text-rose-300 font-semibold">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs gold-gradient-bg text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري التأكيد وتوليد البطاقة...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>تأكيد الحضور واستلام بطاقة الدخول</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-slate-800">
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

      {/* Calendar Modal */}
      {isCalendarModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-right">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-amber-400" />
              <span>إضافة موعد الزواج إلى تقويم هاتفك</span>
            </h3>
            <p className="text-xs text-slate-400">
              اختر نوع التقويم المستخدم في جوالك لتلقي تنبيهات تذكيرية تلقائية قبل الحفل:
            </p>

            <div className="space-y-2 pt-2">
              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsCalendarModalOpen(false)}
                className="w-full py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-100 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                    G
                  </div>
                  <span>تقويم Google (Google Calendar)</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-500" />
              </a>

              <a
                href={appleCalendarUrl}
                download="wedding-invitation.ics"
                onClick={() => setIsCalendarModalOpen(false)}
                className="w-full py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-100 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">
                    🍎
                  </div>
                  <span>تقويم Apple والآيفون (.ics)</span>
                </div>
                <Download className="w-4 h-4 text-slate-500" />
              </a>
            </div>

            <div className="pt-2 border-t border-slate-800 text-center">
              <button
                onClick={() => setIsCalendarModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
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
