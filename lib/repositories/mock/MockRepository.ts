import type {
  WeddingEvent,
  Party,
  EntryPass,
  CheckInLog,
  CheckInRPCResponse,
  DispatchStatus,
  GroupInviteLink,
  GroupLimitMode,
  Wish,
  EventMoment,
  HostRole,
} from '../../../types/database.ts';
import type {
  IEventRepository,
  IPartyRepository,
  IGroupLinkRepository,
  ICheckInRepository,
  IWishRepository,
  IMomentRepository,
  IEventStatsRepository,
} from '../types.ts';
import { generateInvitationToken, generateEntryPassToken, hashToken } from '../../crypto/tokens.ts';
import { normalizeSaudiPhone } from '../../utils/phone.ts';

const DEFAULT_EVENT_ID = 'e82b75a1-4321-4f99-8d76-9c8821a71101';

const INITIAL_EVENT: WeddingEvent = {
  id: DEFAULT_EVENT_ID,
  slug: 'salman-nourah',
  groom_name: 'سلمان بن فهد العتيبي',
  bride_name: 'نورية بنت عبدالله آل سعود',
  event_date: '2026-11-16',
  event_time: '20:00:00',
  venue_name: 'قصر الثريا للاحتفالات والمؤتمرات',
  venue_address: 'طريق الملك فهد، حي الصحافة، الرياض',
  venue_maps_url: 'https://maps.google.com/?q=24.7951,46.6432',
  theme_id: 'classic_gold',
  rsvp_mode: 'count',
  welcome_verse: 'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً',
  timeline_reception: '08:00 م',
  timeline_ardah: '09:30 م',
  timeline_dinner: '10:30 م',
  iban: 'SA0380000000608010167519',
  bank_name: 'مصرف الراجحي',
  gate_pin: '2026',
  created_at: '2026-08-20T10:00:00Z',
};

interface MemoryDatabase {
  events: Map<string, WeddingEvent>;
  groupLinks: Map<string, GroupInviteLink>;
  parties: Map<string, Party>;
  entryPasses: Map<string, EntryPass>;
  checkInLogs: CheckInLog[];
  wishes: Wish[];
  moments: EventMoment[];
  tokenToPartyMap: Map<string, string>;
  rawPassTokenMap: Map<string, string>;
}

