'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  Home,
  LayoutDashboard,
  UserCheck,
  Wifi,
  WifiOff,
  CloudUpload,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { CheckInRPCResponse, Party } from '@/types/database';

interface GateScannerProps {
  eventId: string;
}

interface OfflinePassCacheItem {
  partyId: string;
  partyName: string;
  passTokenHash: string;
  rawPassToken?: string;
  confirmedCount: number;
  section: string;
  isCheckedIn: boolean;
}

export function GateScanner({ eventId }: GateScannerProps) {
  const [mounted, setMounted] = useState(false);
  const [stationName, setStationName] = useState('بوابة الرجال 1');
  const [operatorName, setOperatorName] = useState('موظف الاستقبال');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Network & Offline Cache State
  const [isOnline, setIsOnline] = useState(true);
  const [offlineCacheCount, setOfflineCacheCount] = useState<number>(0);
  const [pendingSyncQueue, setPendingSyncQueue] = useState<any[]>([]);

  // Scan Result State
  const [scanResult, setScanResult] = useState<CheckInRPCResponse | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [autoResetSeconds, setAutoResetSeconds] = useState<number | null>(null);

  // Count override state
  const [editingCount, setEditingCount] = useState(false);
  const [lastScannedToken, setLastScannedToken] = useState<string | null>(null);

  // Manual Search Modal State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Party[]>([]);
  const [searching, setSearching] = useState(false);

  // Audio references
  const audioContextRef = useRef<AudioContext | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const localCacheRef = useRef<Map<string, OfflinePassCacheItem>>(new Map());

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      flushPendingSyncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioContextRef.current = new AudioContextClass();
    }

    // Pre-fetch passes for offline capability
    preloadOfflineCache();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopScanner();
    };
  }, []);

  const preloadOfflineCache = async () => {
    try {
      const res = await fetch('/api/join?offlineCache=true');
      const data = await res.json();
      if (data.success && Array.isArray(data.passes)) {
        const cacheMap = new Map<string, OfflinePassCacheItem>();
        data.passes.forEach((p: OfflinePassCacheItem) => {
          if (p.rawPassToken) cacheMap.set(p.rawPassToken, p);
          if (p.passTokenHash) cacheMap.set(p.passTokenHash, p);
        });
        localCacheRef.current = cacheMap;
        setOfflineCacheCount(data.passes.length);
        localStorage.setItem(`weddingpass_offline_cache_${eventId}`, JSON.stringify(data.passes));
      }
    } catch (e) {
      // If network fails on load, load from localStorage fallback
      const saved = localStorage.getItem(`weddingpass_offline_cache_${eventId}`);
      if (saved) {
        try {
          const list = JSON.parse(saved);
          const cacheMap = new Map<string, OfflinePassCacheItem>();
          list.forEach((p: OfflinePassCacheItem) => {
            if (p.rawPassToken) cacheMap.set(p.rawPassToken, p);
            if (p.passTokenHash) cacheMap.set(p.passTokenHash, p);
          });
          localCacheRef.current = cacheMap;
          setOfflineCacheCount(list.length);
        } catch (err) {
          console.warn('LocalStorage offline cache parse error:', err);
        }
      }
    }
  };

  const flushPendingSyncQueue = async () => {
    const queue = [...pendingSyncQueue];
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
      } catch (err) {
        console.warn('Sync queue error:', err);
      }
    }
    setPendingSyncQueue([]);
  };

  const playSuccessSound = () => {
    if (!soundEnabled || !audioContextRef.current) return;
    try {
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
      if (navigator.vibrate) navigator.vibrate(120);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  };

  const playWarningSound = () => {
    if (!soundEnabled || !audioContextRef.current) return;
    try {
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      if (navigator.vibrate) navigator.vibrate([100, 50, 150]);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  };

  const startScanner = async () => {
    try {
      setCameraError(null);
      const scanner = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        onScanSuccess,
        () => {}
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error('Camera launch failed:', err);
      setCameraError('تعذر تشغيل الكاميرا. يرجى التأكد من منح الإذن أو استخدام البحث اليدوي.');
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Scanner stop error:', err);
      }
      setIsScanning(false);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setLastScannedToken(decodedText);

    const payload = {
      eventId,
      passToken: decodedText,
      stationName,
      operatorName,
      checkinType: 'QR_SCAN',
    };

    // If online -> try server first
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data: CheckInRPCResponse = await res.json();
        setScanResult(data);

        if (data.success) {
          playSuccessSound();
          startAutoResetTimer(2.5);
        } else {
          playWarningSound();
          startAutoResetTimer(3.5);
        }
        setIsVerifying(false);
        return;
      } catch (err) {
        console.warn('Server fetch failed, falling back to offline local cache...', err);
      }
    }

    // OFFLINE FALLBACK VERIFICATION (Zero network required)
    const localItem = localCacheRef.current.get(decodedText.trim());
    if (localItem) {
      if (localItem.isCheckedIn) {
        setScanResult({
          success: false,
          code: 'ALREADY_CHECKED_IN',
          party_name: localItem.partyName,
          message: 'تم استخدام البطاقة مسبقاً (فحص محلي بدون إنترنت)!',
        });
        playWarningSound();
        startAutoResetTimer(3.5);
      } else {
        localItem.isCheckedIn = true;
        setScanResult({
          success: true,
          code: 'SUCCESS',
          party_name: localItem.partyName,
          admitted_count: localItem.confirmedCount,
          section: localItem.section,
          message: 'تم التحقق بنجاح (نمط أوفلاين بدون إنترنت)',
        });
        playSuccessSound();
        startAutoResetTimer(2.5);

        // Queue for background sync
        setPendingSyncQueue((prev) => [...prev, payload]);
      }
    } else {
      setScanResult({
        success: false,
        code: 'NOT_FOUND',
        message: 'رمز بطاقة الدخول غير مسجل في الذاكرة المحلية',
      });
      playWarningSound();
      startAutoResetTimer(3);
    }

    setIsVerifying(false);
  };

  const startAutoResetTimer = (seconds: number) => {
    setAutoResetSeconds(seconds);
    const interval = setInterval(() => {
      setAutoResetSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setScanResult(null);
          setEditingCount(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleManualOverride = async (newCount: number) => {
    if (!lastScannedToken) return;
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          passToken: lastScannedToken,
          stationName,
          operatorName,
          checkinType: 'MANUAL_SEARCH',
          overrideCount: newCount,
        }),
      });
      const data: CheckInRPCResponse = await res.json();
      setScanResult(data);
      setEditingCount(false);
      playSuccessSound();
      startAutoResetTimer(2);
    } catch (err) {
      console.error('Override count error:', err);
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/checkin?eventId=${eventId}&query=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.parties);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleManualCheckInParty = async (party: Party) => {
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          passToken: party.raw_invitation_token ? `wp_pass_${party.id}` : `wp_pass_demo_${party.id}`,
          stationName,
          operatorName,
          checkinType: 'MANUAL_SEARCH',
          overrideCount: party.confirmed_count || party.allowed_count,
        }),
      });
      const data: CheckInRPCResponse = await res.json();
      setScanResult(data);
      setIsSearchOpen(false);
      if (data.success) {
        playSuccessSound();
      } else {
        playWarningSound();
      }
      startAutoResetTimer(3);
    } catch (err) {
      console.error('Manual check-in error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between pb-6">
      {/* Top Gate Station Bar */}
      <header className="w-full bg-slate-900/90 border-b border-slate-800 p-4 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/admin" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300" title="لوحة الإدارة">
              <LayoutDashboard className="w-4 h-4" />
            </Link>
            <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <div>
              <h1 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>{stationName}</span>
                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                  {operatorName}
                </span>
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                {isOnline ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> متصل
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" /> أوفلاين (جاهز محلياً)
                  </span>
                )}
                <span>•</span>
                <span>{offlineCacheCount} بطاقة مخزنة</span>
                {pendingSyncQueue.length > 0 && (
                  <span className="text-cyan-400 flex items-center gap-0.5">
                    <CloudUpload className="w-3 h-3 animate-bounce" /> {pendingSyncQueue.length}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs cursor-pointer ${
                soundEnabled
                  ? 'bg-slate-800 border-slate-700 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
              title="تفعيل/كتم الصوت"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="py-1.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/20 transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>بحث يدوي</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Viewport: Scanner & Results */}
      <main className="w-full max-w-md p-4 flex-1 flex flex-col justify-center space-y-4">
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 border-2 border-slate-800 shadow-2xl aspect-square flex flex-col items-center justify-center">
          <div id="qr-reader" className="w-full h-full object-cover" />

          {/* Overlay viewfinder frame */}
          {isScanning && !scanResult && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-60 h-60 border-2 border-amber-400/80 rounded-3xl relative animate-pulse">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-2xl -mt-1 -ml-1" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-2xl -mt-1 -mr-1" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-2xl -mb-1 -ml-1" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-2xl -mb-1 -mr-1" />
              </div>
              <p className="text-xs text-amber-300 font-semibold mt-4 bg-slate-950/80 px-4 py-1.5 rounded-full border border-amber-500/30">
                وجّه الكاميرا نحو رمز QR لبطاقة الدخول
              </p>
            </div>
          )}

          {/* Idle state */}
          {!isScanning && !scanResult && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-amber-400 border border-slate-700">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">الكاميرا متوقفة</h3>
                <p className="text-xs text-slate-400 mt-1">اضغط على الزر لبدء مسح بطاقات المدعوين عند وصولهم</p>
              </div>
              <button
                onClick={startScanner}
                className="py-3 px-6 rounded-2xl gold-gradient-bg text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                تشغيل كاميرا المسح
              </button>
            </div>
          )}

          {/* Verification Spinner */}
          {isVerifying && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center z-20 space-y-3">
              <RefreshCw className="w-10 h-10 text-amber-400 animate-spin" />
              <p className="text-sm font-bold text-amber-200">جاري التحقق من صحة البطاقة...</p>
            </div>
          )}

          {/* Scan Result Overlay */}
          {scanResult && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-between p-6 z-20 animate-fadeIn">
              {scanResult.code === 'SUCCESS' && (
                <div className="w-full space-y-4 text-center my-auto">
                  <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                      ✅ تم التحقق ومسموح بالدخول
                    </span>
                    <h2 className="text-2xl font-bold text-slate-100 mt-3 font-serif">
                      {scanResult.party_name}
                    </h2>
                    <p className="text-sm text-amber-300 font-semibold mt-1">
                      القسم: {scanResult.section === 'men' ? 'قسم الرجال' : scanResult.section === 'women' ? 'قسم النساء' : scanResult.section || 'عام'}
                    </p>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">عدد الأشخاص المسموحين:</span>
                      <span className="text-xl font-extrabold text-emerald-300">
                        {scanResult.admitted_count} أشخاص
                      </span>
                    </div>

                    {editingCount ? (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <p className="text-xs text-amber-300">اختر العدد الفعلي الواصل الآن:</p>
                        <div className="flex gap-2 justify-center">
                          {[1, 2, 3, 4, 5, 6].map((num) => (
                            <button
                              key={num}
                              onClick={() => handleManualOverride(num)}
                              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-emerald-600 font-bold text-sm border border-slate-700 text-slate-100 transition-colors cursor-pointer"
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingCount(true)}
                        className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>تعديل العدد الفعلي الواصل</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {scanResult.code === 'ALREADY_CHECKED_IN' && (
                <div className="w-full space-y-4 text-center my-auto">
                  <div className="w-16 h-16 bg-rose-500/20 border-2 border-rose-500 rounded-full flex items-center justify-center mx-auto text-rose-400 animate-pulse">
                    <AlertTriangle className="w-10 h-10" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">
                      ⚠️ تم استخدام البطاقة مسبقاً!
                    </span>
                    <h2 className="text-xl font-bold text-slate-100 mt-3 font-serif">
                      {scanResult.party_name}
                    </h2>
                    <p className="text-xs text-rose-300/90 mt-2 bg-rose-950/60 p-3 rounded-xl border border-rose-500/30">
                      {scanResult.message}
                    </p>
                  </div>
                </div>
              )}

              {(scanResult.code === 'REVOKED' || scanResult.code === 'NOT_FOUND') && (
                <div className="w-full space-y-4 text-center my-auto">
                  <div className="w-16 h-16 bg-amber-500/20 border-2 border-amber-500 rounded-full flex items-center justify-center mx-auto text-amber-400">
                    <XCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                      {scanResult.code === 'REVOKED' ? '🚫 بطاقة ملغية الصلاحية' : '❓ غير مسجل'}
                    </span>
                    <p className="text-sm font-semibold text-slate-200 mt-3">
                      {scanResult.message}
                    </p>
                  </div>
                </div>
              )}

              <div className="w-full pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <span>العودة للمسح تلقائياً: {autoResetSeconds}s</span>
                <button
                  onClick={() => {
                    setScanResult(null);
                    setEditingCount(false);
                  }}
                  className="text-amber-400 font-bold hover:underline cursor-pointer"
                >
                  مسح فوري الآن
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {isScanning ? (
            <button
              onClick={stopScanner}
              className="flex-1 py-3 rounded-2xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <CameraOff className="w-4 h-4" />
              <span>إيقاف الكاميرا</span>
            </button>
          ) : (
            <button
              onClick={startScanner}
              className="flex-1 py-3 rounded-2xl gold-gradient-bg text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:brightness-110 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>تشغيل الكاميرا</span>
            </button>
          )}

          <Link
            href="/"
            className="py-3 px-4 rounded-2xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center transition-colors"
            title="الرئيسية"
          >
            <Home className="w-4 h-4" />
          </Link>
        </div>

        {cameraError && (
          <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-center text-xs text-rose-300">
            {cameraError}
          </div>
        )}
      </main>

      {/* Manual Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400" />
                <span>البحث اليدوي عن المدعوين</span>
              </h2>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="ابحث بالاسم، اسم العائلة، أو رقم الجوال..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                autoFocus
              />
              {searching && (
                <div className="absolute left-3 top-3">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
              {searchResults.length === 0 && searchQuery && !searching && (
                <p className="text-center text-xs text-slate-500 py-6">لم يتم العثور على أي ضيف مطابق</p>
              )}

              {searchResults.map((party) => (
                <div
                  key={party.id}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">{party.party_name}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                      <span>المؤكد: {party.confirmed_count || party.allowed_count} أشخاص</span>
                      <span>•</span>
                      <span>{party.primary_phone || 'بدون هاتف'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleManualCheckInParty(party)}
                    className="py-1.5 px-3 rounded-lg gold-gradient-bg text-slate-950 text-[11px] font-bold shrink-0 hover:brightness-110 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>تسجيل دخول</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
