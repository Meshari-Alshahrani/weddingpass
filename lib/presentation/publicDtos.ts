import 'server-only';

import type {
  EntryPass,
  EventMoment,
  GroupInviteLink,
  Party,
  WeddingEvent,
} from '@/types/database';

/**
 * DTOs are the only database-derived objects permitted to cross a public
 * Server Component or public API boundary. Keep these allow-lists explicit:
 * never spread a database row into one of them.
 */
export type PublicEvent = Pick<
  WeddingEvent,
  | 'id'
  | 'slug'
  | 'groom_name'
  | 'bride_name'
  | 'event_date'
  | 'event_time'
  | 'venue_name'
  | 'venue_address'
  | 'venue_maps_url'
  | 'theme_id'
  | 'rsvp_mode'
  | 'welcome_verse'
  | 'invitation_image_url'
  | 'timeline_reception'
  | 'timeline_ardah'
  | 'timeline_dinner'
  // Gift-transfer details are intentionally displayed on the invitation.
  // They are public event content, unlike gate_pin and owner_id.
  | 'iban'
  | 'bank_name'
>;

export type PublicInvitationParty = Pick<
  Party,
  | 'id'
  | 'party_name'
  | 'allowed_count'
  | 'confirmed_count'
  | 'table_number'
  | 'needs_wheelchair'
  | 'rsvp_status'
  | 'section'
  | 'notes'
>;

/**
 * The issued entry credential. `raw_pass_token` is a BEARER CREDENTIAL —
 * whoever holds it can enter the venue. It is delivered through exactly two
 * authorized channels (pinned by tests):
 *   1. Issuance: the RSVP / group-registration response that just created it.
 *   2. Authorized retrieval: GET /i/[token] where possession of the secret
 *      invitation link is itself the credential of equal trust (ADR-034).
 * It must never appear in admin payloads, logs, caches, errors, or health.
 */
export type GuestEntryPassCredential = Pick<EntryPass, 'id' | 'raw_pass_token'>;

export type PublicGroupInvite = Pick<
  GroupInviteLink,
  'group_name' | 'slug' | 'limit_mode' | 'max_capacity' | 'confirmed_count' | 'max_seats_per_guest'
>;

export type PublicMoment = Pick<EventMoment, 'id' | 'uploader_name' | 'media_url' | 'caption' | 'section' | 'created_at'>;

export type PublicGateEvent = Pick<PublicEvent, 'id' | 'groom_name' | 'bride_name'>;

export function toPublicEvent(event: WeddingEvent): PublicEvent {
  return {
    id: event.id,
    slug: event.slug,
    groom_name: event.groom_name,
    bride_name: event.bride_name,
    event_date: event.event_date,
    event_time: event.event_time,
    venue_name: event.venue_name,
    venue_address: event.venue_address,
    venue_maps_url: event.venue_maps_url,
    theme_id: event.theme_id,
    rsvp_mode: event.rsvp_mode,
    welcome_verse: event.welcome_verse,
    invitation_image_url: event.invitation_image_url,
    timeline_reception: event.timeline_reception,
    timeline_ardah: event.timeline_ardah,
    timeline_dinner: event.timeline_dinner,
    iban: event.iban,
    bank_name: event.bank_name,
  };
}

export function toPublicInvitationParty(party: Party): PublicInvitationParty {
  return {
    id: party.id,
    party_name: party.party_name,
    allowed_count: party.allowed_count,
    confirmed_count: party.confirmed_count,
    table_number: party.table_number,
    needs_wheelchair: party.needs_wheelchair,
    rsvp_status: party.rsvp_status,
    section: party.section,
    notes: party.notes,
  };
}

export function toGuestEntryPassCredential(entryPass?: EntryPass): GuestEntryPassCredential | undefined {
  if (!entryPass) return undefined;
  return { id: entryPass.id, raw_pass_token: entryPass.raw_pass_token };
}

export function toPublicGroupInvite(group: GroupInviteLink): PublicGroupInvite {
  return {
    group_name: group.group_name,
    slug: group.slug,
    limit_mode: group.limit_mode,
    max_capacity: group.max_capacity,
    confirmed_count: group.confirmed_count,
    max_seats_per_guest: group.max_seats_per_guest,
  };
}

export function toPublicMoment(moment: EventMoment): PublicMoment {
  return {
    id: moment.id,
    uploader_name: moment.uploader_name,
    media_url: moment.media_url,
    caption: moment.caption,
    section: moment.section,
    created_at: moment.created_at,
  };
}

export function toPublicGateEvent(event: WeddingEvent): PublicGateEvent {
  return { id: event.id, groom_name: event.groom_name, bride_name: event.bride_name };
}
