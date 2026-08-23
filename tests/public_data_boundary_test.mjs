import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const dtoSource = await read('lib/presentation/publicDtos.ts');
for (const secret of ['gate_pin:', 'owner_id:', 'primary_phone:', 'invitation_token_hash:', 'pass_token_hash:']) {
  assert(!dtoSource.includes(secret), `Public DTOs must never expose ${secret.slice(0, -1)}`);
}

const invitationPage = await read('app/i/[token]/page.tsx');
assert(invitationPage.includes('toPublicInvitationParty(data.party)'), 'Invitation page must map the party to a public DTO');
assert(invitationPage.includes('toPublicEvent(data.event)'), 'Invitation page must map the event to a public DTO');
assert(!invitationPage.includes('party={data.party}'), 'Invitation page must not pass a database party row to a Client Component');

const groupPage = await read('app/join/[slug]/page.tsx');
assert(groupPage.includes('toPublicGroupInvite(data.group)'), 'Group page must map the group to a public DTO');
assert(groupPage.includes('toPublicEvent(data.event)'), 'Group page must map the event to a public DTO');

const momentsPage = await read('app/moments/page.tsx');
assert(momentsPage.includes('moments.map(toPublicMoment)'), 'Public moments page must remove uploader phone numbers');

const rsvpRoute = await read('app/api/rsvp/route.ts');
assert(!rsvpRoute.includes('party: partyData.party'), 'RSVP response must not return the complete party record');
assert(rsvpRoute.includes('toPublicEntryPass(result.entryPass)'), 'RSVP response must return a sanitized pass DTO');

const joinRoute = await read('app/api/join/route.ts');
assert(joinRoute.includes('toPublicInvitationParty(result.party)'), 'Join responses must sanitize party records');
assert(joinRoute.includes('toPublicEntryPass(result.entryPass)'), 'Join responses must sanitize entry passes');

console.log('✔ Public client/API data boundaries exclude database secrets and guest contact data');
