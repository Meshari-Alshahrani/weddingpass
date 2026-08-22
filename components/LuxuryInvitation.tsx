'use client';

import React, { useState, useEffect } from 'react';
import { Party, WeddingEvent, EntryPass } from '@/types/database';
import { EntryPassCard } from './EntryPassCard';
import confetti from 'canvas-confetti';
import {
  Calendar,
  Clock,
  MapPin,
  Heart,
  Sparkles,
  Check,
  Navigation,
  CalendarPlus,
  Home,
  MessageSquareHeart,
  Send,
  ExternalLink,
  CameraOff,
  Baby,
  Camera,
  Image as ImageIcon,
  Download,
} from 'lucide-react';
import Link from 'next/link';

interface LuxuryInvitationProps {
  party: Party;
  event: WeddingEvent;
  initialEntryPass?: EntryPass;
  invitationToken: string;
}

export function LuxuryInvitation({
  party,
  event,
  initialEntryPass,
  invitationToken,
}: LuxuryInvitationProps) {
  const [mounted, setMounted] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<'unopened' | 'viewed' | 'confirmed' | 'declined'>(party.rsvp_status);
  const [activeAction, setActiveAction] = useState<'none' | 'attending' | 'declined' | 'wish'>(
    party.rsvp_status === 'confirmed' ? 'none' : party.rsvp_status === 'declined' ? 'declined' : 'none'
  );
  const [selectedCount, setSelectedCount] = useState<number>(
    party.confirmed_count > 0 ? party.confirmed_count : party.allowed_count
  );
  const [wishText, setWishText] = useState<string>(party.notes || '');
  const [entryPass, setEntryPass] = useState<EntryPass | undefined>(initialEntryPass);
  const [loading, setLoading] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  const isWomen = party.section === 'women';

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    setMounted(true);
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
  }, [event.event_date, event.event_time]);

  const handleConfirmAttendance = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: invitationToken,
          status: 'confirmed',
          attendingCount: selectedCount,
          notes: wishText,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRsvpStatus('confirmed');
        setActiveAction('none');
        setSubmittedMessage(data.message);
        if (data.entryPass) {
          setEntryPass(data.entryPass);
        }

        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#F3E5AB', '#ffffff', '#10B981'],
        });
      }
    } catch (err) {
      console.error('RSVP Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineAttendance = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: invitationToken,
          status: 'declined',
          attendingCount: 0,
          notes: wishText,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRsvpStatus('declined');
        setActiveAction('none');
        setSubmittedMessage('نقدّر ظرفك ويسعدنا دائماً تواصلك ومشاعركم الطيبة 🌹');
      }
    } catch (err) {
      console.error('Decline Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendWishOnly = async () => {
    if (!wishText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_wish',
          partyName: party.party_name,
          message: wishText.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveAction('none');
        setSubmittedMessage('تم إرسال تهنئتكم الكريمة للعروسين بنجاح، شكراً لكم 🌹');
      }
    } catch (err) {
      console.error('Wish Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Google Calendar URL
  const cleanDate = event.event_date.replace(/-/g, '');
  const cleanTime = event.event_time.replace(/:/g, '').slice(0, 4) + '00';
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    `حفل زفاف ${event.groom_name} & ${event.bride_name}`
  )}&dates=${cleanDate}T${cleanTime}/${cleanDate}T235900&details=${encodeURIComponent(
    `يشرفنا حضوركم لحفل زفافنا في ${event.venue_name}`
  )}&location=${encodeURIComponent(event.venue_name)}&ctz=Asia/Riyadh`;

  const appleCalendarUrl = `/api/calendar?guest=${encodeURIComponent(party.party_name)}`;

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
          <span
            className={`text-[11px] px-3 py-0.5 rounded-full border font-semibold ${
              isWomen
                ? 'text-pink-300 bg-pink-500/10 border-pink-500/30'
                : 'text-amber-300/80 bg-amber-500/10 border-amber-500/20'
            }`}
          >
            {isWomen ? 'دعوة خاصة • قسم النساء 🌸' : 'دعوة خاصة • قسم الرجال 🤵'}
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

          {/* Invitation Target Person Header */}
          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-semibold">
            {isWomen ? 'دعوة خاصة لكريمة: ' : 'دعوة خاصة لكريم / لعائلة: '}
            <span className="text-amber-100 font-bold">{party.party_name}</span>
          </div>

          {/* Custom Card Image (If provided) */}
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

          {/* Women Section Strict Etiquette Box */}
          {isWomen && (
            <div className="bg-pink-950/30 border border-pink-500/40 rounded-2xl p-3.5 text-right space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-pink-300 border-b border-pink-500/20 pb-1.5">
                <CameraOff className="w-4 h-4 text-pink-400" />
                <span>ضوابط وتعليمات قسم النساء الكريمة</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-pink-200/90">
                <div className="flex items-center gap-1.5 bg-slate-950/60 p-2 rounded-xl border border-pink-500/20">
                  <CameraOff className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>يمنع التصوير منعاً باتاً 📷</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950/60 p-2 rounded-xl border border-pink-500/20">
                  <Baby className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>جنة الأطفال منازلهم 👶</span>
                </div>
              </div>
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
              {event.venue_maps_url && (
                <a
                  href={event.venue_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>موقع القاعة</span>
                </a>
              )}
              <button
                onClick={() => setIsCalendarModalOpen(true)}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>إضافة للتقويم</span>
              </button>
            </div>
          </div>

          {/* Live Countdown */}
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

        {/* Action Selection Box */}
        {rsvpStatus === 'confirmed' && (entryPass || initialEntryPass) ? (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-center">
              <span className="text-xs text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>تم تأكيد حضوركم وتوليد بطاقة الدخول</span>
              </span>
            </div>

            <EntryPassCard
              partyName={party.party_name}
              confirmedCount={selectedCount}
              section={party.section}
              tableNumber={party.table_number}
              passToken={entryPass?.raw_pass_token || initialEntryPass?.raw_pass_token || `wp_pass_${party.id}`}
              eventGroom={event.groom_name}
              eventBride={event.bride_name}
              eventDate={event.event_date}
              eventTime={event.event_time}
              venueName={event.venue_name}
              venueMapsUrl={event.venue_maps_url}
            />

            {/* Men Section Photo Moments Drop Banner */}
            {!isWomen && (
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 text-right space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>ألبوم لقطات الحفل والعرضة 📸</span>
                  </div>
                  <Link
                    href="/moments"
                    className="py-1.5 px-3 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold flex items-center gap-1 hover:brightness-110"
                  >
                    <span>فتح الألبوم</span>
                  </Link>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  شارك العريس لقطاتك وصورك العفوية في القاعة لتوثيق هذه الليلة المباركة.
                </p>
              </div>
            )}

            {/* Wishes Input */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-right space-y-2">
              <label className="text-xs font-semibold text-amber-300/90 flex items-center gap-1.5">
                <MessageSquareHeart className="w-3.5 h-3.5 text-amber-400" />
                <span>إرسال تبريكات وكلمة للعروسين (تظهر في دفتر التهاني)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={wishText}
                  onChange={(e) => setWishText(e.target.value)}
                  placeholder="بارك الله لكما وبارك عليكما وجمع بينكما في خير..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleSendWishOnly}
                  disabled={loading || !wishText.trim()}
                  className="py-2 px-3.5 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
                >
                  إرسال
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-amber-500/30 p-5 shadow-xl text-right space-y-4">
            <div className="text-center pb-2 border-b border-amber-500/10">
              <p className="text-xs font-bold text-amber-100">
                يسعدنا ويشرفنا تأكيد حضوركم لمشاركتنا هذه الليلة المباركة 🌹
              </p>
            </div>

            {/* 3 Action Buttons */}
            {activeAction === 'none' && (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setActiveAction('attending')}
                  className="w-full py-3.5 px-4 rounded-2xl gold-gradient-bg text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span>👑</span>
                  <span>{isWomen ? 'سأشرفكم بحضوري الكريم' : 'سأشرفكم بحضوري'}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveAction('declined')}
                    className="py-3 px-3 rounded-xl bg-slate-950 border border-slate-700 hover:border-slate-500 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>🤍</span>
                    <span>أعتذر عن الحضور</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveAction('wish')}
                    className="py-3 px-3 rounded-xl bg-slate-950 border border-amber-500/30 hover:border-amber-500/60 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquareHeart className="w-3.5 h-3.5 text-amber-400" />
                    <span>إرسال تهنئة ودعاء</span>
                  </button>
                </div>
              </div>
            )}

            {/* Attending Flow */}
            {activeAction === 'attending' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-amber-300">
                    {isWomen ? 'كم عدد السيدات الحاضرات من هذه الدعوة؟' : 'كم عدد الرجال الحاضرين من هذه الدعوة؟'}
                  </label>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    الحد الأقصى: {party.allowed_count} {party.allowed_count === 1 ? 'شخص' : 'أشخاص'}
                  </span>
                </div>

                <div className="flex gap-2">
                  {Array.from({ length: party.allowed_count }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSelectedCount(num)}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                        selectedCount === num
                          ? 'gold-gradient-bg text-slate-950 border-amber-400 shadow-md scale-105'
                          : 'bg-slate-950 border-slate-700 text-slate-300'
                      }`}
                    >
                      {num === 1 ? (isWomen ? 'سيدة واحدة' : 'شخص واحد') : `${num} أشخاص`}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 block">رسالة أو تهنئة للعروسين (اختياري)</label>
                  <input
                    type="text"
                    value={wishText}
                    onChange={(e) => setWishText(e.target.value)}
                    placeholder="بارك الله لهما وبارك عليهما..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveAction('none')}
                    className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAttendance}
                    disabled={loading}
                    className="flex-1 py-3 px-4 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'جاري الحفظ...' : 'تأكيد الحضور واستلام بطاقة الدخول'}
                  </button>
                </div>
              </div>
            )}

            {/* Declined Flow */}
            {activeAction === 'declined' && (
              <div className="space-y-3 animate-fadeIn text-center">
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  نقدّر ظرفك ويسعدنا دائماً مشاركتنا تبريكاتك ودعواتك للعروسين 🌹
                </p>

                <div className="space-y-1 text-right">
                  <label className="text-xs text-slate-400 block">كلمة أو دعاء للعروسين:</label>
                  <textarea
                    value={wishText}
                    onChange={(e) => setWishText(e.target.value)}
                    placeholder="ألف مبروك ونتمنى لكم التوفيق والسعادة..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveAction('none')}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    onClick={handleDeclineAttendance}
                    disabled={loading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-rose-900/60 border border-rose-600 text-rose-100 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'جاري الحفظ...' : 'تأكيد الاعتذار وإرسال التهنئة'}
                  </button>
                </div>
              </div>
            )}

            {/* Wish Only Flow */}
            {activeAction === 'wish' && (
              <div className="space-y-3 animate-fadeIn">
                <div className="space-y-1 text-right">
                  <label className="text-xs font-semibold text-amber-300 block">
                    اكتب تهنئة ودعاء للعروسين (تظهر في دفتر التهاني):
                  </label>
                  <textarea
                    value={wishText}
                    onChange={(e) => setWishText(e.target.value)}
                    placeholder="بارك الله لكما وبارك عليكما وجمع بينكما في خير..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveAction('none')}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleSendWishOnly}
                    disabled={loading || !wishText.trim()}
                    className="flex-1 py-2.5 px-4 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>إرسال التهنئة للعروسين</span>
                  </button>
                </div>
              </div>
            )}

            {submittedMessage && (
              <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-center text-xs text-emerald-300 font-semibold animate-fadeIn">
                {submittedMessage}
              </div>
            )}
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
    </div>
  );
}
