import { getDefaultEvent } from '@/lib/db/store';
import { GateScanner } from '@/components/GateScanner';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function CheckInPage() {
  const event = await getDefaultEvent();

  return <GateScanner initialEvent={event} />;
}