function getDatabaseStore(): MemoryDatabase {
  const g = globalThis as any;
  if (!g.__weddingpass_mock_db) {
    const db: MemoryDatabase = {
      events: new Map([[INITIAL_EVENT.id, { ...INITIAL_EVENT }]]),
      groupLinks: new Map(),
      parties: new Map(),
      entryPasses: new Map(),
      checkInLogs: [],
      wishes: [],
      moments: [],
      tokenToPartyMap: new Map(),
      rawPassTokenMap: new Map(),
    };

    // Seed Demo Group Links
    const group1: GroupInviteLink = {
      id: 'grp_demo_colleagues',
      event_id: DEFAULT_EVENT_ID,
      host_name: 'العريس',
      group_name: 'قروب زملاء العمل',
      slug: 'colleagues',
      limit_mode: 'warning',
      max_capacity: 40,
      confirmed_count: 14,
      max_seats_per_guest: 2,
      section: 'men',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const group2: GroupInviteLink = {
      id: 'grp_demo_friends',
      event_id: DEFAULT_EVENT_ID,
      host_name: 'العريس',
      group_name: 'أصدقاء الطفولة والجامعة',
      slug: 'friends',
      limit_mode: 'strict',
      max_capacity: 15,
      confirmed_count: 12,
      max_seats_per_guest: 1,
      section: 'men',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    db.groupLinks.set(group1.id, group1);
    db.groupLinks.set(group2.id, group2);

    // Seed demo party & pass
    const p1: Party = {
      id: 'party_demo_1',
      event_id: DEFAULT_EVENT_ID,
      host_name: 'العريس',
      group_name: 'دعوة خاصة',
      party_name: 'أحمد بن فهد الدوسري',
      primary_phone: '966501234567',
      allowed_count: 2,
      confirmed_count: 2,
      actual_checked_in_count: 0,
      table_number: 'طاولة 12',
      needs_wheelchair: false,
      is_vip: false,
      invitation_token_hash: 'wp_inv_demo_1_hash',
      raw_invitation_token: 'wp_inv_demo_1_أحم',
      dispatch_status: 'sent',
      rsvp_status: 'confirmed',
      rsvp_at: '2026-08-21T12:00:00Z',
      section: 'men',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const pass1: EntryPass = {
      id: 'pass_demo_1',
      party_id: p1.id,
      pass_token_hash: 'wp_pass_demo_1_hash',
      raw_pass_token: 'wp_pass_demo_1',
      status: 'active',
      is_checked_in: false,
      men_checked_in: 0,
      women_checked_in: 0,
      created_at: new Date().toISOString(),
    };
    db.parties.set(p1.id, p1);
    db.entryPasses.set(p1.id, pass1);
    db.tokenToPartyMap.set(p1.raw_invitation_token!, p1.id);
    db.rawPassTokenMap.set(pass1.raw_pass_token!, p1.id);

    // Seed VIP party
    const p2: Party = {
      id: 'party_demo_2',
      event_id: DEFAULT_EVENT_ID,
      host_name: 'والد العريس',
      group_name: 'كبار الشخصيات',
      party_name: 'الشيخ سلطان بن مطلق السبيعي',
      primary_phone: '966551122334',
      allowed_count: 4,
      confirmed_count: 4,
      actual_checked_in_count: 0,
      table_number: 'طاولة الشرف 1',
      needs_wheelchair: true,
      is_vip: true,
      invitation_token_hash: 'wp_inv_demo_2_hash',
      raw_invitation_token: 'wp_inv_demo_2_سلط',
      dispatch_status: 'sent',
      rsvp_status: 'confirmed',
      section: 'men',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const pass2: EntryPass = {
      id: 'pass_demo_2',
      party_id: p2.id,
      pass_token_hash: 'wp_pass_demo_2_hash',
      raw_pass_token: 'wp_pass_demo_2',
      status: 'active',
      is_checked_in: false,
      men_checked_in: 0,
      women_checked_in: 0,
      created_at: new Date().toISOString(),
    };
    db.parties.set(p2.id, p2);
    db.entryPasses.set(p2.id, pass2);
    db.tokenToPartyMap.set(p2.raw_invitation_token!, p2.id);
    db.rawPassTokenMap.set(pass2.raw_pass_token!, p2.id);

    // Seed Women party
    const p3: Party = {
      id: 'party_demo_3',
      event_id: DEFAULT_EVENT_ID,
      host_name: 'قسم النساء',
      party_name: 'أم راشد الشمري',
      primary_phone: '966567788990',
      allowed_count: 2,
      confirmed_count: 2,
      actual_checked_in_count: 0,
      table_number: 'طاولة الورد 4',
      needs_wheelchair: false,
      is_vip: false,
      invitation_token_hash: 'wp_inv_demo_3_hash',
      raw_invitation_token: 'wp_inv_demo_3_أم',
      dispatch_status: 'sent',
      rsvp_status: 'confirmed',
      section: 'women',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const pass3: EntryPass = {
      id: 'pass_demo_3',
      party_id: p3.id,
      pass_token_hash: 'wp_pass_demo_3_hash',
      raw_pass_token: 'wp_pass_demo_3',
      status: 'active',
      is_checked_in: false,
      men_checked_in: 0,
      women_checked_in: 0,
      created_at: new Date().toISOString(),
    };
    db.parties.set(p3.id, p3);
    db.entryPasses.set(p3.id, pass3);
    db.tokenToPartyMap.set(p3.raw_invitation_token!, p3.id);
    db.rawPassTokenMap.set(pass3.raw_pass_token!, p3.id);

    // Seed Party 5 (Unopened invite for RSVP test)
    const p5: Party = {
      id: 'party_demo_5',
      event_id: DEFAULT_EVENT_ID,
      host_name: 'العريس',
      group_name: 'دعوة خاصة',
      party_name: 'تركي بن خالد آل سعود',
      primary_phone: '966543210987',
      allowed_count: 2,
      confirmed_count: 0,
      actual_checked_in_count: 0,
      table_number: 'طاولة 5',
      needs_wheelchair: false,
      is_vip: false,
      invitation_token_hash: 'wp_inv_demo_5_hash',
      raw_invitation_token: 'wp_inv_demo_5_ترك',
      dispatch_status: 'sent',
      rsvp_status: 'unopened',
      section: 'men',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.parties.set(p5.id, p5);
    db.tokenToPartyMap.set(p5.raw_invitation_token!, p5.id);

    g.__weddingpass_mock_db = db;
  }
  return g.__weddingpass_mock_db;
}

export class MockRepository implements
  IEventRepository,
  IPartyRepository,
  IGroupLinkRepository,
  ICheckInRepository,
  IWishRepository,
  IMomentRepository,
  IEventStatsRepository
{
  async getDefaultEvent(): Promise<WeddingEvent> {
    const db = getDatabaseStore();
    return Array.from(db.events.values())[0];
  }

  async updateEventSettings(eventId: string, eventData: Partial<WeddingEvent>): Promise<WeddingEvent | null> {
    const db = getDatabaseStore();
    const event = db.events.get(eventId);
    if (!event) return null;
    Object.assign(event, eventData);
    return event;
  }

  async getPartyByInvitationToken(rawToken: string): Promise<{ party: Party; event: WeddingEvent; entryPass?: EntryPass } | null> {
    const db = getDatabaseStore();
    const trimmed = rawToken.trim();
    const partyId = db.tokenToPartyMap.get(trimmed);
    if (!partyId) return null;

    const party = db.parties.get(partyId);
    if (!party) return null;

    const event = db.events.get(party.event_id) || INITIAL_EVENT;
    const entryPass = db.entryPasses.get(party.id);

    if (party.rsvp_status === 'unopened') {
      party.rsvp_status = 'viewed';
      party.updated_at = new Date().toISOString();
    }

    return { party, event, entryPass };
  }

  async submitPartyRSVP(
    partyId: string,
    status: 'confirmed' | 'declined',
    attendingCount: number,
    notes?: string,
    needsWheelchair?: boolean
  ): Promise<{ success: boolean; entryPass?: EntryPass; message: string }> {
    const db = getDatabaseStore();
    // Runtime parity with submit_party_rsvp_atomic allow-list (migration 007).
    if (status !== 'confirmed' && status !== 'declined') {
      return { success: false, message: 'حالة تأكيد الحضور غير صالحة' };
    }
    const party = db.parties.get(partyId);
    if (!party) return { success: false, message: 'لم يتم العثور على الدعوة' };

    party.rsvp_status = status;
    party.rsvp_at = new Date().toISOString();
    party.updated_at = new Date().toISOString();
    if (needsWheelchair !== undefined) party.needs_wheelchair = needsWheelchair;
    if (notes !== undefined) party.notes = notes;

    if (status === 'confirmed') {
      party.confirmed_count = Math.min(Math.max(1, attendingCount), party.allowed_count);
      let pass = db.entryPasses.get(partyId);
      if (!pass || pass.status === 'revoked') {
        const rawPassToken = generateEntryPassToken();
        const passHash = await hashToken(rawPassToken);
        pass = {
          id: `pass_${Date.now()}`,
          party_id: partyId,
          pass_token_hash: passHash,
          raw_pass_token: rawPassToken,
          status: 'active',
          is_checked_in: false,
          men_checked_in: 0,
          women_checked_in: 0,
          created_at: new Date().toISOString(),
        };
        db.entryPasses.set(partyId, pass);
        db.rawPassTokenMap.set(rawPassToken, partyId);
      }
      return { success: true, entryPass: pass, message: 'تم تأكيد حضورك بنجاح 🌹' };
    } else {
      party.confirmed_count = 0;
      return { success: true, message: 'تم تسجيل اعتذارك الكريمة، ونقدر ظرفك 🌹' };
    }
  }

  async getAllParties(eventId: string): Promise<Party[]> {
    const db = getDatabaseStore();
    return Array.from(db.parties.values()).filter((p) => p.event_id === eventId);
  }

  async bulkAddParties(
    eventId: string,
    rawGuests: Array<{
      party_name: string;
      primary_phone?: string;
      allowed_count?: number;
      section?: string;
      host_name?: string;
      table_number?: string;
      wheelchair?: boolean;
      is_vip?: boolean;
      notes?: string;
    }>
  ): Promise<{ addedCount: number; parties: Party[] }> {
    const db = getDatabaseStore();
    const newParties: Party[] = [];

    for (const raw of rawGuests) {
      const rawInvToken = generateInvitationToken();
      const invHash = await hashToken(rawInvToken);
      const partyId = `party_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const normalizedPhone = raw.primary_phone ? normalizeSaudiPhone(raw.primary_phone) : null;

      const party: Party = {
        id: partyId,
        event_id: eventId,
        host_name: (raw.host_name as HostRole) || 'العريس',
        group_name: 'دعوة خاصة',
        party_name: raw.party_name.trim(),
        primary_phone: normalizedPhone,
        allowed_count: raw.allowed_count ? Math.max(1, Number(raw.allowed_count)) : 1,
        confirmed_count: 0,
        actual_checked_in_count: 0,
        table_number: raw.table_number ? raw.table_number.trim() : null,
        needs_wheelchair: Boolean(raw.wheelchair),
        is_vip: Boolean(raw.is_vip),
        invitation_token_hash: invHash,
        raw_invitation_token: rawInvToken,
        dispatch_status: 'draft',
        rsvp_status: 'unopened',
        section: raw.section || 'men',
        notes: raw.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.parties.set(partyId, party);
      db.tokenToPartyMap.set(rawInvToken, partyId);
      newParties.push(party);
    }

    return { addedCount: newParties.length, parties: newParties };
  }

  async updatePartyDispatch(partyId: string, status: DispatchStatus): Promise<void> {
    const db = getDatabaseStore();
    const party = db.parties.get(partyId);
    if (party) {
      party.dispatch_status = status;
      party.updated_at = new Date().toISOString();
    }
  }

  async updatePartyTableNumber(partyId: string, tableNumber?: string | null): Promise<boolean> {
    const db = getDatabaseStore();
    const party = db.parties.get(partyId);
    if (party) {
      party.table_number = tableNumber ? tableNumber.trim() : null;
      party.updated_at = new Date().toISOString();
      return true;
    }
    return false;
  }

  async recoverGuestPassByPhone(eventId: string, rawPhone: string): Promise<{ success: boolean; party?: Party; entryPass?: EntryPass; message: string }> {
    const db = getDatabaseStore();
    const normalized = normalizeSaudiPhone(rawPhone);
    if (!normalized) return { success: false, message: 'يرجى إدخال رقم جوال صحيح' };

    for (const p of Array.from(db.parties.values())) {
      if (p.event_id === eventId && p.primary_phone === normalized) {
        let pass = db.entryPasses.get(p.id);
        return {
          success: true,
          party: p,
          entryPass: pass,
          message: `تم العثور على بطاقة دخولك يا ${p.party_name}!`,
        };
      }
    }
    return { success: false, message: 'لم يتم العثور على أي حجز مسجل بهذا الرقم في هذه المناسبة' };
  }

  async searchParties(eventId: string, query: string): Promise<Party[]> {
    const db = getDatabaseStore();
    const q = query.toLowerCase();
    return Array.from(db.parties.values())
      .filter((p) => p.event_id === eventId && (p.party_name.toLowerCase().includes(q) || (p.primary_phone && p.primary_phone.includes(q))))
      .slice(0, 20);
  }

  // --------------------------------------------------------------------------
  // Group Links
  // --------------------------------------------------------------------------
  async getAllGroupLinks(eventId: string): Promise<GroupInviteLink[]> {
    const db = getDatabaseStore();
    return Array.from(db.groupLinks.values()).filter((g) => g.event_id === eventId);
  }

  async getGroupLinkBySlug(slug: string): Promise<{ group: GroupInviteLink; event: WeddingEvent } | null> {
    const db = getDatabaseStore();
    const event = await this.getDefaultEvent();
    for (const g of Array.from(db.groupLinks.values())) {
      if (g.slug === slug.trim() && g.is_active) {
        return { group: g, event };
      }
    }
    return null;
  }

  async createGroupLink(
    eventId: string,
    groupName: string,
    slug: string,
    hostName: HostRole,
    limitMode: GroupLimitMode,
    maxCapacity?: number,
    maxSeatsPerGuest?: number,
    section?: string
  ): Promise<GroupInviteLink> {
    const db = getDatabaseStore();
    const newGroup: GroupInviteLink = {
      id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      event_id: eventId,
      group_name: groupName.trim(),
      slug: slug.trim(),
      host_name: hostName,
      limit_mode: limitMode,
      max_capacity: maxCapacity || 30,
      confirmed_count: 0,
      max_seats_per_guest: maxSeatsPerGuest || 2,
      section: section || 'men',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    db.groupLinks.set(newGroup.id, newGroup);
    return newGroup;
  }

  async registerGroupGuest(
    slug: string,
    guestName: string,
    guestPhone: string,
    seatsCount: number,
    notes?: string
  ): Promise<{ success: boolean; code: string; message: string; party?: Party; entryPass?: EntryPass; remainingSeats?: number }> {
    const db = getDatabaseStore();
    const event = await this.getDefaultEvent();

    let group: GroupInviteLink | undefined;
    for (const g of Array.from(db.groupLinks.values())) {
      if (g.slug === slug.trim() && g.is_active) {
        group = g;
        break;
      }
    }

    if (!group) return { success: false, code: 'GROUP_NOT_FOUND', message: 'رابط الدعوة غير موجود أو تم إيقافه' };

    const normalizedPhone = normalizeSaudiPhone(guestPhone);
    if (!normalizedPhone) return { success: false, code: 'INVALID_PHONE', message: 'يرجى إدخال رقم جوال صحيح' };

    // Duplicate registration (ADR-030 parity with the atomic RPC):
    // NO pass rotation and NO raw token is returned — knowing a phone number
    // must never invalidate or hand over an existing guest's credential.
    for (const p of Array.from(db.parties.values())) {
      if (p.event_id === event.id && p.primary_phone === normalizedPhone && p.group_link_id === group.id) {
        return {
          success: true,
          code: 'ALREADY_REGISTERED',
          message: `أهلاً بك مجدداً يا ${p.party_name}! تم تسجيل هذا الرقم مسبقاً في هذه المجموعة — استخدم رابط الدعوة الأصلي لاستعراض بطاقة دخولك 🌹`,
          party: p,
          entryPass: undefined,
        };
      }
    }

    if (group.limit_mode === 'strict' && group.max_capacity) {
      if (group.confirmed_count + seatsCount > group.max_capacity) {
        const remaining = Math.max(0, group.max_capacity - group.confirmed_count);
        return {
          success: false,
          code: 'QUOTA_EXCEEDED',
          message: 'عذراً، اكتملت جميع المقاعد المخصصة لهذه المجموعة 🌹',
          remainingSeats: remaining,
        };
      }
    }

    const seats = Math.min(Math.max(1, seatsCount), group.max_seats_per_guest);

    // Atomic Allocation
    group.confirmed_count += seats;

    const rawInvToken = generateInvitationToken();
    const invHash = await hashToken(rawInvToken);
    const partyId = `party_grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const newParty: Party = {
      id: partyId,
      event_id: event.id,
      host_name: group.host_name || 'العريس',
      group_link_id: group.id,
      group_name: group.group_name,
      party_name: guestName.trim(),
      primary_phone: normalizedPhone,
      allowed_count: seats,
      confirmed_count: seats,
      actual_checked_in_count: 0,
      table_number: null,
      needs_wheelchair: false,
      is_vip: false,
      invitation_token_hash: invHash,
      raw_invitation_token: rawInvToken,
      dispatch_status: 'sent',
      rsvp_status: 'confirmed',
      rsvp_at: new Date().toISOString(),
      section: group.section || 'men',
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.parties.set(partyId, newParty);
    db.tokenToPartyMap.set(rawInvToken, partyId);

    const rawPassToken = generateEntryPassToken();
    const passHash = await hashToken(rawPassToken);
    const entryPass: EntryPass = {
      id: `pass_${Date.now()}`,
      party_id: partyId,
      pass_token_hash: passHash,
      raw_pass_token: rawPassToken,
      status: 'active',
      is_checked_in: false,
      men_checked_in: 0,
      women_checked_in: 0,
      created_at: new Date().toISOString(),
    };

    db.entryPasses.set(partyId, entryPass);
    db.rawPassTokenMap.set(rawPassToken, partyId);

    return {
      success: true,
      code: 'SUCCESS',
      message: 'تم تأكيد حضورك بنجاح! بطاقة الدخول الخاصة بك جاهزة 🌹',
      party: newParty,
      entryPass,
    };
  }

  // --------------------------------------------------------------------------
  // Check-In
  // --------------------------------------------------------------------------
  async executeCheckIn(
    eventId: string,
    rawPassToken: string,
    stationName: string,
    operatorName: string,
    checkinType: 'QR_SCAN' | 'MANUAL_SEARCH' = 'QR_SCAN',
    overrideCount?: number,
    gateSection: 'men' | 'women' | 'general' = 'men',
    forceAdmitCrossSection: boolean = false,
    reconciliation?: { queueId?: string | null; deviceMetadata?: Record<string, any> | null }
  ): Promise<CheckInRPCResponse> {
    const db = getDatabaseStore();
    const trimmed = rawPassToken.trim();
    const passTokenHash = await hashToken(trimmed);

    let partyId = db.rawPassTokenMap.get(trimmed);
    let pass: EntryPass | undefined;

    if (partyId) {
      pass = db.entryPasses.get(partyId);
    } else {
      for (const p of Array.from(db.entryPasses.values())) {
        if (p.pass_token_hash === passTokenHash || p.raw_pass_token === trimmed) {
          pass = p;
          partyId = p.party_id;
          break;
        }
      }
    }

    if (!pass || !partyId) {
      db.checkInLogs.unshift({
        id: `log_${Date.now()}`,
        event_id: eventId,
        scanned_token_hash: passTokenHash,
        station_name: stationName,
        operator_name: operatorName,
        checkin_type: checkinType,
        scan_result: 'NOT_FOUND',
        admitted_count: 0,
        created_at: new Date().toISOString(),
      });
      return { success: false, code: 'NOT_FOUND', message: 'رمز بطاقة الدخول غير مسجل في النظام' };
    }

    const party = db.parties.get(partyId);
    if (!party || party.event_id !== eventId) {
      return { success: false, code: 'NOT_FOUND', message: 'هذه البطاقة غير تابعة لهذا الحفل' };
    }

    if (pass.status === 'revoked') {
      db.checkInLogs.unshift({
        id: `log_${Date.now()}`,
        event_id: eventId,
        party_id: party.id,
        entry_pass_id: pass.id,
        scanned_token_hash: passTokenHash,
        station_name: stationName,
        operator_name: operatorName,
        checkin_type: checkinType,
        scan_result: 'REVOKED',
        admitted_count: 0,
        created_at: new Date().toISOString(),
      });
      return { success: false, code: 'REVOKED', party_name: party.party_name, message: 'تم إلغاء صلاحية هذه البطاقة مسبقاً' };
    }

    if (!forceAdmitCrossSection && gateSection !== 'general') {
      const isWomenPass = party.section === 'women';
      const isMenPass = party.section === 'men' || party.section === 'vip' || party.section === 'groom_family';

      if (gateSection === 'men' && isWomenPass) {
        return {
          success: false,
          code: 'CROSS_SECTION_WARNING',
          is_cross_section_warning: true,
          party_name: party.party_name,
          section: party.section,
          table_number: party.table_number,
          message: '⚠️ تنبيه: هذه البطاقة مخصصة لقسم النساء 🧕 - يرجى توجيه الضيفة للبوابة النسائية.',
        };
      }
      if (gateSection === 'women' && isMenPass) {
        return {
          success: false,
          code: 'CROSS_SECTION_WARNING',
          is_cross_section_warning: true,
          party_name: party.party_name,
          section: party.section,
          table_number: party.table_number,
          message: '⚠️ تنبيه: هذه البطاقة مخصصة لقسم الرجال 🤵 - يرجى توجيه الضيف لبوابة الرجال.',
        };
      }
    }

    if (pass.is_checked_in) {
      db.checkInLogs.unshift({
        id: `log_${Date.now()}`,
        event_id: eventId,
        party_id: party.id,
        entry_pass_id: pass.id,
        scanned_token_hash: passTokenHash,
        station_name: stationName,
        operator_name: operatorName,
        checkin_type: checkinType,
        scan_result: 'ALREADY_CHECKED_IN',
        admitted_count: 0,
        created_at: new Date().toISOString(),
      });
      return { success: false, code: 'ALREADY_CHECKED_IN', party_name: party.party_name, message: 'تم استخدام بطاقة الدخول هذه مسبقاً!' };
    }

    const finalCount = overrideCount && overrideCount > 0 ? overrideCount : party.confirmed_count || 1;
    pass.is_checked_in = true;
    pass.first_check_in_at = new Date().toISOString();
    party.actual_checked_in_count = finalCount;

    db.checkInLogs.unshift({
      id: `log_${Date.now()}`,
      event_id: eventId,
      party_id: party.id,
      entry_pass_id: pass.id,
      scanned_token_hash: passTokenHash,
      station_name: stationName,
      operator_name: operatorName,
      checkin_type: checkinType,
      scan_result: 'SUCCESS',
      admitted_count: finalCount,
      created_at: new Date().toISOString(),
    });

    const isVip = Boolean(party.is_vip) || party.section === 'vip';
    return {
      success: true,
      code: 'SUCCESS',
      party_name: party.party_name,
      admitted_count: finalCount,
      section: party.section,
      table_number: party.table_number || null,
      host_name: party.host_name,
      is_vip: isVip,
      needs_wheelchair: Boolean(party.needs_wheelchair),
      check_in_time: pass.first_check_in_at,
      message: 'تم التحقق بنجاح • أهلاً وسهلاً بكم 🌹',
    };
  }

  async getCheckInLogs(eventId: string): Promise<CheckInLog[]> {
    const db = getDatabaseStore();
    return db.checkInLogs.filter((l) => l.event_id === eventId);
  }

  async getActivePassesForOfflineCache(eventId: string) {
    const db = getDatabaseStore();
    const parties = Array.from(db.parties.values()).filter((p) => p.event_id === eventId);
    return parties.flatMap((party) => {
      const pass = db.entryPasses.get(party.id);
      if (pass && pass.status === 'active') {
        return [{
          partyId: party.id,
          partyName: party.party_name,
          passTokenHash: pass.pass_token_hash,
          confirmedCount: party.confirmed_count || party.allowed_count,
          section: party.section,
          tableNumber: party.table_number || null,
          hostName: party.host_name || 'العريس',
          needsWheelchair: Boolean(party.needs_wheelchair),
          isCheckedIn: pass.is_checked_in,
          isVip: Boolean(party.is_vip),
        }];
      }
      return [];
    });
  }

  async revokePass(partyId: string): Promise<boolean> {
    const db = getDatabaseStore();
    const pass = db.entryPasses.get(partyId);
    if (pass) {
      pass.status = 'revoked';
      pass.revoked_at = new Date().toISOString();
      return true;
    }
    return false;
  }

  async regeneratePass(partyId: string): Promise<EntryPass | null> {
    const db = getDatabaseStore();
    const rawPassToken = generateEntryPassToken();
    const passHash = await hashToken(rawPassToken);
    const pass = db.entryPasses.get(partyId);
    if (pass) {
      pass.pass_token_hash = passHash;
      pass.raw_pass_token = rawPassToken;
      pass.status = 'active';
      pass.is_checked_in = false;
      pass.first_check_in_at = null;
      db.rawPassTokenMap.set(rawPassToken, partyId);
      return pass;
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Wishes & Moments
  // --------------------------------------------------------------------------
  async getWishes(eventId: string, onlyApproved: boolean = true): Promise<Wish[]> {
    const db = getDatabaseStore();
    return db.wishes.filter((w) => w.event_id === eventId && (!onlyApproved || w.is_approved));
  }

  async addWish(eventId: string, partyName: string, message: string, partyId?: string, isApproved: boolean = false): Promise<Wish> {
    const db = getDatabaseStore();
    const wish: Wish = {
      id: `wish_${Date.now()}`,
      event_id: eventId,
      party_id: partyId || null,
      party_name: partyName.trim(),
      message: message.trim(),
      is_approved: isApproved,
      created_at: new Date().toISOString(),
    };
    db.wishes.unshift(wish);
    return wish;
  }

  async toggleWishApproval(wishId: string, isApproved: boolean): Promise<boolean> {
    const db = getDatabaseStore();
    const wish = db.wishes.find((w) => w.id === wishId);
    if (wish) {
      wish.is_approved = isApproved;
      return true;
    }
    return false;
  }

  async getMoments(eventId: string, onlyApproved: boolean = false): Promise<EventMoment[]> {
    const db = getDatabaseStore();
    return db.moments.filter((m) => m.event_id === eventId && (!onlyApproved || m.is_approved));
  }

  async addMoment(
    eventId: string,
    uploaderName: string,
    mediaUrl: string,
    caption?: string,
    section: 'men' | 'women' = 'men',
    uploaderPhone?: string
  ): Promise<EventMoment> {
    const db = getDatabaseStore();
    const moment: EventMoment = {
      id: `moment_${Date.now()}`,
      event_id: eventId,
      uploader_name: uploaderName.trim(),
      uploader_phone: uploaderPhone?.trim() || null,
      media_url: mediaUrl,
      caption: caption?.trim() || null,
      section,
      is_approved: false,
      created_at: new Date().toISOString(),
    };
    db.moments.unshift(moment);
    return moment;
  }

  async toggleMomentApproval(momentId: string, isApproved: boolean): Promise<boolean> {
    const db = getDatabaseStore();
    const moment = db.moments.find((m) => m.id === momentId);
    if (moment) {
      moment.is_approved = isApproved;
      return true;
    }
    return false;
  }

  async deleteMoment(momentId: string): Promise<boolean> {
    const db = getDatabaseStore();
    const idx = db.moments.findIndex((m) => m.id === momentId);
    if (idx !== -1) {
      db.moments.splice(idx, 1);
      return true;
    }
    return false;
  }

  async getEventStats(eventId: string) {
    const parties = await this.getAllParties(eventId);
    const logs = await this.getCheckInLogs(eventId);

    let totalAllowed = 0;
    let totalConfirmed = 0;
    let totalDeclined = 0;
    let totalUnopened = 0;
    let totalCheckedIn = 0;
    let menCheckedIn = 0;
    let womenCheckedIn = 0;

    const rsvpBreakdown = { confirmed: 0, declined: 0, unopened: 0, viewed: 0 };
    const sectionBreakdown = { men: 0, women: 0, vip: 0, groom_family: 0, bride_family: 0, general: 0 };
    const hostBreakdown: Record<string, { totalAllowed: number; confirmed: number; checkedIn: number }> = {};

    for (const p of parties) {
      totalAllowed += p.allowed_count;
      totalConfirmed += p.confirmed_count;
      totalCheckedIn += p.actual_checked_in_count;

      if (p.rsvp_status === 'confirmed') rsvpBreakdown.confirmed++;
      else if (p.rsvp_status === 'declined') { totalDeclined++; rsvpBreakdown.declined++; }
      else if (p.rsvp_status === 'viewed') rsvpBreakdown.viewed++;
      else { totalUnopened++; rsvpBreakdown.unopened++; }

      const sec = (p.section in sectionBreakdown ? p.section : 'general') as keyof typeof sectionBreakdown;
      sectionBreakdown[sec] += (p.confirmed_count || p.allowed_count);

      const host = p.host_name || 'العريس';
      if (!hostBreakdown[host]) hostBreakdown[host] = { totalAllowed: 0, confirmed: 0, checkedIn: 0 };
      hostBreakdown[host].totalAllowed += p.allowed_count;
      hostBreakdown[host].confirmed += p.confirmed_count;
      hostBreakdown[host].checkedIn += p.actual_checked_in_count;
    }

    for (const log of logs) {
      if (log.scan_result === 'SUCCESS') {
        if (log.station_name.includes('نساء')) womenCheckedIn += log.admitted_count;
        else menCheckedIn += log.admitted_count;
      }
    }

    return {
      totalParties: parties.length,
      totalAllowed,
      totalConfirmed,
      totalDeclined,
      totalUnopened,
      totalCheckedIn,
      menCheckedIn,
      womenCheckedIn,
      rsvpBreakdown,
      sectionBreakdown,
      hostBreakdown,
    };
  }
}
