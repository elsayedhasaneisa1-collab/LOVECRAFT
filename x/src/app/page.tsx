import { StudioHome, type StudioSearch } from '@/components/studio/StudioHome';
export const revalidate = 300;
export default async function Home({ searchParams }: { searchParams: Promise<StudioSearch> }) {
  return <StudioHome search={await searchParams} />;
}
