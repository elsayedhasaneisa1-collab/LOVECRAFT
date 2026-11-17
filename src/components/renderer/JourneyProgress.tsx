'use client';
import { Check } from 'lucide-react';
export const sceneNames = { intro: 'المقدمة', experience: 'التفاعل', gallery: 'الذكريات', finale: 'الخاتمة' } as const;
export type SceneKey = keyof typeof sceneNames;
export function JourneyProgress({ scenes, current, onChange }: { scenes: SceneKey[]; current: number; onChange: (index: number) => void }) {
  return <nav className="visitor-progress" aria-label="مشاهد رحلة الزائر">
    <span className="visitor-progress-label">رحلة الزائر</span>
    <ol>{scenes.map((scene, i) => <li key={scene} data-active={current===i || undefined} data-done={current>i || undefined}>
      <button type="button" aria-current={current===i?'step':undefined} onClick={()=>onChange(i)} aria-label={`المشهد ${i+1}: ${sceneNames[scene]}`}>
        <span className="visitor-step-number">{i<current?<Check size={12}/>:String(i+1).padStart(2,'0')}</span><span>{sceneNames[scene]}</span>
      </button>
    </li>)}</ol>
  </nav>;
}
