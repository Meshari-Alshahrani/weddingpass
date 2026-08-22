import { getDefaultEvent, getMoments } from '@/lib/db/store';
import { MomentsGallery } from '@/components/MomentsGallery';

export default async function MomentsPage() {
  const event = await getDefaultEvent();
  const moments = await getMoments(event.id, true); // Only approved moments for guests

  return <MomentsGallery initialEvent={event} initialMoments={moments} />;
}
