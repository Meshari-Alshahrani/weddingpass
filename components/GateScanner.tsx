'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  CheckInRPCResponse,
  CheckInType,
  WeddingEvent,
} from '@/types/database';
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  Camera,
  XCircle,
  CloudUpload,
  Sparkles,
  Volume2,
  VolumeX,
  Armchair,
  Lock,
  Crown,
  Flashlight,
  Accessibility,
} from 'lucide-react';

interface GateScannerProps {
  initialEvent: WeddingEvent;
}

interface OfflinePassRecord {
  partyId: string;
  partyName: string;
  passTokenHash: string;
  rawPassToken?: string;
  confirmedCount: number;
  section: string;
  tableNumber?: string | null;
  hostName?: string;
  needsWheelchair?: boolean;
  isCheckedIn: boolean;
}

interface OfflineQueuedCheckIn {
  rawPassToken: string;
  timestamp: string;
  stationName: string;
  operatorName: string;
  checkinType: CheckInType;
}

export function GateScanner({ initialEvent }: GateScannerProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [stationName, setStationName] = useState('بوابة الاستقبال 1');
  const [operatorName, setOperatorName] = useState('فهد العتيبي');
  const [gateSection, setGateSection] = useState<'men' | 'women' | 'general'>('men'); // Default to men's gate
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<CheckInRPCResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Torch & Wake Lock State
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [supportsTorch, setSupportsTorch] = useState<boolean>(false);

  // Offline Engine State
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineCache, setOfflineCache] = useState<OfflinePassRecord[]>([]);
  const [pendingQueue, setPendingQueue] = useState<OfflineQueuedCheckIn[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<any>(null);

  const correctPin = initialEvent.gate_pin || '2026';

  // 1. PIN Auth Check
  useEffect(() => {
    const savedPin = sessionStorage.getItem(`weddingpass_gate_pin_${initialEvent.id}`);
    if (savedPin === correctPin) {
      setIsAuthenticated(true);
    }
  }, [correctPin, initialEvent.id]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === correctPin) {
      sessionStorage.setItem(`weddingpass_gate_pin_${initialEvent.id}`, correctPin);
      setIsAuthenticated(true);
    } else {
      alert('رمز الدخول غير صحيح');
      setPinInput('');
    }
  };

  // 2. Screen Wake Lock with visibilitychange Auto-Reacquire
  useEffect(() => {
    if (!isAuthenticated) return;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          console.log('Wake lock request error:', err);
        }
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.error);
      }
    };
  }, [isAuthenticated]);

  // 3. Offline cache and network listeners
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOfflineMode(!navigator.onLine);
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    fetchOfflineCache();

    const savedQueue = localStorage.getItem(`weddingpass_offline_queue_${initialEvent.id}`);
    if (savedQueue) {
      try {
        setPendingQueue(JSON.parse(savedQueue));
      } catch (e) {
        console.warn('Queue parse error:', e);
      }
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [initialEvent.id]);

  const playChirp = (isSuccess: boolean, isVip: boolean = false) => {
    if (!audioEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        if (isVip) {
          // Royal Triple Chime for VIPs
          osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
          osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
          osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
          osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.24); // C6
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
          osc.start();
          osc.stop(ctx.currentTime + 0.45);
        } else {
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        }
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  };

  const fetchOfflineCache = async () => {
    try {
      const res = await fetch(`/api/join?dumpCache=${initialEvent.id}`);
      const data = await res.json();
      if (data.success && data.cache) {
        setOfflineCache(data.cache);
        localStorage.setItem(`weddingpass_offline_cache_${initialEvent.id}`, JSON.stringify(data.cache));
      }
    } catch (e) {
      const saved = localStorage.getItem(`weddingpass_offline_cache_${initialEvent.id}`);
      if (saved) {
        try {
          setOfflineCache(JSON.parse(saved));
        } catch (err) {
          console.warn('Offline cache parse failed:', err);
        }
      }
    }
  };

  const startScanner = async () => {
    try {
      setIsScanning(true);
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          handleCheckIn(decodedText, 'QR_SCAN');
        },
        () => {}
      );

      // Check Torch support
      try {
        const stream = (html5QrCode as any).localMediaStream as MediaStream;
        const track = stream?.getVideoTracks()[0];
        if (track && track.getCapabilities && (track.getCapabilities() as any).torch) {
          setSupportsTorch(true);
        }
      } catch (err) {
        setSupportsTorch(false);
      }
    } catch (err) {
      console.error('Error starting camera scanner:', err);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
        setTorchOn(false);
      } catch (err) {
        console.error('Error stopping camera:', err);
      }
    }
  };

  const toggleTorch = async () => {
    try {
      if (scannerRef.current) {
        const stream = (scannerRef.current as any).localMediaStream as MediaStream;
        const track = stream?.getVideoTracks()[0];
        if (track && track.applyConstraints) {
          await track.applyConstraints({
            advanced: [{ torch: !torchOn } as any],
          });
          setTorchOn(!torchOn);
        }
      }
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  const handleCheckIn = async (token: string, type: CheckInType = 'QR_SCAN', forceCrossSection: boolean = false, overrideCount?: number) => {
    const trimmed = token.trim();
    if (!trimmed || loading) return; // Debounce guard

    setLoading(true);
    const isOnline = navigator.onLine && !isOfflineMode;

    if (isOnline) {
      try {
        const res = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: trimmed,
            stationName,
            operatorName,
            checkinType: type,
            overrideCount,
            gateSection,
            forceCrossSection,
          }),
        });

        const data: CheckInRPCResponse = await res.json();
        setLastResult(data);
        playChirp(data.success, data.is_vip);

        if (data.success && !overrideCount) {
          setTimeout(() => {
            setLastResult(null);
          }, 3500);
        }
      } catch (err: any) {
        handleOfflineVerification(trimmed, type, forceCrossSection, overrideCount);
      } finally {
        setLoading(false);
      }
    } else {
      handleOfflineVerification(trimmed, type, forceCrossSection, overrideCount);
      setLoading(false);
    }
  };

  const handleOfflineVerification = (trimmed: string, type: CheckInType, forceCrossSection: boolean, overrideCount?: number) => {
    const cachedPass = offlineCache.find(
      (p) => p.rawPassToken === trimmed || p.passTokenHash.includes(trimmed)
    );

    if (!cachedPass) {
      const resp: CheckInRPCResponse = {
        success: false,
        code: 'NOT_FOUND',
        message: 'رمز البطاقة غير مسجل في الذاكرة المحلية (Offline Mode)',
      };
      setLastResult(resp);
      playChirp(false);
      return;
    }

    if (!forceCrossSection && gateSection !== 'general') {
      const isWomenPass = cachedPass.section === 'women';
      const isMenPass = cachedPass.section === 'men' || cachedPass.section === 'vip';

      if (gateSection === 'men' && isWomenPass) {
        const resp: CheckInRPCResponse = {
          success: false,
          code: 'CROSS_SECTION_WARNING',
          is_cross_section_warning: true,
          party_name: cachedPass.partyName,
          section: cachedPass.section,
          table_number: cachedPass.tableNumber,
          message: '⚠️ تنبيه: هذه البطاقة مخصصة لقسم النساء 🧕 - يرجى توجيه الضيفة للبوابة النسائية.',
        };
        setLastResult(resp);
        playChirp(false);
        return;
      }

      if (gateSection === 'women' && isMenPass) {
        const resp: CheckInRPCResponse = {
          success: false,
          code: 'CROSS_SECTION_WARNING',
          is_cross_section_warning: true,
          party_name: cachedPass.partyName,
          section: cachedPass.section,
          table_number: cachedPass.tableNumber,
          message: '⚠️ تنبيه: هذه البطاقة مخصصة لقسم الرجال 🤵 - يرجى توجيه الضيف لبوابة الرجال.',
        };
        setLastResult(resp);
        playChirp(false);
        return;
      }
    }

    if (cachedPass.isCheckedIn) {
      const resp: CheckInRPCResponse = {
        success: false,
        code: 'ALREADY_CHECKED_IN',
        party_name: cachedPass.partyName,
        table_number: cachedPass.tableNumber,
        message: 'تم مسح هذه البطاقة مسبقاً في وضع عدم الاتصال!',
      };
      setLastResult(resp);
      playChirp(false);
      return;
    }

    cachedPass.isCheckedIn = true;
    const nowTime = new Date().toLocaleTimeString('ar-SA');
    const isVip = cachedPass.section === 'vip' || cachedPass.hostName === 'والد العروس';

    const resp: CheckInRPCResponse = {
      success: true,
      code: 'SUCCESS',
      party_name: cachedPass.partyName,
      admitted_count: cachedPass.confirmedCount,
      section: cachedPass.section,
      table_number: cachedPass.tableNumber,
      host_name: cachedPass.hostName,
      is_vip: isVip,
      needs_wheelchair: cachedPass.needsWheelchair,
      check_in_time: nowTime,
      message: cachedPass.tableNumber
        ? `تم التحقق بنجاح • ${cachedPass.tableNumber}`
        : 'تم التحقق بنجاح • أهلاً وسهلاً بكم!',
    };

    setLastResult(resp);
    playChirp(true, isVip);

    const newQueueItem: OfflineQueuedCheckIn = {
      rawPassToken: trimmed,
      timestamp: new Date().toISOString(),
      stationName,
      operatorName,
      checkinType: type,
    };
    const updatedQueue = [...pendingQueue, newQueueItem];
    setPendingQueue(updatedQueue);
    localStorage.setItem(`weddingpass_offline_queue_${initialEvent.id}`, JSON.stringify(updatedQueue));

    setTimeout(() => {
      setLastResult(null);
    }, 3000);
  };

  const handleSyncPendingQueue = async () => {
    if (pendingQueue.length === 0) return;
    setSyncingQueue(true);

    try {
      const queueToProcess = [...pendingQueue];
      for (const item of queueToProcess) {
        await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: item.rawPassToken,
            stationName: item.stationName,
            operatorName: item.operatorName,
            checkinType: item.checkinType,
            gateSection,
            forceCrossSection: true,
          }),
        });
      }

      setPendingQueue([]);
      localStorage.removeItem(`weddingpass_offline_queue_${initialEvent.id}`);
      await fetchOfflineCache();
    } catch (err) {
      console.error('Queue sync failed:', err);
    } finally {
      setSyncingQueue(false);
    }
  };

  // PIN Lock Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <form
          onSubmit={handlePinSubmit}
          className="w-full max-w-xs bg-slate-900 border border-amber-500/30 rounded-3xl p-6 text-center shadow-2xl space-y-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">بوابة الاستقبال</h2>
            <p className="text-xs text-slate-400 mt-1">أدخل رمز PIN المصرح للدخول إلى الماسح</p>
          </div>

          <input
            type="password"
            maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="••••"
            className="w-full text-center tracking-[0.5em] text-2xl font-mono bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-amber-400 focus:outline-none"
            autoFocus
          />

          <button
            type="submit"
            className="w-full py-3 gold-gradient-bg text-slate-950 font-bold rounded-xl text-xs shadow-md hover:brightness-110 cursor-pointer"
          >
            دخول للماسح 🚀
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 space-y-4">
      {/* Top Header */}
      <header className="w-full max-w-lg flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ماسح البوابة الذكي • WEDDINGPASS</span>
          </div>
          <h1 className="text-sm font-bold text-slate-100">
            حفل زفاف {initialEvent.groom_name} & {initialEvent.bride_name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Torch Button */}
          {isScanning && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
                torchOn
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.6)]'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-amber-400'
              }`}
              title="تشغيل/إطفاء فلاش الإضاءة"
            >
              <Flashlight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
            title={audioEnabled ? 'كتم الصوت' : 'تفعيل صوت التحقق'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </header>

      {/* Gate Station & Section Selector */}
      <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-300">تحديد نوع البوابة الحالية:</span>
          <span className="text-[10px] text-slate-500 font-mono">
            {isOfflineMode ? '📵 وضع عدم الاتصال (Offline)' : '🟢 متصل • الشاشة مضاءة (WakeLock)'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setGateSection('men')}
            className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              gateSection === 'men'
                ? 'gold-gradient-bg text-slate-950 border-amber-400 shadow-md'
                : 'bg-slate-950 border-slate-700 text-slate-300'
            }`}
          >
            🤵 بوابة الرجال
          </button>

          <button
            onClick={() => setGateSection('women')}
            className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              gateSection === 'women'
                ? 'bg-pink-600 text-white border-pink-400 shadow-md'
                : 'bg-slate-950 border-slate-700 text-slate-300'
            }`}
          >
            🌸 بوابة النساء
          </button>

          <button
            onClick={() => setGateSection('general')}
            className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              gateSection === 'general'
                ? 'bg-slate-700 text-white border-slate-500'
                : 'bg-slate-950 border-slate-700 text-slate-300'
            }`}
          >
            🏛️ بوابة عامة
          </button>
        </div>
      </div>

      {/* Main Scanner Container */}
      <main className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Offline Banner & Sync Button */}
        {pendingQueue.length > 0 && (
          <div className="bg-amber-950/60 border border-amber-500/40 rounded-2xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-amber-300">
              <CloudUpload className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>يوجد {pendingQueue.length} عمليات دخول مسجلة محلياً</span>
            </div>
            <button
              onClick={handleSyncPendingQueue}
              disabled={syncingQueue}
              className="py-1 px-3 rounded-lg gold-gradient-bg text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {syncingQueue ? 'جاري المزامنة...' : 'مزامنة السيرفر'}
            </button>
          </div>
        )}

        {/* Camera Viewport Area */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 aspect-square flex flex-col items-center justify-center">
          <div id="qr-reader" className="w-full h-full" />

          {!isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950/90">
              <Camera className="w-12 h-12 text-amber-400 animate-pulse" />
              <p className="text-xs text-slate-300">
                انقر لتشغيل الكاميرا ومسح بطاقات دخول الضيوف
              </p>
              <button
                onClick={startScanner}
                className="py-3 px-6 rounded-2xl gold-gradient-bg text-slate-950 text-xs font-bold shadow-lg hover:brightness-110 cursor-pointer"
              >
                تشغيل كاميرا الماسح
              </button>
            </div>
          )}

          {isScanning && (
            <button
              onClick={stopScanner}
              className="absolute top-3 right-3 py-1.5 px-3 rounded-xl bg-slate-950/80 border border-slate-700 text-[11px] text-slate-300 hover:text-white"
            >
              إيقاف الكاميرا
            </button>
          )}
        </div>

        {/* Scan Result Feedback Box */}
        {lastResult && (
          <div
            className={`p-4 rounded-2xl border text-right space-y-2.5 animate-fadeIn ${
              lastResult.code === 'SUCCESS'
                ? lastResult.is_vip
                  ? 'bg-amber-950/90 border-amber-400 text-amber-100 shadow-[0_0_35px_rgba(212,175,55,0.5)]'
                  : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                : lastResult.code === 'CROSS_SECTION_WARNING'
                ? 'bg-amber-950/70 border-amber-500/60 text-amber-100 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
                : 'bg-rose-950/70 border-rose-500/50 text-rose-100 shadow-[0_0_30px_rgba(244,63,94,0.3)]'
            }`}
          >
            {/* VIP Royal Alert Banner */}
            {lastResult.is_vip && (
              <div className="bg-amber-500/20 border border-amber-400/50 p-2 rounded-xl flex items-center justify-between text-xs font-bold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>ضيف من كبار الشخصيات (VIP) • ترحيب خاص 👑</span>
                </span>
              </div>
            )}

            {/* Wheelchair Special Assistance Alert */}
            {lastResult.needs_wheelchair && (
              <div className="bg-purple-500/20 border border-purple-400/50 p-2 rounded-xl flex items-center gap-1.5 text-xs font-bold text-purple-200">
                <Accessibility className="w-4 h-4 text-purple-400" />
                <span>تنبيه: ضيف يحتاج مساعدة خاصة / عربة تنقل ♿</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lastResult.code === 'SUCCESS' ? (
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                ) : lastResult.code === 'CROSS_SECTION_WARNING' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-400" />
                )}
                <div>
                  <h3 className="font-bold text-sm">
                    {lastResult.code === 'SUCCESS'
                      ? 'مصرح بالدخول ✅'
                      : lastResult.code === 'CROSS_SECTION_WARNING'
                      ? 'تنبيه بوابة الأقسام ⚠️'
                      : 'مرفوض ❌'}
                  </h3>
                  {lastResult.party_name && (
                    <p className="text-xs font-bold mt-0.5">{lastResult.party_name}</p>
                  )}
                </div>
              </div>

              {lastResult.code === 'SUCCESS' && lastResult.admitted_count !== undefined ? (
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-emerald-500/40">
                  <button
                    type="button"
                    onClick={() => handleCheckIn(manualToken || '', 'MANUAL_SEARCH', false, Math.max(1, (lastResult.admitted_count || 1) - 1))}
                    className="w-5 h-5 rounded bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center hover:bg-slate-700 cursor-pointer"
                    title="تقليل عدد الواصلين الفعلي"
                  >
                    -
                  </button>
                  <span className="text-xs font-extrabold text-emerald-300 px-1">
                    {lastResult.admitted_count} أفراد
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCheckIn(manualToken || '', 'MANUAL_SEARCH', false, (lastResult.admitted_count || 1) + 1)}
                    className="w-5 h-5 rounded bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center hover:bg-slate-700 cursor-pointer"
                    title="زيادة عدد الواصلين الفعلي"
                  >
                    +
                  </button>
                </div>
              ) : lastResult.admitted_count ? (
                <span className="text-xs font-extrabold px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/40">
                  {lastResult.admitted_count} أفراد
                </span>
              ) : null}
            </div>

            {/* Table Number Display */}
            {lastResult.table_number && (
              <div className="flex items-center gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/30 text-xs">
                <Armchair className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-amber-300">مكان الجلوس:</span>
                <span className="font-extrabold text-amber-100">{lastResult.table_number}</span>
              </div>
            )}

            <p className="text-xs leading-relaxed">{lastResult.message}</p>

            {/* Cross Section Override Button */}
            {lastResult.code === 'CROSS_SECTION_WARNING' && (
              <div className="pt-2 border-t border-amber-500/30 flex justify-end">
                <button
                  onClick={() => handleCheckIn(manualToken || '', 'MANUAL_SEARCH', true)}
                  className="py-1.5 px-3 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:brightness-110 cursor-pointer"
                >
                  السماح بالدخول استثنائياً من هذه البوابة
                </button>
              </div>
            )}
          </div>
        )}

        {/* Manual Code / Phone Input */}
        <div className="space-y-2 pt-2 border-t border-slate-800 text-right">
          <label className="text-xs text-slate-400 font-semibold block">
            بحث يدوي برقم الرمز أو جوال الضيف:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="مثال: wp_pass_xxx أو 05XXXXXXXX"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
            />
            <button
              onClick={() => handleCheckIn(manualToken, 'MANUAL_SEARCH')}
              disabled={loading || !manualToken.trim()}
              className="py-2.5 px-4 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              <span>تحقق</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
