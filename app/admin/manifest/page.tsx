import { getDefaultEvent, getAllParties } from '@/lib/db/store';
import { ManifestView } from '@/components/ManifestView';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function EmergencyManifestPage() {
  const event = await getDefaultEvent();
  const allParties = await getAllParties(event.id);

  // Filter only confirmed guests and sort alphabetically by name
  const confirmedGuests = allParties
    .filter((p) => p.rsvp_status === 'confirmed' || p.allowed_count > 0)
    .sort((a, b) => a.party_name.localeCompare(b.party_name, 'ar'));

  return <ManifestView event={event} confirmedGuests={confirmedGuests} />;
}
