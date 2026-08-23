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
import { supabaseAdmin, isSupabaseConfigured } from '../../db/supabase.ts';
import { generateInvitationToken, generateEntryPassToken, hashToken } from '../../crypto/tokens.ts';
import { normalizeSaudiPhone } from '../../utils/phone.ts';

const FALLBACK_EVENT: WeddingEvent = {
  id: 'a0000000-0000-0000-0000-000000000001',
  slug: 'royal-wedding-2026',
  groom_name: 'سلمان بن فهد العتيبي',
  bride_name: 'نورية بنت عبدالله آل سعود',
  event_date: '2026-10-24',
  event_time: '20:00:00',
  venue_name: 'قاعة فندق الريتز كارلتون - الرياض',
  venue_address: 'طريق مكة المكرمة، الهدا، الرياض',
  venue_maps_url: 'https://maps.google.com/?q=Ritz+Carlton+Riyadh',
  welcome_verse: 'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً',
  theme_id: 'classic_gold',
  rsvp_mode: 'count',
  gate_pin: '2026',
  timeline_reception: '08:00 م',
  timeline_ardah: '09:30 م',
  timeline_dinner: '10:30 م',
  created_at: new Date().toISOString(),
};

function getAdminClient() {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    throw new Error('FATAL SECURITY ERROR: Supabase database is not configured. Operation aborted in production.');
  }
  return supabaseAdmin;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function throwInProduction(message: string, cause?: unknown): void {
  if (!isProduction()) return;
  const detail = cause instanceof Error ? `: ${cause.message}` : '';
  throw new Error(`${message}${detail}`);
}

