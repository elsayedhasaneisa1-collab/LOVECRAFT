import Link from 'next/link';

export function StudioMark({ size = 39 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" fill="none">
    <path d="M3 13 12 5l10 7 10-7 9 8-19 27L3 13Z" fill="#943B49" />
    <path d="m3 13 9-8 4 13L3 13Z" fill="#CE8185"/><path d="m12 5 10 7-6 6-4-13Z" fill="#B55E69"/>
    <path d="m3 13 13 5 6 22L3 13Z" fill="#A44E5B"/><path d="m16 18 6-6 10-7-6 15-4 20-6-22Z" fill="#883543"/>
    <path d="m32 5 9 8-15 7 6-15Z" fill="#C77980"/><path d="m26 20 15-7-19 27 4-20Z" fill="#6D2636"/>
  </svg>;
}

export function StudioBrand() {
  return <Link href="/" className="studio-brand" aria-label="LOVECRAFT BOT — مكتبة القوالب">
    <StudioMark/><span dir="ltr"><strong>LOVECRAFT</strong><small>BOT STUDIO</small></span>
  </Link>;
}
