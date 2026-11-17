import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db, systemSettings, templateCategories, templates, templateVersions } from '@/db';
import { COMPONENT_LIBRARY, THEME_PALETTES, MUSIC_TRACKS } from './components-catalog';
import { buildAllTemplateSeeds, DEFAULT_COMPATIBILITY } from './templates-catalog';
import { sanitizeSafeImageUrl, sanitizePlainText } from './security';

const builtins=buildAllTemplateSeeds();
const experiences=new Set(builtins.map(t=>String(t.experienceType)));
const text=z.string().min(1).max(240);
const variant=(group:string)=>z.string().refine(x=>COMPONENT_LIBRARY.some(c=>c.componentGroup===group&&c.variantKey===x));
const color=z.string().regex(/^#[\da-fA-F]{6}$/);
const samples=z.object({
  secretCode:z.string().max(80).optional(),secretHint:text.optional(),notes:z.array(text).max(20).optional(),
  milestones:z.array(z.object({title:text,desc:text})).max(20).optional(),wheelSlices:z.array(text).min(2).max(8).optional(),
  statements:z.array(z.object({text,answer:z.boolean()})).min(1).max(20).optional(),
  quizItems:z.array(z.object({q:text,options:z.array(text).min(2).max(6),correct:z.number().int().min(0).max(5)}).refine(q=>q.correct<q.options.length)).min(1).max(20).optional(),
  stats:z.array(z.object({label:text,value:text})).max(9).optional(),highlights:z.array(z.object({title:text,desc:text})).max(12).optional(),
  eventLocation:text.optional(),eventTime:text.optional(),roleTitle:text.optional(),contactHandle:text.optional(),
  links:z.array(z.object({label:text,tag:text.optional(),url:z.string().url().max(500).optional()})).max(12).optional(),
});
const configSchema=z.object({paletteId:z.string().refine(id=>THEME_PALETTES.some(p=>p.id===id)),
  themeColors:z.object({primary:color,secondary:color,accent:color,background:color,surface:color,text:color,mode:z.enum(['dark','light'])}),
  componentsConfig:z.object({hero:variant('hero'),background:variant('background'),typography:variant('typography'),button:variant('button'),gallery:variant('gallery'),sections:z.array(variant('section')).max(16),effects:z.array(variant('effect')).max(10),introStyle:z.enum(['curtain','wax-seal','portal','gift-ribbon','minimal-fade','vault-lock','countdown-gate']),liteModeDefault:z.boolean().optional()}),
  musicTrack:z.string().refine(id=>MUSIC_TRACKS.some(t=>t.id===id)),sampleCustomFields:samples.default({}),
});
const manifest=z.object({format:z.literal(1),version:z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}$/),slug:z.string().regex(/^[a-z0-9-]{3,64}$/),category:z.string().max(30),title:z.object({ar:text,en:text}),descriptionAr:z.string().min(5).max(1000),
  experienceType:z.string().refine(t=>experiences.has(t)),previewImage:z.string().max(300).refine(u=>Boolean(sanitizeSafeImageUrl(u))),tier:z.enum(['free','premium']),creditCost:z.number().int().min(0).max(100),order:z.number().int().min(0).max(999),
  fields:z.array(z.object({key:z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{1,50}$/).refine(x=>!['constructor','prototype'].includes(x)&&!x.toLowerCase().includes('footer')),labelAr:text,promptAr:text,placeholderAr:z.string().max(300),required:z.boolean(),type:z.enum(['text','textarea','date','code','list'])})).min(4).max(30).refine(fs=>['recipientName','senderName','headline','mainMessage'].every(k=>fs.some(f=>f.key===k&&f.required))),
  config:configSchema,dependencies:z.array(z.enum(['three','canvas-confetti','motion-engine'])).max(3),footer:z.literal('shared-global'),
});
export const registrySchema=z.object({format:z.literal(1),templates:z.array(manifest).min(1).max(600)}).refine(r=>new Set(r.templates.map(t=>t.slug)).size===r.templates.length);

