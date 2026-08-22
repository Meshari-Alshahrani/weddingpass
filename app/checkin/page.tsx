import { getDefaultEvent } from '@/lib/db/store';
import { GateScanner } from '@/components/GateScanner';

export default async function CheckInPage() {
  const event = await getDefaultEvent();

  return <GateScanner eventId={event.id} />;
}
