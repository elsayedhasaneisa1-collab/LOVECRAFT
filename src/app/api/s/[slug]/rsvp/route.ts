import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {and,eq,sql} from 'drizzle-orm';
import {db,siteEvents,sites} from '@/db';
import {loadRenderedSiteBySlug} from '@/lib/site-engine';
import {checkRateLimit,getClientIp,sanitizePlainText,sha256Hex,verifySameOrigin} from '@/lib/security';
const form=z.object({name:z.string().trim().min(1).max(80),requestId:z.string().uuid()});
export async function POST(req:NextRequest,{params}:{params:Promise<{slug:string}>}){
  if(!verifySameOrigin(req)||req.headers.get('sec-fetch-site')==='cross-site')return NextResponse.json({error:'مصدر غير صالح.'},{status:403});
  if(!checkRateLimit(`rsvp:${getClientIp(req)}`,12,60_000).allowed)return NextResponse.json({error:'طلبات متكررة. حاول لاحقًا.'},{status:429});
  const input=form.safeParse(await req.json().catch(()=>null));if(!input.success)return NextResponse.json({error:'أدخل اسمًا صالحًا.'},{status:400});
  const {slug}=await params;const rendered=await loadRenderedSiteBySlug(slug);
  if(rendered.state!=='active'||rendered.payload.experienceType!=='celebration-rsvp')return NextResponse.json({error:'الدعوة غير متاحة.'},{status:404});
  const name=sanitizePlainText(input.data.name,80);if(!name)return NextResponse.json({error:'الاسم مطلوب.'},{status:400});
  const id=rendered.payload.siteId,key=sha256Hex(`${id}:${input.data.requestId}`);
  const accepted=await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
    const [active]=await tx.select({id:sites.id}).from(sites).where(and(eq(sites.id,id),eq(sites.status,'active'),eq(sites.isHidden,false))).for('share');
    if(!active)return false;
    const [existing]=await tx.select({id:siteEvents.id}).from(siteEvents).where(and(eq(siteEvents.siteId,id),eq(siteEvents.eventType,'attendance_confirmed'),sql`${siteEvents.details}->>'responseKey'=${key}`)).limit(1);
    if(!existing)await tx.insert(siteEvents).values({siteId:id,actorType:'visitor',eventType:'attendance_confirmed',details:{guestName:name,responseKey:key}});
    return true;
  });
  return NextResponse.json({ok:accepted},{status:accepted?200:409});
}