export async function syncTemplateRegistry() {
  const [cfg]=await db.select().from(systemSettings).limit(1);
  if(!cfg?.githubSyncEnabled)throw new Error('مزامنة GitHub غير مفعّلة.');
  const owner=encodeURIComponent(cfg.githubOwner),repo=encodeURIComponent(cfg.githubRepo),branch=encodeURIComponent(cfg.githubBranch);
  const headers:Record<string,string>={Accept:'application/vnd.github.raw+json','User-Agent':'Lovecraft-Template-Studio','X-GitHub-Api-Version':'2022-11-28'};
  if(process.env.GITHUB_TOKEN)headers.Authorization=`Bearer ${process.env.GITHUB_TOKEN}`;
  const res=await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/templates/catalog.json?ref=${branch}`,{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw new Error(res.status===404?'ملف templates/catalog.json غير موجود أو المستودع غير متاح. تحقق من إعدادات GitHub.':'تعذرت قراءة مستودع القوالب. تحقق من صلاحيات الربط ثم أعد المحاولة.');
  if(Number(res.headers.get('content-length')||0)>4_000_000)throw new Error('ملف المكتبة أكبر من الحد المسموح.');
  const raw=await res.text();if(Buffer.byteLength(raw)>4_000_000)throw new Error('ملف المكتبة أكبر من الحد المسموح.');
  let json:unknown;try{json=JSON.parse(raw);}catch{throw new Error('ملف الكتالوج ليس JSON صالحًا.');}
  const parsed=registrySchema.safeParse(json);if(!parsed.success)throw new Error('لم تُطبّق أي تغييرات: ملف القالب أو مكوّناته لا تطابق بنية الاستوديو المعتمدة.');
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('lovecraft-template-import'))`);
    const cats=new Map((await tx.select().from(templateCategories)).map(c=>[c.slug,c.id]));
    const existing=new Map((await tx.select({id:templates.id,slug:templates.slug}).from(templates)).map(t=>[t.slug,t.id]));
    const versions=new Set((await tx.select({id:templateVersions.templateId,v:templateVersions.version}).from(templateVersions)).map(v=>`${v.id}:${v.v}`));
    let imported=0,unchanged=0;
    for(const t of parsed.data.templates){
      const categoryId=cats.get(t.category);if(!categoryId)throw new Error('تصنيف غير مسجّل في الاستوديو.');
      let id=existing.get(t.slug);
      if(id&&versions.has(`${id}:${t.version}`)){unchanged++;continue;}
      const snapshot={...t.config,experienceType:t.experienceType,previewImage:t.previewImage};
      const values={categoryId,slug:t.slug,nameAr:sanitizePlainText(t.title.ar,100),nameEn:sanitizePlainText(t.title.en,100),descriptionAr:sanitizePlainText(t.descriptionAr,1000),previewImage:t.previewImage,githubPath:`templates/${t.category}/${t.slug}/template.json`,githubRepo:`${cfg.githubOwner}/${cfg.githubRepo}`,currentVersion:t.version,tier:t.tier,creditCost:t.creditCost,isPublished:false,sortOrder:t.order,experienceType:t.experienceType,defaultConfig:snapshot,fieldsSchema:t.fields,dependencies:t.dependencies,compatibility:DEFAULT_COMPATIBILITY,updatedAt:new Date()};
      if(id)await tx.update(templates).set(values).where(eq(templates.id,id));
      else id=(await tx.insert(templates).values(values).returning({id:templates.id}))[0].id;
      await tx.insert(templateVersions).values({templateId:id,version:t.version,configSnapshot:snapshot,schemaSnapshot:t.fields,changelog:'تم التحقق من بنية الملف؛ في انتظار مراجعة المالك.',isVerified:false});
      imported++;
    }
    await tx.update(systemSettings).set({lastGithubSyncAt:new Date()}).where(eq(systemSettings.id,cfg.id));
    return {imported,unchanged};
  });
}
