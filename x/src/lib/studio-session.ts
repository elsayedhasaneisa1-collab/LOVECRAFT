import { randomBytes, randomInt } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db, users, userSessions, userCredits } from '@/db';
import { NextRequest, NextResponse } from 'next/server';
import { sha256Hex } from './security';

const COOKIE='lc_studio_session';
export async function readStudioActor(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [row]=await db.select({ id:users.id, telegramUserId:users.telegramUserId, firstName:users.firstName, username:users.username })
    .from(userSessions).innerJoin(users,eq(userSessions.userId,users.id))
    .where(and(eq(userSessions.sessionToken,`web:${sha256Hex(token)}`),gt(userSessions.expiresAt,new Date()),lt(users.telegramUserId,0))).limit(1);
  return row ?? null;
}
export async function openStudioSession(req:NextRequest) {
  const token=randomBytes(32).toString('hex');
  const key=-randomInt(1,2**45); // Negative IDs are reserved for web workspaces, never Telegram accounts.
  const expiresAt=new Date(Date.now()+7*86400_000);
  const user=await db.transaction(async tx=>{
    const [u]=await tx.insert(users).values({telegramUserId:key,telegramChatId:key,firstName:'زائر الاستوديو',username:null,referralCode:'WEB'+randomBytes(12).toString('hex')}).returning();
    await tx.insert(userCredits).values({userId:u.id});
    await tx.insert(userSessions).values({userId:u.id,sessionToken:`web:${sha256Hex(token)}`,currentScreen:'main_menu',draftPayload:{},expiresAt});
    return u;
  });
  const result=NextResponse.json({telegramUserId:user.telegramUserId,firstName:user.firstName,username:''});
  result.cookies.set(COOKIE,token,{path:'/',httpOnly:true,sameSite:'strict',secure:req.nextUrl.protocol==='https:'||req.headers.get('x-forwarded-proto')==='https',expires:expiresAt});
  result.headers.set('Cache-Control','no-store');
  return result;
}
