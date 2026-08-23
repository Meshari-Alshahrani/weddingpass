import { getDefaultEvent, getMoments } from '@/lib/db/store';
import { MomentsGallery } from '@/components/MomentsGallery';
import { toPublicEvent, toPublicMoment } from '@/lib/presentation/publicDtos';

export const dynamic = 'force-dynamic';

export default async function MomentsPage() {
  const event = await getDefaultEvent();
  const moments = await getMoments(event.id, true); // Only approved moments for guests

  return <MomentsGallery initialEvent={toPublicEvent(event)} initialMoments={moments.map(toPublicMoment)} />;
}
