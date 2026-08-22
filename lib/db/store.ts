import type {
  WeddingEvent,
  Party,
  EntryPass,
  CheckInLog,
  CheckInRPCResponse,
  RSVPStatus,
  DispatchStatus,
  GroupInviteLink,
  GroupLimitMode,
  Wish,
  EventMoment,
  HostRole,
} from '../../types/database.ts';
import { generateInvitationToken, generateEntryPassToken, hashToken } from '../crypto/tokens.ts';
import { normalizeSaudiPhone } from '../utils/phone.ts';
import { supabaseAdmin, isSupabaseConfigured } from './supabase.ts';

const DEFAULT_EVENT_ID = 'e82b75a1-4321-4f99-8d76-9c8821a71101';

const INITIAL_EVENT: WeddingEvent = {
  id: DEFAULT_EVENT_ID,
  slug: 'salman-nourah',
  groom_name: 'سلمان بن فهد العتيبي',
  bride_name: 'نورية بنت عبدالله آل سعود',
  event_date: '2026-11-16',
  event_time: '19:30:00',
  venue_name: 'قاعة الرياض الكبرى للاحتفالات',
  venue_address: 'طريق الملك فهد، حي النخيل، الرياض',
  venue_maps_url: 'https://maps.google.com/?q=Riyadh+Grand+Hall',
  theme_id: 'classic_gold',
  rsvp_mode: 'count',
  welcome_verse: 'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً',
  timeline_reception: '08:00 م',
  timeline_ardah: '09:30 م',
  timeline_dinner: '10:30 م',
  iban: 'SA0380000000608010167519',
  bank_name: 'مصرف الراجحي',
  gate_pin: '2026',
  owner_id: null,
  created_at: new Date().toISOString(),
};

interface DatabaseStore {
  events: Map<string, WeddingEvent>;
  parties: Map<string, Party>;
  entryPasses: Map<string, EntryPass>;
  groupLinks: Map<string, GroupInviteLink>; // slug -> GroupInviteLink
  wishes: Wish[];
  moments: EventMoment[];
  checkInLogs: CheckInLog[];
  tokenToPartyMap: Map<string, string>; // rawInvitationToken -> partyId
  rawPassTokenMap: Map<string, string>; // rawPassToken -> partyId
}

declare global {
  var __weddingpass_db: DatabaseStore | undefined;
}

function getDatabaseStore(): DatabaseStore {
  if (!globalThis.__weddingpass_db) {
    globalThis.__weddingpass_db = {
      events: new Map([[INITIAL_EVENT.id, INITIAL_EVENT]]),
      parties: new Map(),
      entryPasses: new Map(),
      groupLinks: new Map(),
      wishes: [],
      moments: [],
      checkInLogs: [],
      tokenToPartyMap: new Map(),
      rawPassTokenMap: new Map(),
    };

    seedDemoData(globalThis.__weddingpass_db);
  }
  return globalThis.__weddingpass_db;
}

