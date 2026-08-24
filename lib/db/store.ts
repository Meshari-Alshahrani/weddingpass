/**
 * WeddingPass Central Data Store Facade
 * Version: 5.8 (Enterprise Repository Architecture)
 * Compatibility facade that delegates every operation to the active repository.
 * Production is Supabase-only and fail-closed; MockRepository is limited to
 * tests or explicit local development opt-in.
 */
import { getRepository } from '../repositories/index.ts';
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
} from '../../types/database.ts';

// ----------------------------------------------------------------------------
// Events
// ----------------------------------------------------------------------------
export async function getDefaultEvent(): Promise<WeddingEvent> {
  return getRepository().getDefaultEvent();
}

export async function updateEventSettings(eventId: string, eventData: Partial<WeddingEvent>): Promise<WeddingEvent | null> {
  return getRepository().updateEventSettings(eventId, eventData);
}

// ----------------------------------------------------------------------------
// Parties & RSVP
// ----------------------------------------------------------------------------
export async function getPartyByInvitationToken(rawToken: string): Promise<{ party: Party; event: WeddingEvent; entryPass?: EntryPass } | null> {
  return getRepository().getPartyByInvitationToken(rawToken);
}

export async function submitPartyRSVP(
  partyId: string,
  status: 'confirmed' | 'declined',
  attendingCount: number,
  notes?: string,
  needsWheelchair?: boolean
): Promise<{ success: boolean; entryPass?: EntryPass; message: string }> {
  return getRepository().submitPartyRSVP(partyId, status, attendingCount, notes, needsWheelchair);
}

export async function getAllParties(eventId: string): Promise<Party[]> {
  return getRepository().getAllParties(eventId);
}

export async function bulkAddParties(
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
  return getRepository().bulkAddParties(eventId, rawGuests);
}

export async function updatePartyDispatch(partyId: string, status: DispatchStatus): Promise<void> {
  return getRepository().updatePartyDispatch(partyId, status);
}

export async function updatePartyTableNumber(partyId: string, tableNumber?: string | null): Promise<boolean> {
  return getRepository().updatePartyTableNumber(partyId, tableNumber);
}

export async function recoverGuestPassByPhone(eventId: string, rawPhone: string): Promise<{ success: boolean; party?: Party; entryPass?: EntryPass; message: string }> {
  return getRepository().recoverGuestPassByPhone(eventId, rawPhone);
}

export async function searchParties(eventId: string, query: string): Promise<Party[]> {
  return getRepository().searchParties(eventId, query);
}

// ----------------------------------------------------------------------------
// Group Links
// ----------------------------------------------------------------------------
export async function getAllGroupLinks(eventId: string): Promise<GroupInviteLink[]> {
  return getRepository().getAllGroupLinks(eventId);
}

export async function getGroupLinkBySlug(slug: string): Promise<{ group: GroupInviteLink; event: WeddingEvent } | null> {
  return getRepository().getGroupLinkBySlug(slug);
}

export async function createGroupLink(
  eventId: string,
  groupName: string,
  slug: string,
  hostName: HostRole,
  limitMode: GroupLimitMode,
  maxCapacity?: number,
  maxSeatsPerGuest?: number,
  section?: string
): Promise<GroupInviteLink> {
  return getRepository().createGroupLink(eventId, groupName, slug, hostName, limitMode, maxCapacity, maxSeatsPerGuest, section);
}

export async function registerGroupGuest(
  slug: string,
  guestName: string,
  guestPhone: string,
  seatsCount: number,
  notes?: string
): Promise<{ success: boolean; code: string; message: string; party?: Party; entryPass?: EntryPass; remainingSeats?: number }> {
  return getRepository().registerGroupGuest(slug, guestName, guestPhone, seatsCount, notes);
}

// ----------------------------------------------------------------------------
// Check-In & Gate Operations
// ----------------------------------------------------------------------------
export async function executeCheckIn(
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
  return getRepository().executeCheckIn(
    eventId,
    rawPassToken,
    stationName,
    operatorName,
    checkinType,
    overrideCount,
    gateSection,
    forceAdmitCrossSection,
    reconciliation
  );
}

export async function getCheckInLogs(eventId: string): Promise<CheckInLog[]> {
  return getRepository().getCheckInLogs(eventId);
}

export async function getActivePassesForOfflineCache(eventId: string) {
  return getRepository().getActivePassesForOfflineCache(eventId);
}

export async function revokePass(partyId: string): Promise<boolean> {
  return getRepository().revokePass(partyId);
}

export async function regeneratePass(partyId: string): Promise<EntryPass | null> {
  return getRepository().regeneratePass(partyId);
}

// ----------------------------------------------------------------------------
// Wishes & Moments
// ----------------------------------------------------------------------------
export async function getWishes(eventId: string, onlyApproved: boolean = true): Promise<Wish[]> {
  return getRepository().getWishes(eventId, onlyApproved);
}

export async function addWish(eventId: string, partyName: string, message: string, partyId?: string, isApproved: boolean = true): Promise<Wish> {
  return getRepository().addWish(eventId, partyName, message, partyId, isApproved);
}

export async function toggleWishApproval(wishId: string, isApproved: boolean): Promise<boolean> {
  return getRepository().toggleWishApproval(wishId, isApproved);
}

export async function getMoments(eventId: string, onlyApproved: boolean = false): Promise<EventMoment[]> {
  return getRepository().getMoments(eventId, onlyApproved);
}

export async function addMoment(
  eventId: string,
  uploaderName: string,
  mediaUrl: string,
  caption?: string,
  section: 'men' | 'women' = 'men',
  uploaderPhone?: string
): Promise<EventMoment> {
  return getRepository().addMoment(eventId, uploaderName, mediaUrl, caption, section, uploaderPhone);
}

export async function toggleMomentApproval(momentId: string, isApproved: boolean): Promise<boolean> {
  return getRepository().toggleMomentApproval(momentId, isApproved);
}

export async function deleteMoment(momentId: string): Promise<boolean> {
  return getRepository().deleteMoment(momentId);
}

// ----------------------------------------------------------------------------
// Event Stats
// ----------------------------------------------------------------------------
export async function getEventStats(eventId: string) {
  return getRepository().getEventStats(eventId);
}
