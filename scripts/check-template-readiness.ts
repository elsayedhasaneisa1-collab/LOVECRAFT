import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile,access } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { db,pool,templates,templateCategories,templateVersions } from '../src/db';
import { registrySchema } from '../src/lib/template-registry';
import { DEVELOPER_WHATSAPP_URL } from '../src/lib/developer-footer';

/** Read-only library audit. Does not create users, sites, visits, credits, or test owners. */
async function main(){
  const base=(process.env.CHECK_BASE_URL||'http://127.0.0.1:3000').replace(/\/$/,'');
  const registry=registrySchema.parse(JSON.parse(await readFile('templates/catalog.json','utf8')));
  const published=await db.select({id:templates.id,slug:templates.slug,file:templates.githubPath,image:templates.previewImage,version:templates.currentVersion,category:templateCategories.slug}).from(templates).innerJoin(templateCategories,eq(templates.categoryId,templateCategories.id)).where(eq(templates.isPublished,true));
  const versions=new Set((await db.select().from(templateVersions)).filter(v=>v.isVerified).map(v=>`${v.templateId}:${v.version}`));
  const failures:string[]=[];let checked=0,index=0;
  async function audit(){while(index<published.length){const t=published[index++];try{
    const entry=registry.templates.find(e=>e.slug===t.slug);
    if(entry){const local=JSON.parse(await readFile(t.file,'utf8'));assert.equal(local.slug,t.slug);assert.equal(local.footer,'shared-global');assert.deepEqual(local.fields,entry.fields);}
    if(t.image.startsWith('/images/'))await access('public'+t.image);
    assert(versions.has(`${t.id}:${t.version}`),'Missing published version');
    const res=await fetch(`${base}/preview/${t.slug}`,{signal:AbortSignal.timeout(25000)});assert.equal(res.status,200);
    const html=await res.text();assert(html.includes('data-lovecraft-global-footer="enforced"'));assert(html.includes(DEVELOPER_WHATSAPP_URL.href));
    assert(html.includes('developed by elsayed hasan'));assert(html.includes('/bot?template='+t.slug));assert(!html.includes('NEXT_REDIRECT'));assert(!html.includes('id="__next_error__"'));
    checked++;
  }catch(err){failures.push(t.slug+': '+String(err));}}}
  await Promise.all(Array.from({length:4},audit));
  assert.equal(failures.length,0,failures.join('\n'));
  const missing=await fetch(base+'/preview/non-existent-template-check');assert.equal(missing.status,404);
  console.log(JSON.stringify({published:published.length,previewRoutesPassed:checked,categories:new Set(published.map(t=>t.category)).size,localManifests:registry.templates.length,whatsappFooterPassed:checked,unknownTemplateStatus:missing.status},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());