function seedDemoData(db: DatabaseStore) {
  // 1. Seed Demo Smart Group Links
  const demoGroups: GroupInviteLink[] = [
    {
      id: 'group_colleagues',
      event_id: DEFAULT_EVENT_ID,
      host_name: 'العريس',
      group_name: 'قروب زملاء العمل 💼',
      slug: 'colleagues',
      limit_mode: 'warning',
      max_capacity: 30,
      confirmed_count: 14,
      max_seats_per_guest: 2,
      section: 'men',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'group_family_youth',
      event_id: DEFAULT_EVENT_ID,
      host_name: 'العريس',
      group_name: 'قروب شباب العائلة 👥',
      slug: 'family',
      limit_mode: 'unlimited',
      max_capacity: null,
      confirmed_count: 22,
      max_seats_per_guest: 2,
      section: 'men',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'group_father_elders',
      event_id: DEFAULT_EVENT_ID,
      host_name: 'والد العريس',
      group_name: 'قروب وجهاء وأعيان القبيلة 👑',
      slug: 'elders',
      limit_mode: 'warning',
      max_capacity: 40,
      confirmed_count: 28,
      max_seats_per_guest: 2,
      section: 'men',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'group_friends',
      event_id: DEFAULT_EVENT_ID,
      host_name: 'العريس',
      group_name: 'قروب الأصدقاء المقربين ✨',
      slug: 'friends',
      limit_mode: 'strict',
      max_capacity: 15,
      confirmed_count: 12,
      max_seats_per_guest: 1,
      section: 'vip',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];

  demoGroups.forEach((g) => db.groupLinks.set(g.slug, g));

  // 2. Seed Initial Wishes (Guestbook)
  db.wishes = [
    {
      id: 'wish_1',
      event_id: DEFAULT_EVENT_ID,
      sender_name: 'د. خالد بن سلطان السبيعي',
      message: 'ألف ألف مبروك يا بو فهد، بارك الله لكما وبارك عليكما وجمع بينكما في خير وسعادة دائمة.',
      is_approved: true,
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: 'wish_2',
      event_id: DEFAULT_EVENT_ID,
      sender_name: 'أحمد محمد العتيبي',
      message: 'نسأل الله لكم حياة عامرة بالمودة والرحمة والذرية الصالحة، متشوقين لحضور ليلتكم المباركة.',
      is_approved: true,
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'wish_3',
      event_id: DEFAULT_EVENT_ID,
      sender_name: 'سارة بنت إبراهيم الراجحي',
      message: 'بارك الله للعروسين وأتم فرحتكم على خير وعافية 🌹',
      is_approved: true,
      created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    },
  ];

  // 3. Seed Initial Moments (Men's Section Photos)
  db.moments = [
    {
      id: 'moment_1',
      event_id: DEFAULT_EVENT_ID,
      uploader_name: 'فهد العتيبي',
      uploader_phone: '0501234567',
      media_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
      caption: 'فرحة العريس سلمان بارك الله لهما 🗡️✨',
      section: 'men',
      is_approved: true,
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'moment_2',
      event_id: DEFAULT_EVENT_ID,
      uploader_name: 'سلطان القحطاني',
      uploader_phone: '0555555555',
      media_url: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=800&auto=format&fit=crop&q=80',
      caption: 'استقبال وجهاء القبيلة في القاعة الكبرى 🇸🇦',
      section: 'men',
      is_approved: true,
      created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    },
  ];

  // 4. Seed Demo Individual Parties with Hosts, Tables & Wheelchair flags
  const demoSeed = [
    { name: 'أحمد محمد العتيبي (عائلة)', phone: '966501234567', allowed: 4, confirmed: 3, rsvp: 'confirmed' as RSVPStatus, section: 'men', host: 'العريس', table: 'طاولة 3', wheelchair: false, group: 'دعوة خاصة' },
    { name: 'الشيخ سلطان بن مطلق السبيعي', phone: '966551239876', allowed: 2, confirmed: 2, rsvp: 'confirmed' as RSVPStatus, section: 'vip', host: 'والد العريس', table: 'طاولة كبار الشخصيات VIP', wheelchair: true, group: 'دعوة خاصة' },
    { name: 'أم راشد الشمري الكريمة', phone: '966567891234', allowed: 3, confirmed: 3, rsvp: 'confirmed' as RSVPStatus, section: 'women', host: 'قسم النساء', table: 'طاولة 12 (نساء)', wheelchair: false, group: 'دعوة خاصة' },
    { name: 'المهندس طارق القحطاني', phone: '966543216789', allowed: 2, confirmed: 0, rsvp: 'declined' as RSVPStatus, section: 'men', host: 'العريس', table: null, wheelchair: false, group: 'قروب زملاء العمل 💼' },
    { name: 'عبدالعزيز بن فهد التميمي', phone: '966509876543', allowed: 5, confirmed: 0, rsvp: 'viewed' as RSVPStatus, section: 'men', host: 'العريس', table: null, wheelchair: false, group: 'قروب شباب العائلة 👥' },
    { name: 'عائلة الدوسري الكريمة', phone: '966531122334', allowed: 4, confirmed: 0, rsvp: 'unopened' as RSVPStatus, section: 'women', host: 'والد العروس', table: 'طاولة 8', wheelchair: false, group: 'دعوة خاصة' },
    { name: 'فيصل بن عبدالله الشهري', phone: '966548899001', allowed: 2, confirmed: 2, rsvp: 'confirmed' as RSVPStatus, section: 'men', host: 'العريس', table: 'طاولة 5', wheelchair: false, group: 'قروب زملاء العمل 💼' },
    { name: 'سارة بنت إبراهيم الراجحي', phone: '966599887766', allowed: 1, confirmed: 1, rsvp: 'confirmed' as RSVPStatus, section: 'women', host: 'قسم النساء', table: 'طاولة 14 (نساء)', wheelchair: false, group: 'دعوة خاصة' },
    { name: 'اللواء م. ناصر بن عائض القحطاني', phone: '966505554433', allowed: 2, confirmed: 2, rsvp: 'confirmed' as RSVPStatus, section: 'vip', host: 'والد العريس', table: 'طاولة كبار الشخصيات VIP', wheelchair: false, group: 'قروب وجهاء وأعيان القبيلة 👑' },
  ];

  demoSeed.forEach((item, idx) => {
    const rawInvToken = `wp_inv_demo_${idx + 1}_${item.name.slice(0, 3)}`;
    const invHash = `hash_inv_${idx + 1}`;
    const partyId = `party_demo_${idx + 1}`;

    const party: Party = {
      id: partyId,
      event_id: DEFAULT_EVENT_ID,
      host_name: item.host,
      group_name: item.group,
      party_name: item.name,
      primary_phone: item.phone,
      allowed_count: item.allowed,
      confirmed_count: item.confirmed,
      actual_checked_in_count: 0,
      table_number: item.table,
      needs_wheelchair: item.wheelchair,
      invitation_token_hash: invHash,
      raw_invitation_token: rawInvToken,
      dispatch_status: item.rsvp !== 'unopened' ? 'sent' : 'draft',
      rsvp_status: item.rsvp,
      rsvp_at: item.rsvp === 'confirmed' ? new Date().toISOString() : null,
      section: item.section,
      notes: idx === 0 ? 'يرجى تجهيز مقعد مريح' : null,
      created_at: new Date(Date.now() - (10 - idx) * 3600000).toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.parties.set(partyId, party);
    db.tokenToPartyMap.set(rawInvToken, partyId);

    if (item.rsvp === 'confirmed') {
      const rawPassToken = `wp_pass_demo_${idx + 1}`;
      const passHash = `hash_pass_${idx + 1}`;
      const entryPass: EntryPass = {
        id: `pass_demo_${idx + 1}`,
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
    }
  });
}

// ------------------------------------------------------------------------------
// Service Functions (Repository Pattern)
// ------------------------------------------------------------------------------

export async function getDefaultEvent(): Promise<WeddingEvent> {
  const db = getDatabaseStore();
  return Array.from(db.events.values())[0];
}

export async function getPartyByInvitationToken(rawToken: string): Promise<{ party: Party; event: WeddingEvent; entryPass?: EntryPass } | null> {
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

export async function submitPartyRSVP(
  partyId: string,
  status: 'confirmed' | 'declined',
  attendingCount: number,
  notes?: string,
  needsWheelchair?: boolean
): Promise<{ success: boolean; entryPass?: EntryPass; message: string }> {
  const db = getDatabaseStore();
  const party = db.parties.get(partyId);
  if (!party) {
    return { success: false, message: 'لم يتم العثور على الدعوة' };
  }

  const previousStatus = party.rsvp_status;
  const previousConfirmed = party.confirmed_count;

  party.rsvp_status = status;
  party.rsvp_at = new Date().toISOString();
  party.updated_at = new Date().toISOString();
  if (needsWheelchair !== undefined) {
    party.needs_wheelchair = needsWheelchair;
  }

  if (notes !== undefined) {
    party.notes = notes;
    if (notes && notes.trim().length > 3) {
      await addWish(party.event_id, party.party_name, notes.trim(), party.id, true);
    }
  }

  if (status === 'confirmed') {
    party.confirmed_count = Math.min(Math.max(1, attendingCount), party.allowed_count);
    
    let pass = db.entryPasses.get(partyId);
    if (!pass || pass.status === 'revoked') {
      const rawPassToken = generateEntryPassToken();
      const passHash = await hashToken(rawPassToken);
      pass = {
        id: `pass_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
    return { success: true, entryPass: pass, message: 'تم تأكيد حضورك بنجاح' };
  } else {
    // Safe decrement of group quota if previously confirmed
    if (party.group_link_id && previousStatus === 'confirmed' && previousConfirmed > 0) {
      for (const grp of Array.from(db.groupLinks.values())) {
        if (grp.id === party.group_link_id) {
          grp.confirmed_count = Math.max(0, grp.confirmed_count - previousConfirmed);
          break;
        }
      }
    }
    party.confirmed_count = 0;
    return { success: true, message: 'تم تسجيل اعتذارك شاكرين لك تواصلك ومشاعركم الطيبة' };
  }
}

// ------------------------------------------------------------------------------
// Live Moments / Shared Album Engine
// ------------------------------------------------------------------------------

export async function addMoment(
  eventId: string,
  uploaderName: string,
  mediaUrl: string,
  caption?: string | null,
  section: string = 'men',
  uploaderPhone?: string | null
): Promise<EventMoment> {
  const db = getDatabaseStore();
  const moment: EventMoment = {
    id: `moment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    event_id: eventId,
    uploader_name: uploaderName.trim() || 'ضيف كريم',
    uploader_phone: uploaderPhone ? normalizeSaudiPhone(uploaderPhone) : null,
    media_url: mediaUrl,
    caption: caption ? caption.trim() : null,
    section: section || 'men',
    is_approved: false, // Quarantined until organizer approves
    created_at: new Date().toISOString(),
  };

  db.moments.unshift(moment);
  return moment;
}

export async function getMoments(eventId: string, approvedOnly: boolean = false): Promise<EventMoment[]> {
  const db = getDatabaseStore();
  return db.moments.filter((m) => m.event_id === eventId && (!approvedOnly || m.is_approved));
}

export async function toggleMomentApproval(momentId: string, isApproved: boolean): Promise<boolean> {
  const db = getDatabaseStore();
  const moment = db.moments.find((m) => m.id === momentId);
  if (moment) {
    moment.is_approved = isApproved;
    return true;
  }
  return false;
}

export async function deleteMoment(momentId: string): Promise<boolean> {
  const db = getDatabaseStore();
  const idx = db.moments.findIndex((m) => m.id === momentId);
  if (idx !== -1) {
    db.moments.splice(idx, 1);
    return true;
  }
  return false;
}

// ------------------------------------------------------------------------------
// Wishes & Guestbook Engine
// ------------------------------------------------------------------------------

export async function addWish(
  eventId: string,
  senderName: string,
  message: string,
  partyId?: string | null,
  isApproved: boolean = true
): Promise<Wish> {
  const db = getDatabaseStore();
  const newWish: Wish = {
    id: `wish_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    event_id: eventId,
    party_id: partyId || null,
    sender_name: senderName.trim(),
    message: message.trim(),
    is_approved: isApproved,
    created_at: new Date().toISOString(),
  };

  db.wishes.unshift(newWish);
  return newWish;
}

export async function getWishes(eventId: string, approvedOnly: boolean = false): Promise<Wish[]> {
  const db = getDatabaseStore();
  return db.wishes.filter((w) => w.event_id === eventId && (!approvedOnly || w.is_approved));
}

export async function toggleWishApproval(wishId: string, isApproved: boolean): Promise<boolean> {
  const db = getDatabaseStore();
  const wish = db.wishes.find((w) => w.id === wishId);
  if (wish) {
    wish.is_approved = isApproved;
    return true;
  }
  return false;
}

// ------------------------------------------------------------------------------
// Smart Group Links
// ------------------------------------------------------------------------------

export async function getAllGroupLinks(eventId: string): Promise<GroupInviteLink[]> {
  const db = getDatabaseStore();
  return Array.from(db.groupLinks.values()).filter((g) => g.event_id === eventId);
}

export async function getGroupLinkBySlug(slug: string): Promise<{ group: GroupInviteLink; event: WeddingEvent } | null> {
  const db = getDatabaseStore();
  const group = db.groupLinks.get(slug.trim().toLowerCase());
  if (!group || !group.is_active) return null;

  const event = db.events.get(group.event_id) || INITIAL_EVENT;
  return { group, event };
}

export async function createGroupLink(
  eventId: string,
  groupName: string,
  slug: string,
  hostName: HostRole = 'العريس',
  limitMode: GroupLimitMode = 'warning',
  maxCapacity?: number | null,
  maxSeatsPerGuest: number = 2,
  section: string = 'men'
): Promise<GroupInviteLink> {
  const db = getDatabaseStore();
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');

  const newGroup: GroupInviteLink = {
    id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    event_id: eventId,
    host_name: hostName || 'العريس',
    group_name: groupName.trim(),
    slug: cleanSlug,
    limit_mode: limitMode,
    max_capacity: limitMode === 'unlimited' ? null : maxCapacity || 30,
    confirmed_count: 0,
    max_seats_per_guest: maxSeatsPerGuest || 2,
    section: section || 'men',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  db.groupLinks.set(cleanSlug, newGroup);
  return newGroup;
}

export async function registerGroupGuest(
  slug: string,
  guestName: string,
  guestPhone: string,
  seatsCount: number = 1,
  notes?: string
): Promise<{ success: boolean; code: string; message: string; party?: Party; entryPass?: EntryPass }> {
  const db = getDatabaseStore();
  const groupData = await getGroupLinkBySlug(slug);
  if (!groupData) {
    return { success: false, code: 'NOT_FOUND', message: 'رابط المجموعة غير صالح أو تم إيقافه' };
  }
  const { group, event } = groupData;
  const normalizedPhone = normalizeSaudiPhone(guestPhone);
  const seats = Math.max(1, seatsCount);

  if (seats > group.max_seats_per_guest) {
    return {
      success: false,
      code: 'QUOTA_EXCEEDED',
      message: `الحد الأقصى المسموح به هو ${group.max_seats_per_guest} مقاعد لكل ضيف في هذه المجموعة`,
    };
  }

  if (normalizedPhone) {
    for (const p of Array.from(db.parties.values())) {
      if (p.event_id === event.id && p.primary_phone === normalizedPhone) {
        let pass = db.entryPasses.get(p.id);
        if (!pass) {
          const rawPassToken = generateEntryPassToken();
          const passHash = await hashToken(rawPassToken);
          pass = {
            id: `pass_${Date.now()}`,
            party_id: p.id,
            pass_token_hash: passHash,
            raw_pass_token: rawPassToken,
            status: 'active',
            is_checked_in: false,
            men_checked_in: 0,
            women_checked_in: 0,
            created_at: new Date().toISOString(),
          };
          db.entryPasses.set(p.id, pass);
          db.rawPassTokenMap.set(rawPassToken, p.id);
        }

        if (notes && notes.trim().length > 3) {
          await addWish(event.id, p.party_name, notes.trim(), p.id, true);
        }

        return {
          success: true,
          code: 'ALREADY_REGISTERED',
          message: `أهلاً بك مجدداً يا ${p.party_name}! لقد تم تأكيد حضورك مسبقاً، بطاقة دخولك جاهزة.`,
          party: p,
          entryPass: pass,
        };
      }
    }
  }

  if (group.limit_mode === 'strict' && group.max_capacity) {
    if (group.confirmed_count + seats > group.max_capacity) {
      const remaining = Math.max(0, group.max_capacity - group.confirmed_count);
      return {
        success: false,
        code: 'QUOTA_EXCEEDED',
        message: remaining === 0
          ? 'عذراً، اكتملت جميع المقاعد المخصصة لهذه المجموعة 🌹'
          : `عذراً، المتبقي ${remaining} مقعد فقط لهذه المجموعة`,
      };
    }
  }

  // Atomically reserve quota upfront before async yields
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
    primary_phone: normalizedPhone || null,
    allowed_count: seats,
    confirmed_count: seats,
    actual_checked_in_count: 0,
    table_number: null,
    needs_wheelchair: false,
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
    id: `pass_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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

  if (notes && notes.trim().length > 3) {
    await addWish(event.id, guestName.trim(), notes.trim(), partyId, true);
  }

  return {
    success: true,
    code: 'SUCCESS',
    message: 'تم تأكيد حضورك بنجاح! بطاقة الدخول الخاصة بك جاهزة.',
    party: newParty,
    entryPass,
  };
}

export async function recoverGuestPassByPhone(eventId: string, rawPhone: string): Promise<{ success: boolean; party?: Party; entryPass?: EntryPass; message: string }> {
  const db = getDatabaseStore();
  const normalized = normalizeSaudiPhone(rawPhone);
  if (!normalized) {
    return { success: false, message: 'يرجى إدخال رقم جوال صحيح' };
  }

  for (const p of Array.from(db.parties.values())) {
    if (p.event_id === eventId && p.primary_phone === normalized) {
      let pass = db.entryPasses.get(p.id);
      if (!pass) {
        const rawPassToken = generateEntryPassToken();
        const passHash = await hashToken(rawPassToken);
        pass = {
          id: `pass_${Date.now()}`,
          party_id: p.id,
          pass_token_hash: passHash,
          raw_pass_token: rawPassToken,
          status: 'active',
          is_checked_in: false,
          men_checked_in: 0,
          women_checked_in: 0,
          created_at: new Date().toISOString(),
        };
        db.entryPasses.set(p.id, pass);
        db.rawPassTokenMap.set(rawPassToken, p.id);
      }

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

export async function updatePartyTableNumber(partyId: string, tableNumber?: string | null): Promise<boolean> {
  const db = getDatabaseStore();
  const party = db.parties.get(partyId);
  if (party) {
    party.table_number = tableNumber ? tableNumber.trim() : null;
    party.updated_at = new Date().toISOString();
    return true;
  }
  return false;
}

export async function getActivePassesForOfflineCache(eventId: string) {
  const db = getDatabaseStore();
  const parties = Array.from(db.parties.values()).filter((p) => p.event_id === eventId);
  const cacheList = [];

  for (const party of parties) {
    const pass = db.entryPasses.get(party.id);
    if (pass && pass.status === 'active') {
      cacheList.push({
        partyId: party.id,
        partyName: party.party_name,
        passTokenHash: pass.pass_token_hash,
        rawPassToken: pass.raw_pass_token,
        confirmedCount: party.confirmed_count || party.allowed_count,
        section: party.section,
        tableNumber: party.table_number || null,
        hostName: party.host_name || 'العريس',
        needsWheelchair: party.needs_wheelchair || false,
        isCheckedIn: pass.is_checked_in,
      });
    }
  }

  return cacheList;
}

// ------------------------------------------------------------------------------
// Gate Check-In with VIP & Wheelchair Detection
// ------------------------------------------------------------------------------

export async function executeCheckIn(
  eventId: string,
  rawPassToken: string,
  stationName: string,
  operatorName: string,
  checkinType: 'QR_SCAN' | 'MANUAL_SEARCH' = 'QR_SCAN',
  overrideCount?: number,
  gateSection: 'men' | 'women' | 'general' = 'men',
  forceAdmitCrossSection: boolean = false
): Promise<CheckInRPCResponse> {
  // 1. Production Execution via Supabase PostgreSQL Atomic RPC
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const trimmed = rawPassToken.trim();
      const passTokenHash = await hashToken(trimmed);
      const { data, error } = await supabaseAdmin.rpc('process_secure_checkin', {
        p_event_id: eventId,
        p_pass_token_hash: passTokenHash,
        p_station_name: stationName,
        p_operator_name: operatorName,
        p_checkin_type: checkinType,
        p_override_count: overrideCount || null,
        p_gate_section: gateSection,
        p_force_cross_section: forceAdmitCrossSection,
      });

      if (!error && data) {
        return data as CheckInRPCResponse;
      }
    } catch (err) {
      console.warn('Supabase checkin RPC fallback:', err);
    }
  }

  // 2. In-Memory Store Execution (Local Dev & Unit Tests)
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
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      event_id: eventId,
      scanned_token_hash: passTokenHash,
      station_name: stationName,
      operator_name: operatorName,
      checkin_type: checkinType,
      scan_result: 'NOT_FOUND',
      admitted_count: 0,
      created_at: new Date().toISOString(),
    });

    return {
      success: false,
      code: 'NOT_FOUND',
      message: 'رمز بطاقة الدخول غير مسجل في النظام',
    };
  }

  const party = db.parties.get(partyId);
  if (!party || party.event_id !== eventId) {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: 'هذه البطاقة غير تابعة لهذا الحفل',
    };
  }

  if (pass.status === 'revoked') {
    db.checkInLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      event_id: eventId,
      party_id: party.id,
      entry_pass_id: pass.id,
      scanned_token_hash: passTokenHash,
      station_name: stationName,
      operator_name: operatorName,
      checkin_type: checkinType,
      scan_result: 'REVOKED',
      admitted_count: 0,
      table_number: party.table_number,
      created_at: new Date().toISOString(),
    });

    return {
      success: false,
      code: 'REVOKED',
      party_name: party.party_name,
      message: 'تم إلغاء صلاحية هذه البطاقة مسبقاً من قِبل المنظم',
    };
  }

  // Cross-Section Warning Check
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
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      event_id: eventId,
      party_id: party.id,
      entry_pass_id: pass.id,
      scanned_token_hash: passTokenHash,
      station_name: stationName,
      operator_name: operatorName,
      checkin_type: checkinType,
      scan_result: 'ALREADY_CHECKED_IN',
      admitted_count: 0,
      table_number: party.table_number,
      created_at: new Date().toISOString(),
    });

    return {
      success: false,
      code: 'ALREADY_CHECKED_IN',
      party_name: party.party_name,
      table_number: party.table_number,
      first_check_in_at: pass.first_check_in_at || undefined,
      message: 'تم استخدام بطاقة الدخول هذه مسبقاً!',
    };
  }

  const finalCount = overrideCount && overrideCount > 0 ? overrideCount : (party.confirmed_count || 1);
  const isVip = Boolean(party.section === 'vip' || party.host_name === 'والد العروس' || (party.table_number && party.table_number.includes('VIP')));

  pass.is_checked_in = true;
  pass.first_check_in_at = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  party.actual_checked_in_count = finalCount;
  party.updated_at = new Date().toISOString();

  db.checkInLogs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    event_id: eventId,
    party_id: party.id,
    entry_pass_id: pass.id,
    scanned_token_hash: passTokenHash,
    station_name: stationName,
    operator_name: operatorName,
    checkin_type: checkinType,
    scan_result: 'SUCCESS',
    admitted_count: finalCount,
    table_number: party.table_number,
    created_at: new Date().toISOString(),
  });

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
    message: party.table_number
      ? `تم التحقق بنجاح • ${party.table_number}`
      : 'تم التحقق بنجاح • أهلاً وسهلاً بكم!',
  };
}

