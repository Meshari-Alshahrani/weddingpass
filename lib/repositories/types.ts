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

export interface IEventRepository {
  getDefaultEvent(): Promise<WeddingEvent>;
  updateEventSettings(eventId: string, eventData: Partial<WeddingEvent>): Promise<WeddingEvent | null>;
}

export interface IPartyRepository {
  getPartyByInvitationToken(rawToken: string): Promise<{ party: Party; event: WeddingEvent; entryPass?: EntryPass } | null>;
  submitPartyRSVP(
    partyId: string,
    status: 'confirmed' | 'declined',
    attendingCount: number,
    notes?: string,
    needsWheelchair?: boolean
  ): Promise<{ success: boolean; entryPass?: EntryPass; message: string }>;
  getAllParties(eventId: string): Promise<Party[]>;
  bulkAddParties(
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
  ): Promise<{ addedCount: number; parties: Party[] }>;
  updatePartyDispatch(partyId: string, status: DispatchStatus): Promise<void>;
  updatePartyTableNumber(partyId: string, tableNumber?: string | null): Promise<boolean>;
  recoverGuestPassByPhone(eventId: string, rawPhone: string): Promise<{ success: boolean; party?: Party; entryPass?: EntryPass; message: string }>;
  searchParties(eventId: string, query: string): Promise<Party[]>;
}

export interface IGroupLinkRepository {
  getAllGroupLinks(eventId: string): Promise<GroupInviteLink[]>;
  getGroupLinkBySlug(slug: string): Promise<{ group: GroupInviteLink; event: WeddingEvent } | null>;
  createGroupLink(
    eventId: string,
    groupName: string,
    slug: string,
    hostName: HostRole,
    limitMode: GroupLimitMode,
    maxCapacity?: number,
    maxSeatsPerGuest?: number,
    section?: string
  ): Promise<GroupInviteLink>;
  registerGroupGuest(
    slug: string,
    guestName: string,
    guestPhone: string,
    seatsCount: number,
    notes?: string
  ): Promise<{ success: boolean; code: string; message: string; party?: Party; entryPass?: EntryPass; remainingSeats?: number }>;
}

export interface ICheckInRepository {
  executeCheckIn(
    eventId: string,
    rawPassToken: string,
    stationName: string,
    operatorName: string,
    checkinType?: 'QR_SCAN' | 'MANUAL_SEARCH',
    overrideCount?: number,
    gateSection?: 'men' | 'women' | 'general',
    forceAdmitCrossSection?: boolean,
    reconciliation?: { queueId?: string | null; deviceMetadata?: Record<string, any> | null }
  ): Promise<CheckInRPCResponse>;
  getCheckInLogs(eventId: string): Promise<CheckInLog[]>;
  getActivePassesForOfflineCache(eventId: string): Promise<Array<{
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
  }>>;
  revokePass(partyId: string): Promise<boolean>;
  regeneratePass(partyId: string): Promise<EntryPass | null>;
}

export interface IWishRepository {
  getWishes(eventId: string, onlyApproved?: boolean): Promise<Wish[]>;
  addWish(eventId: string, partyName: string, message: string, partyId?: string, isApproved?: boolean): Promise<Wish>;
  toggleWishApproval(wishId: string, isApproved: boolean): Promise<boolean>;
}

export interface IMomentRepository {
  getMoments(eventId: string, onlyApproved?: boolean): Promise<EventMoment[]>;
  addMoment(
    eventId: string,
    uploaderName: string,
    mediaUrl: string,
    caption?: string,
    section?: 'men' | 'women',
    uploaderPhone?: string
  ): Promise<EventMoment>;
  toggleMomentApproval(momentId: string, isApproved: boolean): Promise<boolean>;
  deleteMoment(momentId: string): Promise<boolean>;
}

export interface IEventStatsRepository {
  getEventStats(eventId: string): Promise<{
    totalParties: number;
    totalAllowed: number;
    totalConfirmed: number;
    totalDeclined: number;
    totalUnopened: number;
    totalCheckedIn: number;
    menCheckedIn: number;
    womenCheckedIn: number;
    rsvpBreakdown: { confirmed: number; declined: number; unopened: number; viewed: number };
    sectionBreakdown: { men: number; women: number; vip: number; groom_family: number; bride_family: number; general: number };
    hostBreakdown: Record<string, { totalAllowed: number; confirmed: number; checkedIn: number }>;
  }>;
}
