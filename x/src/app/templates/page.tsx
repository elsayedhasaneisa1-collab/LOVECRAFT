import type { Metadata } from 'next';
import { StudioHome, type StudioSearch } from '@/components/studio/StudioHome';
export const revalidate = 300;
export const metadata: Metadata = { title: 'مكتبة القوالب | LOVECRAFT BOT' };
export default async function TemplateLibrary({ searchParams }: { searchParams: Promise<StudioSearch> }) {
  return <StudioHome search={await searchParams} />;
}
