import 'dotenv/config';
import assert from 'node:assert/strict';
import {and,eq,lt} from 'drizzle-orm';
import {db,pool,templates,users,sites,userCredits,siteEvents} from '../src/db';
const base='http://127.0.0.1:3000';
async function main(){
  const opened=await fetch(base+'/api/studio/session',{method:'POST',headers:{Origin:base}});assert.equal(opened.status,200);
  const cookie=opened.headers.get('set-cookie')!.split(';')[0];const profile=await opened.json();assert(profile.telegramUserId<0);
  const uid=profile.telegramUserId;
  try{
    const headers={'Content-Type':'application/json',Origin:base,Cookie:cookie};
    const act=async(data:Record<string,unknown>)=>{const r=await fetch(base+'/api/bot/engine',{method:'POST',headers,body:JSON.stringify({...profile,telegramChatId:uid,...data})});assert.equal(r.status,200);return r.json();};
    const cb=(str:string)=>act({actionType:'callback',callbackData:str});const text=(str:string)=>act({actionType:'text',textInput:str});
    const [t]=await db.select().from(templates).where(eq(templates.slug,'birthday-celebration')).limit(1);
    await cb('wiz:start:'+t.id); const early=await cb('wiz:confirm');assert.equal(early.awaiting_input,'text');
    for(const value of ['ضيف التحقق','استوديو التحقق','اختبار مسار إنشاء قالب','تهنئة خاصة لاختبار عزل القالب.'])await text(value);
    for(const f of t.fieldsSchema.slice(4)){if(f.required)await text('اختبار');else await cb('wiz:skip_field');}
    await cb('wiz:colors');await cb('wiz:design');await cb('wiz:music');await cb('wiz:dur:1');
    const summary=await cb('wiz:summary');assert(summary.text.includes('ملخص موقعك'));
    const results=await Promise.all([cb('wiz:confirm'),cb('wiz:confirm')]);
    const [user]=await db.select().from(users).where(eq(users.telegramUserId,uid));const created=await db.select().from(sites).where(eq(sites.userId,user.id));assert.equal(created.length,1);
    const site=created[0];assert(results.some(r=>r.text.includes(site.slug)));assert.equal(site.pinnedVersion,t.currentVersion);
    const html=await(await fetch(`${base}/s/${site.slug}`)).text();assert(html.includes('اختبار مسار إنشاء قالب'));assert(html.includes('developed by elsayed hasan'));
    const reqId=crypto.randomUUID();for(let n=0;n<2;n++){const res=await fetch(`${base}/api/s/${site.slug}/rsvp`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({name:'ضيف التحقق',requestId:reqId})});assert.equal(res.status,200);}
    const replies=await db.select().from(siteEvents).where(and(eq(siteEvents.siteId,site.id),eq(siteEvents.eventType,'attendance_confirmed')));assert.equal(replies.length,1);
    await cb(`sites:edit:${site.id}:headline`);await text('تم تعديل قالب الاختبار');assert((await(await fetch(`${base}/s/${site.slug}`)).text()).includes('تم تعديل قالب الاختبار'));
    const [before]=await db.select().from(userCredits).where(eq(userCredits.userId,user.id));await cb(`sites:del:${site.id}`);const [after]=await db.select().from(userCredits).where(eq(userCredits.userId,user.id));assert.equal(before.balance,after.balance);assert.equal((await fetch(`${base}/s/${site.slug}`)).status,404);
    console.log('Verified: isolated web session, required fields, confirmation summary, concurrent idempotency, pinned version, rendering, RSVP persistence/deduplication, edit, deletion without refund.');
  }finally{await db.delete(users).where(and(eq(users.telegramUserId,uid),lt(users.telegramUserId,0)));}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());
