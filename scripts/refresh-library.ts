import 'dotenv/config';
import { and,eq,sql } from 'drizzle-orm';
import { db,pool,templates,templateVersions } from '../src/db';
import { buildAllTemplateSeeds,buildTemplateFieldsSchema } from '../src/lib/templates-catalog';

async function main(){
  for(const seed of buildAllTemplateSeeds().filter(s=>s.experienceType==='links-showcase')){
    await db.transaction(async tx=>{
      const [t]=await tx.select().from(templates).where(eq(templates.slug,seed.slug)).limit(1).for('update');
      if(!t||t.currentVersion!=='1.0.0')return;
      const fields=buildTemplateFieldsSchema(seed),version='1.1.0';
      await tx.insert(templateVersions).values({templateId:t.id,version,configSnapshot:{...t.defaultConfig,experienceType:t.experienceType,previewImage:t.previewImage},schemaSnapshot:fields,isVerified:true,changelog:'إضافة روابط حسابات مخصصة وآمنة.'}).onConflictDoNothing();
      await tx.update(templates).set({fieldsSchema:fields,currentVersion:version,updatedAt:new Date()}).where(eq(templates.id,t.id));
    });
  }
  // Correct placeholder Git provenance in installations of the original catalogue; never change content snapshots.
  await db.update(templateVersions).set({githubCommitSha:null,changelog:'الإصدار الأول من مكتبة الاستوديو'}).where(and(eq(templateVersions.githubCommitSha,'a1b2c3d'),eq(templateVersions.version,'1.0.0')));
  await db.execute(sql`DROP POLICY IF EXISTS public_read_active_sites ON public.sites`);
  console.log('Existing site content and pinned template versions preserved.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
