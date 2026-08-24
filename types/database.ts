export type RSVPStatus = 'unopened' | 'viewed' | 'confirmed' | 'declined';
export type DispatchStatus = 'draft' | 'whatsapp_opened' | 'sent';
export type EntryPassStatus = 'active' | 'revoked';
export type CheckInType = 'QR_SCAN' | 'MANUAL_SEARCH';
export type ScanResult =
  | 'SUCCESS'
  | 'ALREADY_CHECKED_IN'
  | 'REVOKED'
  | 'NOT_FOUND'
  | 'DECLINED'
  | 'MANUAL_OVERRIDE'
  | 'CROSS_SECTION_WARNING'
  // Client-only provisional states for offline gate operation.
  // They never reach check_in_logs.scan_result (server CHECK constraint).
  | 'LOCAL_ADMISSION'
  | 'RECONCILE_CONFLICT';
export type SectionType = 'men' | 'women' | 'vip' | 'groom_family' | 'bride_family' | 'general';
export type GroupLimitMode = 'unlimited' | 'warning' | 'strict';
export type HostRole = 'العريس' | 'والد العريس' | 'والد العروس' | 'قسم النساء' | string;

export interface WeddingEvent {
  id: string;
  slug: string;
  groom_name: string;
  bride_name: string;
  event_date: string; // YYYY-MM-DD
  event_time: string; // HH:MM:SS
  venue_name: string;
  venue_address?: string | null;
  venue_maps_url?: string | null;
  theme_id: string; // 'classic_gold' | 'modern_royal' | 'soft_romantic'
  rsvp_mode: 'simple' | 'count';
  welcome_verse?: string | null;
  invitation_image_url?: string | null;
  timeline_reception?: string | null; // e.g. "08:00 م"
  timeline_ardah?: string | null; // e.g. "09:30 م"
  timeline_dinner?: string | null; // e.g. "10:30 م"
  iban?: string | null; // e.g. "SA0380000000608010167519"
  bank_name?: string | null; // e.g. "مصرف الراجحي"
  gate_pin?: string | null; // e.g. "2026"
  owner_id?: string | null;
  created_at: string;
}

export interface GroupInviteLink {
  id: string;
  event_id: string;
  host_name: HostRole;
  group_name: string; // e.g. "قروب زملاء العمل"
  slug: string; // e.g. "colleagues"
  limit_mode: GroupLimitMode; // 'unlimited' | 'warning' | 'strict'
  max_capacity?: number | null; // e.g. 30
  confirmed_count: number; // total attendees registered from this link
  max_seats_per_guest: number; // e.g. 2
  section: SectionType | string;
  is_active: boolean;
  created_at: string;
}

export interface Party {
  id: string;
  event_id: string;
  host_name: HostRole;
  group_link_id?: string | null;
  group_name?: string | null;
  party_name: string;
  primary_phone?: string | null;
  allowed_count: number;
  confirmed_count: number;
  actual_checked_in_count: number;
  table_number?: string | null; // e.g. "طاولة 7"
  needs_wheelchair?: boolean; // كبار السن وعربة التنقل
  is_vip?: boolean; // ضيف شرف / كبار الشخصيات
  invitation_token_hash: string;
  raw_invitation_token?: string; // Only available during generation/admin views
  dispatch_status: DispatchStatus;
  rsvp_status: RSVPStatus;
  rsvp_at?: string | null;
  section: SectionType | string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartyMember {
  id: string;
  party_id: string;
  name: string;
  is_primary: boolean;
  created_at: string;
}

export interface EntryPass {
  id: string;
  party_id: string;
  pass_token_hash: string;
  raw_pass_token?: string; // Provided to guest UI / QR code
  status: EntryPassStatus;
  is_checked_in: boolean;
  men_checked_in: number;
  women_checked_in: number;
  first_check_in_at?: string | null;
  created_at: string;
  revoked_at?: string | null;
}

export interface Wish {
  id: string;
  event_id: string;
  party_id?: string | null;
  sender_name?: string;
  party_name?: string;
  message: string;
  is_approved: boolean; // For display on big hall screen
  created_at: string;
}

export interface EventMoment {
  id: string;
  event_id: string;
  uploader_name: string;
  uploader_phone?: string | null;
  media_url: string; // Base64 data or storage URL
  caption?: string | null;
  section: string;
  is_approved: boolean;
  created_at: string;
}

export interface GateStation {
  id: string;
  event_id: string;
  station_name: string;
  station_section: 'men' | 'women' | 'general';
  operator_username: string;
  is_active: boolean;
  created_at: string;
}

export interface CheckInLog {
  id: string;
  event_id?: string | null;
  party_id?: string | null;
  entry_pass_id?: string | null;
  scanned_token_hash: string;
  station_name: string;
  operator_name: string;
  checkin_type: CheckInType;
  scan_result: ScanResult;
  admitted_count: number;
  table_number?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface CheckInRPCResponse {
  success: boolean;
  code: ScanResult;
  message: string;
  party_name?: string;
  admitted_count?: number;
  section?: string;
  table_number?: string | null;
  host_name?: string;
  is_vip?: boolean;
  needs_wheelchair?: boolean;
  is_cross_section_warning?: boolean;
  check_in_time?: string;
  first_check_in_at?: string;
  /** True when admission was granted locally while offline (provisional, pending reconciliation). */
  is_provisional?: boolean;
}
