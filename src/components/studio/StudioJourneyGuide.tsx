'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, PencilLine, Route } from 'lucide-react';

const creator = [
  ['اختَر قالبًا وعاينه', 'شاهد التصميم أولًا. فلتر «مشاهد 3D» يحدّد القوالب التي تستخدم Three.js فعلًا.'],
  ['أضف حكايتك', 'اكتب رسالتك، أضف صورك، ثم حدّد الألوان والمؤثرات واللحن الاختياري.'],
  ['راجع وأكّد', 'اختَر مدة التشغيل وراجع ملخص الموقع قبل تأكيد الإنشاء.'],
  ['شارك الرابط', 'أرسل رابط موقعك المستقل، وارجع إلى «مواقعي» إذا أردت تعديل رسالتك.'],
];
const visitor = [
  ['المقدمة', 'يفتح الزائر الرابط ويبدأ التجربة بإرادته. الموسيقى تظل متوقفة حتى يختار تشغيلها.'],
  ['لحظة التفاعل', 'حسب القالب، قد يفتح هدية، أو يفضّ ختم رسالة، أو يجيب عن سؤال في الحكاية.'],
  ['معرض الذكريات', 'يتصفّح الصور ويكبّر اللقطات. بعض القوالب تدمج الألبوم داخل المشهد نفسه.'],
  ['الخاتمة', 'يكشف الرسالة الأخيرة، ويمكنه مشاركة الرابط أو العودة إلى لحظته المفضلة.'],
];
export function StudioJourneyGuide({ slug, onClose }: { slug?: string; onClose: () => void }) {
  const [role, setRole] = useState<'creator' | 'visitor'>('creator');
  return <>
    <span className="help-symbol"><Route size={22}/></span>
    <p className="editorial-kicker" dir="ltr">THE EXPERIENCE GUIDE</p><h2>رحلة المستخدم</h2>
    <div className="journey-role-picker" role="group" aria-label="اختر الرحلة">
      <button type="button" aria-pressed={role==='creator'} onClick={() => setRole('creator')}><PencilLine size={15}/>صاحب الموقع</button>
      <button type="button" aria-pressed={role==='visitor'} onClick={() => setRole('visitor')}><Eye size={15}/>زائر الموقع</button>
    </div>
    <ol className="journey-guide-steps" key={role}>{(role==='creator'?creator:visitor).map(([title, description]) => <li key={title}><b>{title}</b><p>{description}</p></li>)}</ol>
    <Link className="help-action" onClick={onClose} prefetch={false} href={role==='creator'?'/bot':slug?`/preview/${encodeURIComponent(slug)}?journey=1`:'/templates'}>{role==='creator'?'ابدأ تخصيص موقعك':slug?'جرّب رحلة الزائر':'تصفّح القوالب'}<ArrowLeft size={14}/></Link>
  </>;
}
