import { getStudioCatalog } from '@/lib/studio-catalog';
import { StudioLibrary } from './StudioLibrary';

export type StudioSearch = { category?: string; q?: string; view?: string; tier?: string; motion?: string };
export async function StudioHome({ search }: { search: StudioSearch }) {
  const data = await getStudioCatalog();
  return <StudioLibrary data={data} initial={search} />;
}