export class SupabaseRepository implements
  IEventRepository,
  IPartyRepository,
  IGroupLinkRepository,
  ICheckInRepository,
  IWishRepository,
  IMomentRepository,
  IEventStatsRepository
{
  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------
  async getDefaultEvent(): Promise<WeddingEvent> {
    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase.from('events').select('*').limit(1);
      if (!error && data && data.length > 0) {
        return data[0] as WeddingEvent;
      }
      if (isProduction()) {
        throw new Error('Database Error: no event is configured. Apply migrations and create an event before serving traffic.');
      }

      // Local development convenience only; production data is seeded by an
      // explicit migration or deployment process.
      const { data: seeded } = await supabase
        .from('events')
        .upsert(FALLBACK_EVENT)
        .select()
        .maybeSingle();

      if (seeded) return seeded as WeddingEvent;
      throw new Error('Database Error: failed to seed local fallback event.');
    } catch (e) {
      throwInProduction('Database Error: failed to load the default event', e);
      console.warn('getDefaultEvent development fallback:', e);
      return FALLBACK_EVENT;
    }
  }

  async updateEventSettings(eventId: string, eventData: Partial<WeddingEvent>): Promise<WeddingEvent | null> {
    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', eventId)
        .select()
        .maybeSingle();

      if (error || !data) {
        if (isProduction()) {
          throw new Error(`Database Error: updateEventSettings failed: ${error?.message || 'event not found'}`);
        }
        // Fallback update in case of missing row
        const { data: upserted } = await supabase
          .from('events')
          .upsert({ ...FALLBACK_EVENT, ...eventData, id: eventId })
          .select()
          .maybeSingle();
        return (upserted || { ...FALLBACK_EVENT, ...eventData }) as WeddingEvent;
      }
      return data as WeddingEvent;
    } catch (err: any) {
      throwInProduction('Database Error: updateEventSettings failed', err);
      console.warn('updateEventSettings warning:', err.message);
      return { ...FALLBACK_EVENT, ...eventData } as WeddingEvent;
    }
  }

  // --------------------------------------------------------------------------
  // Parties & RSVP
  // --------------------------------------------------------------------------
  async getPartyByInvitationToken(rawToken: string): Promise<{ party: Party; event: WeddingEvent; entryPass?: EntryPass } | null> {
    const supabase = getAdminClient();
    const trimmed = rawToken.trim();
    const tokenHash = await hashToken(trimmed);

    const { data: party, error } = await supabase
      .from('parties')
      .select('*, entry_passes(*), events(*)')
      .eq('invitation_token_hash', tokenHash)
      .maybeSingle();

    if (error || !party) return null;

    if (party.rsvp_status === 'unopened') {
      await supabase.from('parties').update({ rsvp_status: 'viewed', updated_at: new Date().toISOString() }).eq('id', party.id);
      party.rsvp_status = 'viewed';
    }

    const event = (party.events as any) || (await this.getDefaultEvent());
    const entryPass = Array.isArray(party.entry_passes) ? party.entry_passes[0] : party.entry_passes;
    return { party: party as Party, event: event as WeddingEvent, entryPass };
  }

  async submitPartyRSVP(
    partyId: string,
    status: 'confirmed' | 'declined',
    attendingCount: number,
    notes?: string,
    needsWheelchair?: boolean
  ): Promise<{ success: boolean; entryPass?: EntryPass; message: string }> {
    const supabase = getAdminClient();

    let rawPassToken: string | undefined;
    let passHash: string | undefined;

    if (status === 'confirmed') {
      rawPassToken = generateEntryPassToken();
      passHash = await hashToken(rawPassToken);
    }

    // Call Atomic RPC Transaction
    const { data, error } = await supabase.rpc('submit_party_rsvp_atomic', {
      p_party_id: partyId,
      p_status: status,
      p_attending_count: attendingCount,
      p_notes: notes || null,
      p_needs_wheelchair: needsWheelchair ?? null,
      p_raw_pass_token: rawPassToken || null,
      p_pass_hash: passHash || null,
    });

    if (error) {
      throw new Error(`Database Error: submit_party_rsvp_atomic failed: ${error.message}`);
    }

    let pass: EntryPass | undefined;
    if (status === 'confirmed') {
      const { data: passData } = await supabase.from('entry_passes').select('*').eq('party_id', partyId).single();
      if (passData) {
        pass = { ...passData, raw_pass_token: rawPassToken };
      }
    }

    return {
      success: data.success,
      entryPass: pass,
      message: data.message || 'تم تحديث حالة الحضور بنجاح',
    };
  }

  async getAllParties(eventId: string): Promise<Party[]> {
    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase
        .from('parties')
        .select('*, entry_passes(*)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) {
        throwInProduction('Database Error: getAllParties failed', error);
        console.warn('getAllParties query warning:', error.message);
        return [];
      }
      return (data || []) as Party[];
    } catch (err) {
      throwInProduction('Database Error: getAllParties failed', err);
      console.warn('getAllParties exception:', err);
      return [];
    }
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
    const supabase = getAdminClient();
    const insertPayload: any[] = [];
    const generatedParties: Party[] = [];

    for (const raw of rawGuests) {
      const rawInvToken = generateInvitationToken();
      const invHash = await hashToken(rawInvToken);
      const partyId = crypto.randomUUID();
      const normalizedPhone = raw.primary_phone ? normalizeSaudiPhone(raw.primary_phone) : null;

      const partyRow = {
        id: partyId,
        event_id: eventId,
        host_name: (raw.host_name as HostRole) || 'العريس',
        party_name: raw.party_name.trim(),
        primary_phone: normalizedPhone,
        allowed_count: raw.allowed_count ? Math.max(1, Number(raw.allowed_count)) : 1,
        confirmed_count: 0,
        actual_checked_in_count: 0,
        table_number: raw.table_number ? raw.table_number.trim() : null,
        needs_wheelchair: Boolean(raw.wheelchair),
        is_vip: Boolean(raw.is_vip),
        invitation_token_hash: invHash,
        dispatch_status: 'draft',
        rsvp_status: 'unopened',
        section: raw.section || 'men',
        notes: raw.notes || null,
      };

      insertPayload.push(partyRow);
      generatedParties.push({
        ...partyRow,
        raw_invitation_token: rawInvToken,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Party);
    }

    if (insertPayload.length > 0) {
      const { error } = await supabase.from('parties').insert(insertPayload);
      if (error) throw new Error(`Database Error: bulkAddParties failed: ${error.message}`);
    }

    return { addedCount: generatedParties.length, parties: generatedParties };
  }

  async updatePartyDispatch(partyId: string, status: DispatchStatus): Promise<void> {
    const supabase = getAdminClient();
    const { error } = await supabase.from('parties').update({ dispatch_status: status, updated_at: new Date().toISOString() }).eq('id', partyId);
    if (error) throw new Error(`Database Error: updatePartyDispatch failed: ${error.message}`);
  }

  async updatePartyTableNumber(partyId: string, tableNumber?: string | null): Promise<boolean> {
    const supabase = getAdminClient();
    const { error } = await supabase.from('parties').update({ table_number: tableNumber ? tableNumber.trim() : null, updated_at: new Date().toISOString() }).eq('id', partyId);
    if (error) throw new Error(`Database Error: updatePartyTableNumber failed: ${error.message}`);
    return !error;
  }

  async recoverGuestPassByPhone(eventId: string, rawPhone: string): Promise<{ success: boolean; party?: Party; entryPass?: EntryPass; message: string }> {
    const supabase = getAdminClient();
    const normalized = normalizeSaudiPhone(rawPhone);
    if (!normalized) return { success: false, message: 'يرجى إدخال رقم جوال صحيح' };

    const { data: party, error } = await supabase
      .from('parties')
      .select('*, entry_passes(*)')
      .eq('event_id', eventId)
      .eq('primary_phone', normalized)
      .maybeSingle();

    if (error || !party) {
      return { success: false, message: 'لم يتم العثور على أي حجز مسجل بهذا الرقم في هذه المناسبة' };
    }

    let pass = Array.isArray(party.entry_passes) ? party.entry_passes[0] : party.entry_passes;
    return {
      success: true,
      party: party as Party,
      entryPass: pass,
      message: `تم العثور على بطاقة دخولك يا ${party.party_name}!`,
    };
  }

  async searchParties(eventId: string, query: string): Promise<Party[]> {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('parties')
      .select('*')
      .eq('event_id', eventId)
      .or(`party_name.ilike.%${query}%,primary_phone.ilike.%${query}%`)
      .limit(20);

    if (error) throw new Error(`Database Error: searchParties failed: ${error.message}`);
    return (data || []) as Party[];
  }

  // --------------------------------------------------------------------------
  // Group Links
  // --------------------------------------------------------------------------
  async getAllGroupLinks(eventId: string): Promise<GroupInviteLink[]> {
    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase.from('group_links').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
      if (error) {
        throwInProduction('Database Error: getAllGroupLinks failed', error);
        return [
          {
            id: 'g0000000-0000-0000-0000-000000000001',
            event_id: eventId,
            host_name: 'العريس',
            group_name: 'الأهل والأقارب',
            slug: 'family',
            limit_mode: 'strict',
            max_capacity: 50,
            confirmed_count: 0,
            max_seats_per_guest: 2,
            section: 'men',
            is_active: true,
            created_at: new Date().toISOString(),
          },
        ];
      }
      return (data || []) as GroupInviteLink[];
    } catch (err) {
      throwInProduction('Database Error: getAllGroupLinks failed', err);
      return [
        {
          id: 'g0000000-0000-0000-0000-000000000001',
          event_id: eventId,
          host_name: 'العريس',
          group_name: 'الأهل والأقارب',
          slug: 'family',
          limit_mode: 'strict',
          max_capacity: 50,
          confirmed_count: 0,
          max_seats_per_guest: 2,
          section: 'men',
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ];
    }
  }

  async getGroupLinkBySlug(slug: string): Promise<{ group: GroupInviteLink; event: WeddingEvent } | null> {
    const supabase = getAdminClient();
    const { data, error } = await supabase.from('group_links').select('*, events(*)').eq('slug', slug.trim()).eq('is_active', true).maybeSingle();
    if (error || !data) return null;
    const event = (data.events as any) || (await this.getDefaultEvent());
    return { group: data as GroupInviteLink, event: event as WeddingEvent };
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
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('group_links')
      .insert({
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
      })
      .select()
      .maybeSingle();

    if (error || !data) throw new Error(`Database Error: createGroupLink failed: ${error?.message}`);
    return data as GroupInviteLink;
  }

  async registerGroupGuest(
    slug: string,
    guestName: string,
    guestPhone: string,
    seatsCount: number,
    notes?: string
  ): Promise<{ success: boolean; code: string; message: string; party?: Party; entryPass?: EntryPass; remainingSeats?: number }> {
    const supabase = getAdminClient();
    const event = await this.getDefaultEvent();

    const normalizedPhone = normalizeSaudiPhone(guestPhone);
    if (!normalizedPhone) return { success: false, code: 'INVALID_PHONE', message: 'يرجى إدخال رقم جوال صحيح' };

    const rawInvToken = generateInvitationToken();
    const invHash = await hashToken(rawInvToken);
    const rawPassToken = generateEntryPassToken();
    const passHash = await hashToken(rawPassToken);
    const partyId = crypto.randomUUID();

    // Atomic Call to register_group_guest_atomic
    const { data, error } = await supabase.rpc('register_group_guest_atomic', {
      p_event_id: event.id,
      p_slug: slug.trim(),
      p_party_id: partyId,
      p_party_name: guestName.trim(),
      p_primary_phone: normalizedPhone,
      p_seats: seatsCount,
      p_invitation_hash: invHash,
      p_pass_hash: passHash,
      p_notes: notes || null,
    });

    if (error) throw new Error(`Database Error: register_group_guest_atomic failed: ${error.message}`);
    if (!data.success) {
      return {
        success: false,
        code: data.code || 'ERROR',
        message: data.message,
        remainingSeats: data.remaining,
      };
    }

    const { data: createdParty } = await supabase.from('parties').select('*').eq('id', partyId).single();
    const entryPass: EntryPass = {
      id: `pass_${partyId}`,
      party_id: partyId,
      pass_token_hash: passHash,
      raw_pass_token: rawPassToken,
      status: 'active',
      is_checked_in: false,
      men_checked_in: 0,
      women_checked_in: 0,
      created_at: new Date().toISOString(),
    };

    return {
      success: true,
      code: 'SUCCESS',
      message: data.message,
      party: createdParty ? { ...createdParty, raw_invitation_token: rawInvToken } : undefined,
      entryPass,
    };
  }

  // --------------------------------------------------------------------------
  // Check-In & Gate Operations
  // --------------------------------------------------------------------------
  async executeCheckIn(
    eventId: string,
    rawPassToken: string,
    stationName: string,
    operatorName: string,
    checkinType: 'QR_SCAN' | 'MANUAL_SEARCH' = 'QR_SCAN',
    overrideCount?: number,
    gateSection: 'men' | 'women' | 'general' = 'men',
    forceAdmitCrossSection: boolean = false
  ): Promise<CheckInRPCResponse> {
    const supabase = getAdminClient();
    const trimmed = rawPassToken.trim();
    const passTokenHash = await hashToken(trimmed);

    const { data, error } = await supabase.rpc('process_secure_checkin', {
      p_event_id: eventId,
      p_pass_token_hash: passTokenHash,
      p_station_name: stationName,
      p_operator_name: operatorName,
      p_checkin_type: checkinType,
      p_override_count: overrideCount || null,
      p_gate_section: gateSection,
      p_force_cross_section: forceAdmitCrossSection,
    });

    if (error) {
      throw new Error(`Database Error: process_secure_checkin RPC execution failed: ${error.message}`);
    }

    return data as CheckInRPCResponse;
  }

  async getCheckInLogs(eventId: string): Promise<CheckInLog[]> {
    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase
        .from('check_in_logs')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) {
        throwInProduction('Database Error: getCheckInLogs failed', error);
        return [];
      }
      return (data || []) as CheckInLog[];
    } catch (err) {
      throwInProduction('Database Error: getCheckInLogs failed', err);
      return [];
    }
  }

  async getActivePassesForOfflineCache(eventId: string): Promise<Array<{
    partyId: string;
    partyName: string;
    passTokenHash: string;
    confirmedCount: number;
    section: string;
    tableNumber: string | null;
    hostName: string;
    needsWheelchair: boolean;
    isCheckedIn: boolean;
    isVip?: boolean;
  }>> {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('parties')
      .select('id, party_name, table_number, confirmed_count, allowed_count, section, host_name, needs_wheelchair, is_vip, entry_passes(id, pass_token_hash, status, is_checked_in)')
      .eq('event_id', eventId);

    if (error) throw new Error(`Database Error: getActivePassesForOfflineCache failed: ${error.message}`);

    return (data || []).flatMap((p: any) => {
      const pass = Array.isArray(p.entry_passes) ? p.entry_passes[0] : p.entry_passes;
      if (pass && pass.status === 'active') {
        return [{
          partyId: p.id,
          partyName: p.party_name,
          passTokenHash: pass.pass_token_hash,
          confirmedCount: p.confirmed_count || p.allowed_count || 1,
          section: p.section || 'men',
          tableNumber: p.table_number || null,
          hostName: p.host_name || 'العريس',
          needsWheelchair: Boolean(p.needs_wheelchair),
          isCheckedIn: Boolean(pass.is_checked_in),
          isVip: Boolean(p.is_vip),
        }];
      }
      return [];
    });
  }

  async revokePass(partyId: string): Promise<boolean> {
    const supabase = getAdminClient();
    const { error } = await supabase
      .from('entry_passes')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('party_id', partyId);
    if (error) throw new Error(`Database Error: revokePass failed: ${error.message}`);
    return !error;
  }

  async regeneratePass(partyId: string): Promise<EntryPass | null> {
    const supabase = getAdminClient();
    const rawPassToken = generateEntryPassToken();
    const passHash = await hashToken(rawPassToken);

    const { data, error } = await supabase
      .from('entry_passes')
      .update({
        pass_token_hash: passHash,
        status: 'active',
        is_checked_in: false,
        first_check_in_at: null,
        revoked_at: null,
      })
      .eq('party_id', partyId)
      .select()
      .single();

    if (error || !data) throw new Error(`Database Error: regeneratePass failed: ${error?.message || 'pass not found'}`);
    return { ...data, raw_pass_token: rawPassToken } as EntryPass;
  }

  // --------------------------------------------------------------------------
  // Wishes & Moments
  // --------------------------------------------------------------------------
  async getWishes(eventId: string, onlyApproved: boolean = true): Promise<Wish[]> {
    try {
      const supabase = getAdminClient();
      let query = supabase.from('wishes').select('*').eq('event_id', eventId);
      if (onlyApproved) query = query.eq('is_approved', true);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        throwInProduction('Database Error: getWishes failed', error);
        return [];
      }
      return (data || []) as Wish[];
    } catch (err) {
      throwInProduction('Database Error: getWishes failed', err);
      return [];
    }
  }

  async addWish(eventId: string, partyName: string, message: string, partyId?: string, isApproved: boolean = true): Promise<Wish> {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('wishes')
      .insert({
        event_id: eventId,
        party_name: partyName.trim(),
        message: message.trim(),
        party_id: partyId || null,
        is_approved: isApproved,
      })
      .select()
      .maybeSingle();

    if (error || !data) throw new Error(`Database Error: addWish failed: ${error?.message}`);
    return data as Wish;
  }

  async toggleWishApproval(wishId: string, isApproved: boolean): Promise<boolean> {
    const supabase = getAdminClient();
    const { error } = await supabase.from('wishes').update({ is_approved: isApproved }).eq('id', wishId);
    if (error) throw new Error(`Database Error: toggleWishApproval failed: ${error.message}`);
    return !error;
  }

  async getMoments(eventId: string, onlyApproved: boolean = false): Promise<EventMoment[]> {
    try {
      const supabase = getAdminClient();
      let query = supabase.from('moments').select('*').eq('event_id', eventId);
      if (onlyApproved) query = query.eq('is_approved', true);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        throwInProduction('Database Error: getMoments failed', error);
        return [];
      }
      return (data || []) as EventMoment[];
    } catch (err) {
      throwInProduction('Database Error: getMoments failed', err);
      return [];
    }
  }

  async addMoment(
    eventId: string,
    uploaderName: string,
    mediaUrl: string,
    caption?: string,
    section: 'men' | 'women' = 'men',
    uploaderPhone?: string
  ): Promise<EventMoment> {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('moments')
      .insert({
        event_id: eventId,
        uploader_name: uploaderName.trim(),
        media_url: mediaUrl,
        caption: caption ? caption.trim() : null,
        section,
        uploader_phone: uploaderPhone ? uploaderPhone.trim() : null,
        is_approved: false, // Strict Quarantine
      })
      .select()
      .maybeSingle();

    if (error || !data) throw new Error(`Database Error: addMoment failed: ${error?.message}`);
    return data as EventMoment;
  }

  async toggleMomentApproval(momentId: string, isApproved: boolean): Promise<boolean> {
    const supabase = getAdminClient();
    const { error } = await supabase.from('moments').update({ is_approved: isApproved }).eq('id', momentId);
    if (error) throw new Error(`Database Error: toggleMomentApproval failed: ${error.message}`);
    return !error;
  }

  async deleteMoment(momentId: string): Promise<boolean> {
    const supabase = getAdminClient();
    const { error } = await supabase.from('moments').delete().eq('id', momentId);
    if (error) throw new Error(`Database Error: deleteMoment failed: ${error.message}`);
    return !error;
  }

  // --------------------------------------------------------------------------
  // Aggregated Stats
  // --------------------------------------------------------------------------
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
        // approximate by station
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
