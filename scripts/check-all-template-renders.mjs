import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
const base=process.env.CHECK_BASE_URL||'http://127.0.0.1:3000';
const registry=JSON.parse(await readFile('templates/catalog.json','utf8'));
const all=registry.templates.map(t=>t.slug);const engines=[];
for(const [engine,browserType] of Object.entries({chromium,firefox,webkit})){
  const browser=await browserType.launch({headless:true});
  let next=0,passed=0;const failures=[];
  try{
    const context=await browser.newContext({viewport:{width:engine==='webkit'?390:1366,height:engine==='webkit'?844:880},reducedMotion:'reduce',locale:'ar-EG'});
    async function worker(){const page=await context.newPage();let pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));try{while(next<all.length){const slug=all[next++];pageErrors=[];try{
      const res=await page.goto(`${base}/preview/${slug}`,{waitUntil:'domcontentloaded',timeout:25000});assert.equal(res.status(),200);
      // This state is set by a client effect; waiting for it also verifies hydration.
      await page.getByRole('button',{name:'إيقاف الوضع الخفيف',exact:true}).waitFor({timeout:12000});
      const checks=await page.evaluate(()=>({heading:!!document.querySelector('h1')?.textContent?.trim(),overflow:document.documentElement.scrollWidth>innerWidth,footer:document.querySelector('[data-lovecraft-global-footer] a')?.textContent}));
      assert(checks.heading);assert(!checks.overflow);assert.equal(checks.footer,'developed by elsayed hasan');assert.deepEqual(pageErrors,[]);passed++;
    }catch(e){failures.push({slug,error:String(e).slice(0,400)});}}}finally{await page.close();}}
    await Promise.all([worker(),worker()]);
    engines.push({engine,version:browser.version(),passed,failed:failures.length,viewport:engine==='webkit'?'390×844':'1366×880',reducedMotion:true});
    console.log(`${engine}: ${passed}/${all.length} hydrated previews passed.`);if(failures.length)console.error(failures.slice(0,5));assert.equal(failures.length,0);
  }finally{await browser.close();}
}
await mkdir('docs/qa',{recursive:true});
await writeFile('docs/qa/template-render-check.json',JSON.stringify({checkedAt:new Date().toISOString(),scope:'Published built-in routes: HTTP status, React hydration, non-empty heading, viewport overflow, shared footer text and uncaught browser errors. This is not physical-device or external-service certification.',templates:all.length,engines},null,2)+'\n');