export async function getAllParties(eventId: string): Promise<Party[]> {
  const db = getDatabaseStore();
  return Array.from(db.parties.values()).filter((p) => p.event_id === eventId);
}

export async function bulkAddParties(
  eventId: string,
  rawGuests: Array<{ party_name: string; primary_phone?: string; allowed_count?: number; section?: string; host_name?: string; table_number?: string; wheelchair?: boolean; notes?: string }>
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

export async function updatePartyDispatch(partyId: string, status: DispatchStatus): Promise<void> {
  const db = getDatabaseStore();
  const party = db.parties.get(partyId);
  if (party) {
    party.dispatch_status = status;
    party.updated_at = new Date().toISOString();
  }
}

export async function revokePass(partyId: string): Promise<boolean> {
  const db = getDatabaseStore();
  const pass = db.entryPasses.get(partyId);
  if (pass) {
    pass.status = 'revoked';
    pass.revoked_at = new Date().toISOString();
    return true;
  }
  return false;
}

export async function regeneratePass(partyId: string): Promise<EntryPass | null> {
  const db = getDatabaseStore();
  const party = db.parties.get(partyId);
  if (!party) return null;

  const rawPassToken = generateEntryPassToken();
  const passHash = await hashToken(rawPassToken);

  const newPass: EntryPass = {
    id: `pass_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    party_id: partyId,
    pass_token_hash: passHash,
    raw_pass_token: rawPassToken,
    status: 'active',
    is_checked_in: false,
    men_checked_in: 0,
    women_checked_in: 0,
    created_at: new Date().toISOString(),
  };

  db.entryPasses.set(partyId, newPass);
  db.rawPassTokenMap.set(rawPassToken, partyId);
  return newPass;
}

export async function getEventStats(eventId: string) {
  const db = getDatabaseStore();
  const parties = Array.from(db.parties.values()).filter((p) => p.event_id === eventId);
  const passes = Array.from(db.entryPasses.values());

  const totalParties = parties.length;
  const maxPotentialGuests = parties.reduce((acc, p) => acc + p.allowed_count, 0);
  const confirmedParties = parties.filter((p) => p.rsvp_status === 'confirmed').length;
  const expectedGuests = parties.filter((p) => p.rsvp_status === 'confirmed').reduce((acc, p) => acc + p.confirmed_count, 0);
  const declinedParties = parties.filter((p) => p.rsvp_status === 'declined').length;
  const unopenedParties = parties.filter((p) => p.rsvp_status === 'unopened').length;
  const viewedParties = parties.filter((p) => p.rsvp_status === 'viewed').length;

  const usedPasses = passes.filter((p) => p.is_checked_in).length;
  const totalAdmittedIndividuals = parties.reduce((acc, p) => acc + (p.actual_checked_in_count || 0), 0);

  const hosts = ['العريس', 'والد العريس', 'والد العروس', 'قسم النساء'];
  const hostStats = hosts.map((h) => {
    const hostParties = parties.filter((p) => (p.host_name || 'العريس') === h);
    const hostConfirmed = hostParties.filter((p) => p.rsvp_status === 'confirmed').reduce((acc, p) => acc + p.confirmed_count, 0);
    const hostAdmitted = hostParties.reduce((acc, p) => acc + (p.actual_checked_in_count || 0), 0);
    return {
      hostName: h,
      totalInvites: hostParties.length,
      confirmedGuests: hostConfirmed,
      admittedGuests: hostAdmitted,
    };
  });

  return {
    totalParties,
    maxPotentialGuests,
    confirmedParties,
    expectedGuests,
    declinedParties,
    unopenedParties,
    viewedParties,
    usedPasses,
    totalAdmittedIndividuals,
    attendanceRate: expectedGuests > 0 ? Math.round((totalAdmittedIndividuals / expectedGuests) * 100) : 0,
    hostStats,
  };
}

export async function getCheckInLogs(eventId: string): Promise<CheckInLog[]> {
  const db = getDatabaseStore();
  return db.checkInLogs.filter((log) => log.event_id === eventId);
}

export async function updateEventSettings(eventId: string, updates: Partial<WeddingEvent>): Promise<WeddingEvent | null> {
  const db = getDatabaseStore();
  const event = db.events.get(eventId);
  if (!event) return null;

  const updated: WeddingEvent = {
    ...event,
    ...updates,
  };
  db.events.set(eventId, updated);
  return updated;
}

export async function searchParties(eventId: string, query: string): Promise<Party[]> {
  const db = getDatabaseStore();
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return Array.from(db.parties.values()).filter((p) => {
    if (p.event_id !== eventId) return false;
    const nameMatch = p.party_name.toLowerCase().includes(q);
    const phoneMatch = p.primary_phone?.includes(q) || false;
    const notesMatch = p.notes?.toLowerCase().includes(q) || false;
    const groupMatch = p.group_name?.toLowerCase().includes(q) || false;
    const tableMatch = p.table_number?.toLowerCase().includes(q) || false;
    return nameMatch || phoneMatch || notesMatch || groupMatch || tableMatch;
  });
}
