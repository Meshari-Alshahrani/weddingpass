'use client';

import React, { useState, useEffect } from 'react';
import { WeddingEvent, Party, CheckInLog, GroupInviteLink, GroupLimitMode, Wish, EventMoment, HostRole } from '@/types/database';
import * as XLSX from 'xlsx';
import {
  Users,
  UserCheck,
  UserX,
  Sparkles,
  QrCode,
  Upload,
  MessageCircle,
  Copy,
  Check,
  ShieldAlert,
  Search,
  Download,
  Activity,
  ExternalLink,
  Plus,
  FileSpreadsheet,
  Settings,
  Image as ImageIcon,
  Home,
  HelpCircle,
  Save,
  Link2,
  Share2,
  AlertTriangle,
  MessageSquareHeart,
  Bell,
  Eye,
  EyeOff,
  Camera,
  Armchair,
  Trash2,
  Filter,
  HeartHandshake,
  Printer,
  Gift,
  Lock,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

interface AdminDashboardProps {
  initialEvent: WeddingEvent;
  initialParties: Party[];
  initialStats: any;
  initialLogs: CheckInLog[];
  initialGroupLinks?: GroupInviteLink[];
  initialWishes?: Wish[];
  initialMoments?: EventMoment[];
}

export function AdminDashboard({
  initialEvent,
  initialParties,
  initialStats,
  initialLogs,
  initialGroupLinks = [],
  initialWishes = [],
  initialMoments = [],
}: AdminDashboardProps) {
  const [mounted, setMounted] = useState(false);
  const [event, setEvent] = useState<WeddingEvent>(initialEvent);
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [stats, setStats] = useState(initialStats);
  const [logs, setLogs] = useState<CheckInLog[]>(initialLogs);
  const [groupLinks, setGroupLinks] = useState<GroupInviteLink[]>(initialGroupLinks);
  const [wishes, setWishes] = useState<Wish[]>(initialWishes);
  const [moments, setMoments] = useState<EventMoment[]>(initialMoments);
  const [originUrl, setOriginUrl] = useState('');

  const [activeTab, setActiveTab] = useState<'all' | 'groups' | 'confirmed' | 'missing' | 'reminders' | 'thanks' | 'wishes' | 'moments' | 'declined'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [selectedHostFilter, setSelectedHostFilter] = useState<string>('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Guide helper state
  const [showGuide, setShowGuide] = useState(false);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editGroom, setEditGroom] = useState(initialEvent.groom_name);
  const [editBride, setEditBride] = useState(initialEvent.bride_name);
  const [editDate, setEditDate] = useState(initialEvent.event_date);
  const [editTime, setEditTime] = useState(initialEvent.event_time);
  const [editVenue, setEditVenue] = useState(initialEvent.venue_name);
  const [editAddress, setEditAddress] = useState(initialEvent.venue_address || '');
  const [editMapsUrl, setEditMapsUrl] = useState(initialEvent.venue_maps_url || '');
  const [editVerse, setEditVerse] = useState(initialEvent.welcome_verse || '');
  const [editTheme, setEditTheme] = useState(initialEvent.theme_id || 'classic_gold');
  const [editImageUrl, setEditImageUrl] = useState(initialEvent.invitation_image_url || '');
  const [editReceptionTime, setEditReceptionTime] = useState(initialEvent.timeline_reception || '08:00 م');
  const [editArdahTime, setEditArdahTime] = useState(initialEvent.timeline_ardah || '09:30 م');
  const [editDinnerTime, setEditDinnerTime] = useState(initialEvent.timeline_dinner || '10:30 م');
  const [editIban, setEditIban] = useState(initialEvent.iban || '');
  const [editBankName, setEditBankName] = useState(initialEvent.bank_name || 'مصرف الراجحي');
  const [editGatePin, setEditGatePin] = useState(initialEvent.gate_pin || '2026');

  // Create Group Link Modal State
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSlug, setNewGroupSlug] = useState('');
  const [newGroupHost, setNewGroupHost] = useState<HostRole>('العريس');
  const [newGroupLimitMode, setNewGroupLimitMode] = useState<GroupLimitMode>('warning');
  const [newGroupCapacity, setNewGroupCapacity] = useState<number>(30);
  const [newGroupMaxSeats, setNewGroupMaxSeats] = useState<number>(2);
  const [newGroupSection, setNewGroupSection] = useState<string>('men');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Excel Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedPreview, setImportedPreview] = useState<any[]>([]);

  // Manual Add Modal
  const [isAddManualOpen, setIsAddManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualHost, setManualHost] = useState<HostRole>('العريس');
  const [manualTable, setManualTable] = useState('');
  const [manualAllowed, setManualAllowed] = useState(2);
  const [manualSection, setManualSection] = useState('men');

  // Inline Table Edit Modal
  const [editingTableParty, setEditingTableParty] = useState<Party | null>(null);
  const [tableInput, setTableInput] = useState('');

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setOriginUrl(window.location.origin);
      const params = new URLSearchParams(window.location.search);
      const hostParam = params.get('host');
      if (hostParam) {
        if (hostParam === 'father_groom' || hostParam.includes('والد العريس')) setSelectedHostFilter('والد العريس');
        else if (hostParam === 'father_bride' || hostParam.includes('والد العروس')) setSelectedHostFilter('والد العروس');
        else if (hostParam === 'women' || hostParam.includes('نساء')) setSelectedHostFilter('قسم النساء');
        else setSelectedHostFilter(hostParam);
      }
    }
  }, []);

  const refreshData = async () => {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      if (data.success) {
        setEvent(data.event);
        setParties(data.parties);
        setStats(data.stats);
        setLogs(data.logs);
        if (data.groupLinks) setGroupLinks(data.groupLinks);
        if (data.wishes) setWishes(data.wishes);
        if (data.moments) setMoments(data.moments);
      }
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  };

  const handleToggleWish = async (wishId: string, currentStatus: boolean) => {
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_wish_approval', wishId, isApproved: !currentStatus }),
      });
      refreshData();
    } catch (err) {
      console.error('Toggle wish error:', err);
    }
  };

  const handleToggleMoment = async (momentId: string, currentStatus: boolean) => {
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_moment_approval', momentId, isApproved: !currentStatus }),
      });
      refreshData();
    } catch (err) {
      console.error('Toggle moment error:', err);
    }
  };

  const handleDeleteMoment = async (momentId: string) => {
    if (!confirm('هل تريد بالتأكيد حذف هذه الصورة من الألبوم؟')) return;
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_moment', momentId }),
      });
      refreshData();
    } catch (err) {
      console.error('Delete moment error:', err);
    }
  };

  const handleSaveTableNumber = async () => {
    if (!editingTableParty) return;
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_party_table',
          partyId: editingTableParty.id,
          tableNumber: tableInput.trim() || null,
        }),
      });
      setEditingTableParty(null);
      setTableInput('');
      refreshData();
    } catch (err) {
      console.error('Save table error:', err);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_event',
          eventData: {
            groom_name: editGroom.trim(),
            bride_name: editBride.trim(),
            event_date: editDate,
            event_time: editTime,
            venue_name: editVenue.trim(),
            venue_address: editAddress.trim(),
            venue_maps_url: editMapsUrl.trim(),
            welcome_verse: editVerse.trim(),
            theme_id: editTheme,
            invitation_image_url: editImageUrl.trim(),
            timeline_reception: editReceptionTime.trim(),
            timeline_ardah: editArdahTime.trim(),
            timeline_dinner: editDinnerTime.trim(),
            iban: editIban.trim() || null,
            bank_name: editBankName.trim() || null,
            gate_pin: editGatePin.trim() || '2026',
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEvent(data.event);
        setIsSettingsOpen(false);
        refreshData();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateGroupLink = async () => {
    if (!newGroupName.trim() || !newGroupSlug.trim()) return;
    setCreatingGroup(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_group_link',
          groupName: newGroupName.trim(),
          slug: newGroupSlug.trim(),
          hostName: newGroupHost,
          limitMode: newGroupLimitMode,
          maxCapacity: newGroupLimitMode === 'unlimited' ? null : newGroupCapacity,
          maxSeatsPerGuest: newGroupMaxSeats,
          section: newGroupSection || 'men',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsCreateGroupOpen(false);
        setNewGroupName('');
        setNewGroupSlug('');
        refreshData();
      } else {
        alert(data.message || 'حدث خطأ');
      }
    } catch (err) {
      console.error('Error creating group link:', err);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleCopyGroupWhatsAppMessage = (group: GroupInviteLink) => {
    const link = `${originUrl || ''}/join/${group.slug}`;
    const msg = `السلام عليكم ورحمة الله وبركاته 🌹
يسعدنا ويشرفنا دعوتكم لحفل زفاف ${event.groom_name} و ${event.bride_name}.

رابط تأكيد الحضور واستلام بطاقة الدخول لـ (${group.group_name}):
${link}

أهلاً وسهلاً بكم ونسعد بتشريفكم ✨`;

    navigator.clipboard.writeText(msg);
    setCopiedToken(group.slug);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleCopyLink = (rawToken?: string) => {
    if (!rawToken) return;
    const url = `${originUrl || ''}/i/${rawToken}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(rawToken);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleOpenWhatsApp = async (party: Party) => {
    const rawToken = party.raw_invitation_token || party.invitation_token_hash;
    const inviteUrl = `${originUrl || ''}/i/${rawToken}`;
    const cleanPhone = party.primary_phone?.replace(/[^0-9]/g, '') || '';

    const message = `السلام عليكم ورحمة الله وبركاته 🌹
يسرنا ويشرفنا دعوتكم لحفل زفاف ${event.groom_name} و ${event.bride_name}.

للاطلاع على تفاصيل الدعوة وتأكيد الحضور وتوليد بطاقة الدخول الخاصة بكم:
${inviteUrl}

نسعد ونتشرف بحضوركم الكريم ✨`;

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_dispatch', partyId: party.id, status: 'whatsapp_opened' }),
    });

    window.open(waUrl, '_blank');
    refreshData();
  };

  const handleSendReminderWhatsApp = (party: Party) => {
    const rawToken = party.raw_invitation_token || party.invitation_token_hash;
    const inviteUrl = `${originUrl || ''}/i/${rawToken}`;
    const cleanPhone = party.primary_phone?.replace(/[^0-9]/g, '') || '';

    const reminderMessage = `السلام عليكم ورحمة الله وبركاته 🌹
نذكّركم بموعد حفل زفاف ${event.groom_name} و ${event.bride_name} بمشيئة الله في ${event.venue_name} الساعة ${event.event_time.slice(0, 5)} مساءً.

رابط بطاقة الدخول الخاصة بكم لتجهيزها عند البوابة:
${inviteUrl}

نسعد ونتشرف بحضوركم الكريم الليلة ✨`;

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(reminderMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(reminderMessage)}`;

    window.open(waUrl, '_blank');
  };

  const handleSendThankYouWhatsApp = (party: Party) => {
    const cleanPhone = party.primary_phone?.replace(/[^0-9]/g, '') || '';
    const thankYouMessage = `السلام عليكم ورحمة الله وبركاته 🌹
شكراً من القلب يا ${party.party_name} على حضوركم وتشريفكم حفل زفاف ${event.groom_name} و ${event.bride_name} ومشاركتنا فرحتنا الليلة..

أسعدتم قلوبنا ونسأل الله أن يديم عليكم الأفراح والمسرات دائماً ✨`;

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(thankYouMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(thankYouMessage)}`;

    window.open(waUrl, '_blank');
  };

  const handleRevokePass = async (partyId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في إلغاء صلاحية بطاقة الدخول هذه؟')) return;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_pass', partyId }),
      });
      const data = await res.json();
      if (data.success) {
        refreshData();
      }
    } catch (err) {
      console.error('Revoke pass error:', err);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws);

      const formatted = data.map((row: any) => {
        let phone = String(row.phone || row.جوال || row.هاتف || '').trim();
        return {
          party_name: row.name || row.الاسم || row.المدعو || 'ضيف كريم',
          primary_phone: phone,
          allowed_count: Number(row.allowed_guests || row.العدد || row.المرافقين || 1),
          section: row.section || row.القسم || 'men',
          host_name: row.host || row.الداعي || 'العريس',
          table_number: row.table || row.الطاولة || null,
          notes: row.notes || row.ملاحظات || '',
        };
      });

      setImportedPreview(formatted);
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (importedPreview.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_import', guests: importedPreview }),
      });
      const data = await res.json();
      if (data.success) {
        setIsImportOpen(false);
        setImportedPreview([]);
        refreshData();
      }
    } catch (err) {
      console.error('Import error:', err);
    } finally {
      setImporting(false);
    }
  };

  const handleAddManualGuest = async () => {
    if (!manualName.trim()) return;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_import',
          guests: [
            {
              party_name: manualName.trim(),
              primary_phone: manualPhone.trim(),
              allowed_count: manualAllowed,
              section: manualSection,
              host_name: manualHost,
              table_number: manualTable.trim() || null,
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAddManualOpen(false);
        setManualName('');
        setManualPhone('');
        setManualTable('');
        refreshData();
      }
    } catch (err) {
      console.error('Add manual guest error:', err);
    }
  };

  const sanitizeExcelCell = (val: any) => {
    if (typeof val === 'string' && /^[=+@-]/i.test(val.trim())) {
      return `'${val}`;
    }
    return val;
  };

  const handleExportAttendanceExcel = () => {
    const exportData = filteredParties.map((p) => ({
      'اسم المدعو': sanitizeExcelCell(p.party_name),
      'الداعي': sanitizeExcelCell(p.host_name || 'العريس'),
      'رقم الطاولة': sanitizeExcelCell(p.table_number || 'عام'),
      'المجموعة / القروب': sanitizeExcelCell(p.group_name || 'دعوة خاصة'),
      'رقم الجوال': sanitizeExcelCell(p.primary_phone || ''),
      'القسم': p.section === 'men' ? 'رجال' : p.section === 'women' ? 'نساء' : p.section,
      'العدد المسموح': p.allowed_count,
      'العدد المؤكد': p.confirmed_count,
      'العدد الفعلي الواصل': p.actual_checked_in_count,
      'حالة الـ RSVP': p.rsvp_status === 'confirmed' ? 'أكد الحضور' : p.rsvp_status === 'declined' ? 'اعتذر' : 'لم يرد',
      'حالة الدخول': p.actual_checked_in_count > 0 ? 'تم الدخول ✅' : 'لم يدخل',
      'ملاحظات': sanitizeExcelCell(p.notes || ''),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير الحضور');
    XLSX.writeFile(wb, `WeddingPass-${selectedHostFilter}-${event.slug}.xlsx`);
  };

  const filteredParties = parties.filter((party) => {
    const matchesSearch =
      party.party_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (party.primary_phone && party.primary_phone.includes(searchQuery)) ||
      (party.table_number && party.table_number.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSection = selectedSection === 'all' || party.section === selectedSection;
    const matchesGroup = selectedGroupFilter === 'all' || party.group_name === selectedGroupFilter;
    const matchesHost = selectedHostFilter === 'all' || (party.host_name || 'العريس') === selectedHostFilter;

    if (!matchesSearch || !matchesSection || !matchesGroup || !matchesHost) return false;

    if (activeTab === 'confirmed') return party.rsvp_status === 'confirmed';
    if (activeTab === 'reminders') return party.rsvp_status === 'confirmed' && party.actual_checked_in_count === 0;
    if (activeTab === 'thanks') return party.actual_checked_in_count > 0 || party.rsvp_status === 'confirmed';
    if (activeTab === 'declined') return party.rsvp_status === 'declined';
    if (activeTab === 'missing') return party.rsvp_status === 'confirmed' && party.actual_checked_in_count === 0;

    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 space-y-8">
      {/* Top Header Bar */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1">
            <Sparkles className="w-4 h-4" />
            <span>لوحة تحكم المنظم الشاملة • WEDDINGPASS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif gold-gradient-text">
            حفل زفاف {event.groom_name} & {event.bride_name}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {event.event_date} • {event.venue_name}
          </p>
        </div>

        {/* Action Navigation Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/"
            className="py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Home className="w-4 h-4 text-slate-400" />
            <span>الرئيسية</span>
          </Link>

          <Link
            href="/admin/manifest"
            target="_blank"
            className="py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>كشف الطوارئ (PDF)</span>
          </Link>

          <Link
            href="/moments"
            target="_blank"
            className="py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span>ألبوم الحفل</span>
          </Link>

          <button
            onClick={() => setShowGuide(!showGuide)}
            className="py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            <span>دليل النظام</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>إعدادات الحفل</span>
          </button>

          <Link
            href="/admin/live"
            className="py-2.5 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>شاشة القاعة المباشرة</span>
          </Link>

          <Link
            href="/checkin"
            target="_blank"
            className="py-2.5 px-4 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold flex items-center gap-2 shadow-md hover:brightness-110 transition-all"
          >
            <QrCode className="w-4 h-4" />
            <span>فتح ماسح البوابة</span>
          </Link>
        </div>
      </header>

      {/* Host Breakdown Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span>إحصائيات الداعين المتعددين (Multi-Host Overview)</span>
          </h2>
          {selectedHostFilter !== 'all' && (
            <button
              onClick={() => setSelectedHostFilter('all')}
              className="text-xs text-amber-400 hover:underline flex items-center gap-1"
            >
              <Filter className="w-3 h-3" />
              <span>إلغاء التصفية وعرض الكل</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(stats.hostStats || []).map((h: any) => {
            const isSelected = selectedHostFilter === h.hostName;

            return (
              <button
                key={h.hostName}
                onClick={() => setSelectedHostFilter(isSelected ? 'all' : h.hostName)}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
                  isSelected
                    ? 'gold-gradient-bg text-slate-950 border-amber-400 shadow-lg scale-[1.02]'
                    : 'bg-slate-900/90 border-slate-800 text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-xs font-bold ${isSelected ? 'text-slate-950' : 'text-amber-300'}`}>
                    {h.hostName === 'العريس' ? '🤵 العريس' : h.hostName === 'والد العريس' ? '👔 والد العريس' : h.hostName === 'والد العروس' ? '👑 والد العروس' : '🌸 قسم النساء'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-950 border border-slate-800 text-slate-400'}`}>
                    {h.totalInvites} دعوة
                  </span>
                </div>

                <div className="mt-3 flex justify-between items-end">
                  <div>
                    <span className={`text-2xl font-extrabold ${isSelected ? 'text-slate-950' : 'text-slate-100'}`}>
                      {h.confirmedGuests}
                    </span>
                    <span className={`text-[10px] block ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>
                      مؤكد الحضور
                    </span>
                  </div>

                  <div className="text-left">
                    <span className={`text-xs font-bold ${isSelected ? 'text-slate-900' : 'text-emerald-400'}`}>
                      {h.admittedGuests} دخلوا
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Guide Banner */}
      {showGuide && (
        <section className="bg-slate-900/90 rounded-3xl border border-amber-500/30 p-6 space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-amber-500/20 pb-3">
            <h3 className="text-sm font-bold text-amber-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>دليل استخدام WeddingPass الشامل</span>
            </h3>
            <button onClick={() => setShowGuide(false)} className="text-slate-400 hover:text-slate-200 text-xs">
              إغلاق الدليل ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
            <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">
                1
              </div>
              <h4 className="text-xs font-bold text-slate-100">روابط القروبات وتدفق الرجال السريع</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                أنشئ روابط للقروبات ليقوم المعازيم بتسجيل أسمائهم واستلام باركود الدخول مباشرة في ثوانٍ.
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                2
              </div>
              <h4 className="text-xs font-bold text-slate-100">تسكين وتوجيه الطاولات</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                حدد أرقام الطاولات لكبار الشخصيات والمعازيم لتظهر فوراً على شاشة الماسح عند البوابة لتوجيههم.
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 font-bold flex items-center justify-center text-xs">
                3
              </div>
              <h4 className="text-xs font-bold text-slate-100">ألبوم لقطات الحفل والتهاني</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                راجع صور العرضة وتهاني المعازيم واعتمد المناسب منها للعرض المباشر وشاشات القاعة.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Smart Group Links Section */}
      <section className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 font-serif">
              <Link2 className="w-5 h-5 text-amber-400" />
              <span>روابط قروبات الواتساب (Smart Group Links)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              شارك هذه الروابط في قروبات الواتساب ليسجل الضيوف أنفسهم ذاتياً دون عناء إدخال أرقامهم يدوياً.
            </p>
          </div>

          <button
            onClick={() => setIsCreateGroupOpen(true)}
            className="py-2.5 px-4 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md hover:brightness-110 transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء رابط قروب جديد</span>
          </button>
        </div>

        {/* Group Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {groupLinks.map((grp) => {
            const isWarningOver = grp.limit_mode === 'warning' && grp.max_capacity && grp.confirmed_count > grp.max_capacity;

            return (
              <div
                key={grp.id}
                className={`p-4 rounded-2xl border space-y-3 bg-slate-950/70 transition-all ${
                  isWarningOver ? 'border-amber-500/50' : 'border-slate-800'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{grp.group_name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                        {grp.host_name || 'العريس'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">/join/{grp.slug}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                      grp.limit_mode === 'unlimited'
                        ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                        : grp.limit_mode === 'warning'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                    }`}
                  >
                    {grp.limit_mode === 'unlimited'
                      ? 'مفتوح بالكامل'
                      : grp.limit_mode === 'warning'
                      ? 'تنبيه عند التجاوز'
                      : 'إغلاق صارم'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs py-2 px-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400">عدد المؤكدين من القروب:</span>
                  <span className="font-extrabold text-amber-200">
                    {grp.confirmed_count}{' '}
                    {grp.max_capacity ? <span className="text-slate-400 font-normal">/ {grp.max_capacity}</span> : 'شخص'}
                  </span>
                </div>

                {isWarningOver && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>تنبيه: تجاوز القروب العدد المتوقع ({grp.confirmed_count}/{grp.max_capacity})</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleCopyGroupWhatsAppMessage(grp)}
                    className="flex-1 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedToken === grp.slug ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>تم نسخ الرسالة!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>نسخ للواتساب</span>
                      </>
                    )}
                  </button>

                  <Link
                    href={`/join/${grp.slug}`}
                    target="_blank"
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
                    title="معاينة رابط القروب"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Operations Tabs & Area */}
      <section className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-6 shadow-xl">
        {/* Action Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                activeTab === 'all' ? 'gold-gradient-bg text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              الكل ({parties.length})
            </button>
            <button
              onClick={() => setActiveTab('confirmed')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                activeTab === 'confirmed' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              المؤكدين ({stats.confirmedParties})
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${
                activeTab === 'reminders' ? 'bg-amber-600 text-white' : 'bg-slate-950 text-amber-400 hover:text-amber-300'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>تذكير المؤكدين ({stats.confirmedParties - stats.usedPasses})</span>
            </button>
            <button
              onClick={() => setActiveTab('thanks')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${
                activeTab === 'thanks' ? 'bg-purple-600 text-white' : 'bg-slate-950 text-purple-400 hover:text-purple-300'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>رسائل الشكر بعد الزواج ({stats.usedPasses > 0 ? stats.usedPasses : stats.confirmedParties})</span>
            </button>
            <button
              onClick={() => setActiveTab('moments')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${
                activeTab === 'moments' ? 'bg-cyan-600 text-white' : 'bg-slate-950 text-cyan-400 hover:text-cyan-300'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>ألبوم الحفل ({moments.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('wishes')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${
                activeTab === 'wishes' ? 'bg-pink-600 text-white' : 'bg-slate-950 text-pink-400 hover:text-pink-300'
              }`}
            >
              <MessageSquareHeart className="w-3.5 h-3.5" />
              <span>دفتر التهاني ({wishes.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('declined')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                activeTab === 'declined' ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              المعتذرين ({stats.declinedParties})
            </button>
          </div>

          {/* Buttons: Import Excel, Add Manual, Export */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsImportOpen(true)}
              className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>استيراد ملف Excel</span>
            </button>

            <button
              onClick={() => setIsAddManualOpen(true)}
              className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة ضيف يدوي</span>
            </button>

            <button
              onClick={handleExportAttendanceExcel}
              className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير تقرير الحضور</span>
            </button>
          </div>
        </div>

        {/* THANK YOU DISPATCHER TAB CONTENT */}
        {activeTab === 'thanks' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-purple-950/40 border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-purple-300 text-sm flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-purple-400" />
                  <span>مُولد رسائل الشكر والامتنان بعد انتهاء الحفل (Thank You Dispatcher)</span>
                </span>
                <p className="text-slate-400 mt-1">
                  أرسل رسالة شكر مخصصة باسم الضيف بنقرة واحدة عبر WhatsApp لمن شرفكم بالحضور الليلة.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 font-semibold">اسم الضيف الكريم</th>
                    <th className="p-3.5 font-semibold">الداعي</th>
                    <th className="p-3.5 font-semibold">رقم الجوال</th>
                    <th className="p-3.5 font-semibold">حالة الدخول</th>
                    <th className="p-3.5 font-semibold text-center">إرسال الشكر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredParties.map((party) => (
                    <tr key={party.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-bold text-slate-100">{party.party_name}</td>
                      <td className="p-3.5">
                        <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                          {party.host_name || 'العريس'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-400" dir="ltr">{party.primary_phone || '-'}</td>
                      <td className="p-3.5">
                        {party.actual_checked_in_count > 0 ? (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            ✅ حضر ({party.actual_checked_in_count})
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">مؤكد الحضور</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleSendThankYouWhatsApp(party)}
                          className="py-1.5 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center justify-center gap-1.5 mx-auto transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>إرسال شكر واتساب 🌹</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MOMENTS TAB CONTENT */}
        {activeTab === 'moments' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <div className="text-xs">
                <span className="font-bold text-cyan-300">ألبوم لقطات الحفل المباشر (Live Moments)</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  الصور المعتمدة فقط تظهر في صفحة الألبوم العامة للضيوف.
                </p>
              </div>
              <Link
                href="/moments"
                target="_blank"
                className="py-1.5 px-3 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold flex items-center gap-1 hover:brightness-110"
              >
                <span>معاينة صفحة الألبوم</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {moments.length === 0 && (
                <div className="col-span-3 text-center py-10 text-slate-500 text-xs">
                  لا توجد أي صور مرفوعة حتى الآن
                </div>
              )}

              {moments.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-2xl border space-y-2.5 transition-all ${
                    m.is_approved ? 'bg-slate-950 border-cyan-500/40' : 'bg-slate-950/60 border-amber-500/40'
                  }`}
                >
                  <div className="rounded-xl overflow-hidden aspect-video bg-slate-900 border border-slate-800">
                    <img src={m.media_url} alt="لحظة حفل" className="w-full h-full object-cover" />
                  </div>

                  <div className="flex justify-between items-start text-xs">
                    <div>
                      <span className="font-bold text-slate-100">{m.uploader_name}</span>
                      {m.caption && <p className="text-[11px] text-slate-300 mt-0.5">{m.caption}</p>}
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleToggleMoment(m.id, m.is_approved)}
                        className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          m.is_approved
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                        title={m.is_approved ? 'حجب من الألبوم' : 'اعتماد ونشر في الألبوم'}
                      >
                        {m.is_approved ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleDeleteMoment(m.id)}
                        className="p-1.5 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-800/40 hover:bg-rose-900/60 transition-colors cursor-pointer"
                        title="حذف الصورة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WISHES TAB CONTENT */}
        {activeTab === 'wishes' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <div className="text-xs">
                <span className="font-bold text-pink-300">دفتر التهاني والتبريكات المباشر</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  الرسائل المفعلة بـ (العرض على شاشة القاعة) تظهر في شريط البث الحي لشاشات الحفل.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {wishes.length === 0 && (
                <div className="col-span-2 text-center py-10 text-slate-500 text-xs">
                  لا توجد أي تهاني مسجلة حتى الآن
                </div>
              )}

              {wishes.map((w) => (
                <div
                  key={w.id}
                  className={`p-4 rounded-2xl border space-y-2 transition-all ${
                    w.is_approved ? 'bg-slate-950 border-pink-500/40' : 'bg-slate-950/60 border-slate-800 opacity-70'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-xs text-slate-200">{w.sender_name}</span>
                    <button
                      onClick={() => handleToggleWish(w.id, w.is_approved)}
                      className={`py-1 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                        w.is_approved
                          ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30 hover:bg-pink-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {w.is_approved ? (
                        <>
                          <Eye className="w-3 h-3 text-pink-400" />
                          <span>معروض على الشاشة</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>حجب من الشاشة</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-serif">&ldquo;{w.message}&rdquo;</p>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {new Date(w.created_at).toLocaleTimeString('ar-SA')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GUESTS TABLE & FILTERS (When not wishes, moments, or thanks) */}
        {activeTab !== 'wishes' && activeTab !== 'moments' && activeTab !== 'thanks' && (
          <>
            {/* Search & Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم المدعو أو الجوال أو رقم الطاولة..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>

              <div>
                <select
                  value={selectedHostFilter}
                  onChange={(e) => setSelectedHostFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="all">كل الداعين (الداعي: الكل)</option>
                  <option value="العريس">العريس 🤵</option>
                  <option value="والد العريس">والد العريس 👔</option>
                  <option value="والد العروس">والد العروس 👑</option>
                  <option value="قسم النساء">قسم النساء 🌸</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="all">كل المجموعات والقروبات</option>
                  <option value="دعوة خاصة">دعوات خاصة فردية</option>
                  {groupLinks.map((g) => (
                    <option key={g.id} value={g.group_name}>
                      {g.group_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="all">كل الأقسام</option>
                  <option value="men">قسم الرجال 🤵</option>
                  <option value="women">قسم النساء 🌸</option>
                  <option value="vip">كبار الشخصيات VIP</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 font-semibold">المدعو الكريم</th>
                    <th className="p-3.5 font-semibold">الداعي</th>
                    <th className="p-3.5 font-semibold">رقم الطاولة</th>
                    <th className="p-3.5 font-semibold">المجموعة</th>
                    <th className="p-3.5 font-semibold">العدد المسموح / المؤكد</th>
                    <th className="p-3.5 font-semibold">حالة الدعوة</th>
                    <th className="p-3.5 font-semibold">حالة الدخول</th>
                    <th className="p-3.5 font-semibold text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredParties.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        لا يوجد أي مدعوين يطابقون خيارات البحث الحالية
                      </td>
                    </tr>
                  )}

                  {filteredParties.map((party) => {
                    const token = party.raw_invitation_token || party.invitation_token_hash;
                    return (
                      <tr key={party.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-slate-100">{party.party_name}</div>
                          {party.primary_phone && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5" dir="ltr">
                              {party.primary_phone}
                            </div>
                          )}
                          {party.notes && <div className="text-[10px] text-amber-300/80 mt-0.5">{party.notes}</div>}
                          {party.needs_wheelchair && (
                            <div className="text-[10px] text-purple-300 font-bold mt-0.5">♿ يحتاج عربة تنقل</div>
                          )}
                        </td>

                        <td className="p-3.5">
                          <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            {party.host_name || 'العريس'}
                          </span>
                        </td>

                        {/* Table Number with inline edit */}
                        <td className="p-3.5">
                          <button
                            onClick={() => {
                              setEditingTableParty(party);
                              setTableInput(party.table_number || '');
                            }}
                            className="bg-slate-950 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-bold text-amber-200 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Armchair className="w-3 h-3 text-amber-400" />
                            <span>{party.table_number || 'تحديد طاولة'}</span>
                          </button>
                        </td>

                        <td className="p-3.5">
                          <span className="bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[10px] font-semibold text-slate-300">
                            {party.group_name || 'دعوة خاصة'}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <span className="font-semibold text-slate-200">
                            {party.confirmed_count > 0 ? (
                              <span className="text-emerald-400 font-bold">{party.confirmed_count} مؤكد</span>
                            ) : (
                              <span>{party.allowed_count} مسموح</span>
                            )}
                          </span>
                        </td>

                        <td className="p-3.5">
                          {party.rsvp_status === 'confirmed' && (
                            <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[11px] font-bold">
                              ✅ أكد الحضور
                            </span>
                          )}
                          {party.rsvp_status === 'declined' && (
                            <span className="bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-full text-[11px] font-bold">
                              ❌ اعتذر
                            </span>
                          )}
                          {party.rsvp_status === 'viewed' && (
                            <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                              👁️ فُتحت الدعوة
                            </span>
                          )}
                          {party.rsvp_status === 'unopened' && (
                            <span className="bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full text-[11px]">
                              لم تُفتح بعد
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          {party.actual_checked_in_count > 0 ? (
                            <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 w-fit">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>دخل ({party.actual_checked_in_count})</span>
                            </span>
                          ) : party.rsvp_status === 'confirmed' ? (
                            <span className="text-slate-400 text-[11px]">في انتظار الوصول</span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">-</span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {party.rsvp_status === 'confirmed' ? (
                              <button
                                onClick={() => handleSendReminderWhatsApp(party)}
                                className="py-1 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="إرسال تذكير بموعد الحفل والبطاقة"
                              >
                                <Bell className="w-3.5 h-3.5" />
                                <span>تذكير</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenWhatsApp(party)}
                                className="py-1 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="إرسال عبر WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>واتساب</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleCopyLink(token)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                              title="نسخ رابط الدعوة"
                            >
                              {copiedToken === token ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <Link
                              href={`/i/${token}`}
                              target="_blank"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                              title="معاينة صفحة الدعوة"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>

                            <button
                              onClick={() => handleRevokePass(party.id)}
                              className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors cursor-pointer"
                              title="إلغاء بطاقة الدخول"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Edit Table Modal */}
      {editingTableParty && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-right">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Armchair className="w-4 h-4 text-amber-400" />
              <span>تحديد رقم الطاولة لـ ({editingTableParty.party_name})</span>
            </h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">رقم الطاولة أو اسم المنطقة:</label>
              <input
                type="text"
                value={tableInput}
                onChange={(e) => setTableInput(e.target.value)}
                placeholder="مثال: طاولة 5، طاولة VIP، طاولة أهل العروس"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingTableParty(null)}
                className="py-2 px-3.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveTableNumber}
                className="py-2 px-4 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold cursor-pointer"
              >
                حفظ التعيين
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Smart Group Link Modal */}
      {isCreateGroupOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-amber-400" />
              <span>إنشاء رابط مخصص لقروب واتساب</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">اسم القروب *</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => {
                      setNewGroupName(e.target.value);
                      if (!newGroupSlug) {
                        setNewGroupSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20));
                      }
                    }}
                    placeholder="مثال: قروب زملاء العمل"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">الداعي المسؤول</label>
                  <select
                    value={newGroupHost}
                    onChange={(e) => setNewGroupHost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="العريس">العريس 🤵</option>
                    <option value="والد العريس">والد العريس 👔</option>
                    <option value="والد العروس">والد العروس 👑</option>
                    <option value="قسم النساء">قسم النساء 🌸</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">المعرف بالرابط (Slug) *</label>
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2">
                  <span className="text-slate-500 font-mono text-[11px]">{originUrl || 'weddingpass.sa'}/join/</span>
                  <input
                    type="text"
                    value={newGroupSlug}
                    onChange={(e) => setNewGroupSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="work"
                    className="flex-1 bg-transparent text-slate-100 focus:outline-none font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">نمط سعة القروب</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewGroupLimitMode('unlimited')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      newGroupLimitMode === 'unlimited'
                        ? 'gold-gradient-bg text-slate-950 border-amber-400'
                        : 'bg-slate-950 border-slate-700 text-slate-300'
                    }`}
                  >
                    مفتوح بدون سقف
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewGroupLimitMode('warning')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      newGroupLimitMode === 'warning'
                        ? 'gold-gradient-bg text-slate-950 border-amber-400'
                        : 'bg-slate-950 border-slate-700 text-slate-300'
                    }`}
                  >
                    تنبيه عند التجاوز
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewGroupLimitMode('strict')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      newGroupLimitMode === 'strict'
                        ? 'gold-gradient-bg text-slate-950 border-amber-400'
                        : 'bg-slate-950 border-slate-700 text-slate-300'
                    }`}
                  >
                    إغلاق صارم
                  </button>
                </div>
              </div>

              {newGroupLimitMode !== 'unlimited' && (
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">الحد الأقصى المتوقع للمقاعد</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={newGroupCapacity}
                    onChange={(e) => setNewGroupCapacity(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">أقصى مقاعد للشخص</label>
                  <select
                    value={newGroupMaxSeats}
                    onChange={(e) => setNewGroupMaxSeats(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value={1}>1 (الضيف فقط)</option>
                    <option value={2}>2 (الضيف + مرافق)</option>
                    <option value={3}>3 أشخاص</option>
                    <option value={4}>4 أشخاص</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">القسم المخصص</label>
                  <select
                    value={newGroupSection}
                    onChange={(e) => setNewGroupSection(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="men">قسم الرجال 🤵</option>
                    <option value="women">قسم النساء 🌸</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsCreateGroupOpen(false)}
                className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleCreateGroupLink}
                disabled={creatingGroup || !newGroupName.trim() || !newGroupSlug.trim()}
                className="py-2 px-5 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {creatingGroup ? 'جاري الإنشاء...' : 'إنشاء وتجهيز الرابط'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wedding Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <span>إعدادات وبيانات الحفل والفقرات ورمز البوابة</span>
              </h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">اسم العريس</label>
                  <input
                    type="text"
                    value={editGroom}
                    onChange={(e) => setEditGroom(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">اسم العروس</label>
                  <input
                    type="text"
                    value={editBride}
                    onChange={(e) => setEditBride(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Timeline Settings */}
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-amber-500/20 space-y-2.5">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <Clock className="w-4 h-4" />
                  <span>جدول فقرات الحفل (يظهر في صفحة الدعوة)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">مراسم الاستقبال</label>
                    <input
                      type="text"
                      value={editReceptionTime}
                      onChange={(e) => setEditReceptionTime(e.target.value)}
                      placeholder="08:00 م"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-slate-100 focus:outline-none focus:border-amber-400 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">العرضة ودخول العريس</label>
                    <input
                      type="text"
                      value={editArdahTime}
                      onChange={(e) => setEditArdahTime(e.target.value)}
                      placeholder="09:30 م"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-slate-100 focus:outline-none focus:border-amber-400 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">مأدبة العشاء</label>
                    <input
                      type="text"
                      value={editDinnerTime}
                      onChange={(e) => setEditDinnerTime(e.target.value)}
                      placeholder="10:30 م"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-slate-100 focus:outline-none focus:border-amber-400 font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Gifting / IBAN & Gate PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                    <Gift className="w-4 h-4" />
                    <span>رقم الآيبان للعانية (اختياري)</span>
                  </div>
                  <input
                    type="text"
                    value={editIban}
                    onChange={(e) => setEditIban(e.target.value)}
                    placeholder="SA0000000000000000000000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-slate-100 focus:outline-none focus:border-amber-400 font-mono text-xs"
                    dir="ltr"
                  />
                  <input
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    placeholder="اسم البنك (مثال: مصرف الراجحي)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-slate-100 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>

                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                    <Lock className="w-4 h-4" />
                    <span>رمز PIN لماسح البوابات</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    الرمز السري لفتح تطبيق ماسح البوابة لموظفي الاستقبال:
                  </p>
                  <input
                    type="text"
                    maxLength={6}
                    value={editGatePin}
                    onChange={(e) => setEditGatePin(e.target.value)}
                    placeholder="2026"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400 font-mono text-center font-bold text-sm tracking-widest"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">تاريخ الحفل</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">وقت الحفل</label>
                  <input
                    type="time"
                    value={editTime.slice(0, 5)}
                    onChange={(e) => setEditTime(e.target.value + ':00')}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">اسم القاعة</label>
                  <input
                    type="text"
                    value={editVenue}
                    onChange={(e) => setEditVenue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">رابط خرائط جوجل (Google Maps)</label>
                  <input
                    type="text"
                    value={editMapsUrl}
                    onChange={(e) => setEditMapsUrl(e.target.value)}
                    placeholder="https://maps.google.com/..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">عنوان القاعة</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="مثال: طريق الملك فهد، حي النخيل، الرياض"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <ImageIcon className="w-4 h-4" />
                  <span>صورة أو تصميم بطاقة الدعوة (اختياري)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  إذا صممت كرت دعوة في Canva أو لديك صورة مصممة، ضع رابط الصورة هنا لتظهر داخل صفحة الدعوة بدلاً من النص العادي:
                </p>
                <input
                  type="text"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="https://example.com/my-wedding-invitation.png أو رابط الصورة"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">بيت الشعر أو نص الترحيب</label>
                <textarea
                  value={editVerse}
                  onChange={(e) => setEditVerse(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="py-2 px-5 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <span>استيراد قائمة الضيوف من Excel / CSV</span>
              </h2>
              <button
                onClick={() => {
                  setIsImportOpen(false);
                  setImportedPreview([]);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-2xl text-center space-y-3 bg-slate-950/50 transition-colors">
              <Upload className="w-8 h-8 text-amber-400 mx-auto" />
              <div>
                <p className="text-xs font-semibold text-slate-200">اختر ملف Excel (.xlsx أو .csv)</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  الأعمدة: الاسم (name)، الجوال (phone)، العدد (allowed_guests)، القسم (section)، الداعي (host)، الطاولة (table)
                </p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelUpload}
                className="hidden"
                id="excel-file-input"
              />
              <label
                htmlFor="excel-file-input"
                className="inline-block py-2 px-4 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold cursor-pointer hover:brightness-110"
              >
                تحديد الملف من جهازك
              </label>
            </div>

            {importedPreview.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950">
                <p className="text-xs font-bold text-emerald-400 mb-2">
                  تمت قراءة {importedPreview.length} ضيف بنجاح. معاينة:
                </p>
                {importedPreview.slice(0, 10).map((row, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-xs p-2 bg-slate-900 rounded-lg border border-slate-800"
                  >
                    <span className="font-bold text-slate-200">{row.party_name}</span>
                    <span className="text-slate-400">{row.host_name || 'العريس'}</span>
                    <span className="text-amber-300">{row.allowed_count} أفراد</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsImportOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importedPreview.length === 0 || importing}
                className="py-2.5 px-5 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {importing ? 'جاري الاستيراد والتوليد...' : `حفظ وتوليد ${importedPreview.length} دعوة`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Manual Guest Modal */}
      {isAddManualOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100">إضافة مدعو جديد يدوياً</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">اسم المدعو / العائلة *</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="مثال: خالد محمد العتيبي"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">الداعي المسؤول</label>
                  <select
                    value={manualHost}
                    onChange={(e) => setManualHost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="العريس">العريس 🤵</option>
                    <option value="والد العريس">والد العريس 👔</option>
                    <option value="والد العروس">والد العروس 👑</option>
                    <option value="قسم النساء">قسم النساء 🌸</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">رقم الطاولة (اختياري)</label>
                  <input
                    type="text"
                    value={manualTable}
                    onChange={(e) => setManualTable(e.target.value)}
                    placeholder="مثال: طاولة 5"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">رقم الجوال (اختياري)</label>
                <input
                  type="text"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">العدد المسموح</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={manualAllowed}
                    onChange={(e) => setManualAllowed(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">القسم</label>
                  <select
                    value={manualSection}
                    onChange={(e) => setManualSection(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="men">قسم الرجال 🤵</option>
                    <option value="women">قسم النساء 🌸</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsAddManualOpen(false)}
                className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddManualGuest}
                className="py-2 px-5 rounded-xl gold-gradient-bg text-slate-950 text-xs font-bold cursor-pointer"
              >
                حفظ وإصدار الدعوة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
