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
assert(rsvpRoute.includes('toGuestEntryPassCredential(result.entryPass)'), 'RSVP response must return a sanitized pass DTO');

const joinRoute = await read('app/api/join/route.ts');
assert(joinRoute.includes('toPublicInvitationParty(result.party)'), 'Join responses must sanitize party records');
assert(joinRoute.includes('toGuestEntryPassCredential(result.entryPass)'), 'Join responses must sanitize entry passes');

// --- Admin pages: server-side authorization BEFORE any data access ----------
const adminPage = await read('app/admin/page.tsx');
const dalIdx = adminPage.indexOf('await requireAdminSession()');
const dataIdx = adminPage.indexOf('await getDefaultEvent()');
assert(dalIdx !== -1, '/admin page must call requireAdminSession()');
assert(dataIdx !== -1 && dalIdx < dataIdx, '/admin must authorize BEFORE its first data query');
assert(!adminPage.includes('FALLBACK_EVENT') || adminPage.includes('isProductionRuntime()'), 'Fallback demo event may only render behind a non-production guard');

for (const p of ['app/admin/live/page.tsx', 'app/admin/manifest/page.tsx']) {
  const src = await read(p);
  assert(src.includes('requireAdminSession()'), `${p} must be protected by requireAdminSession()`);
}

// --- Issued credential discipline (ADR-034) ---------------------------------
const invitationComponent = await read('components/LuxuryInvitation.tsx');
const groupComponent = await read('components/GroupInviteView.tsx');
assert(!invitationComponent.includes('wp_pass_${'), 'LuxuryInvitation must never fabricate a guessable pass token');
assert(!groupComponent.includes('wp_pass_${'), 'GroupInviteView must never fabricate a guessable pass token');

// --- Public moment API returns DTO; wishes are quarantined ------------------
const momentRoute = await read('app/api/public/moment/route.ts');
assert(momentRoute.includes('toPublicMoment(moment)'), 'Public moment response must map through toPublicMoment (no uploader_phone)');
const wishRoute = await read('app/api/public/wish/route.ts');
assert(wishRoute.includes('undefined, false);'), 'Public wishes must be inserted quarantined (is_approved=false)');

console.log('✔ Admin authorization boundaries, credential discipline, and quarantine defaults verified');

console.log('✔ Public client/API data boundaries exclude database secrets and guest contact data');
