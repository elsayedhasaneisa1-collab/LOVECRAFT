import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db,users } from '@/db';
import { readStudioActor,openStudioSession } from '@/lib/studio-session';
import { checkRateLimit,getClientIp,verifySameOrigin,sanitizePlainText } from '@/lib/security';
import { ensurePlatformSeeded } from '@/lib/bootstrap';

export async function POST(req:NextRequest) {
  if(!verifySameOrigin(req)||req.headers.get('sec-fetch-site')==='cross-site') return NextResponse.json({error:'مصدر الطلب غير صالح'},{status:403});
  const actor=await readStudioActor(req);
  if(actor) return NextResponse.json({telegramUserId:actor.telegramUserId,firstName:actor.firstName,username:actor.username||''},{headers:{'Cache-Control':'no-store'}});
  if(!checkRateLimit(`new-studio:${getClientIp(req)}`,8,3600_000).allowed) return NextResponse.json({error:'وصلت إلى حد جلسات الاستوديو. حاول لاحقًا.'},{status:429});
  await ensurePlatformSeeded();
  return openStudioSession(req);
}
export async function PATCH(req:NextRequest) {
  if(!verifySameOrigin(req)||req.headers.get('sec-fetch-site')==='cross-site') return NextResponse.json({error:'مصدر الطلب غير صالح'},{status:403});
  const actor=await readStudioActor(req);
  if(!actor) return NextResponse.json({error:'انتهت الجلسة. أعد فتح الاستوديو.'},{status:401});
  const payload=await req.json().catch(()=>null);
  const name=sanitizePlainText(payload?.firstName,50);
  if(!name) return NextResponse.json({error:'أدخل اسمًا صالحًا'},{status:400});
  await db.update(users).set({firstName:name}).where(and(eq(users.id,actor.id),eq(users.telegramUserId,actor.telegramUserId)));
  return NextResponse.json({ok:true,firstName:name});
}
