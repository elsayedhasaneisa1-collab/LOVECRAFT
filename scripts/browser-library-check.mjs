import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
const base=process.env.CHECK_BASE_URL||'http://127.0.0.1:3000';
const reports=[];
await mkdir('/tmp/lovecraft-review',{recursive:true});
for(const name of (process.env.CHECK_ENGINES||'chromium,firefox,webkit').split(',')){
  const browser=await ({chromium,firefox,webkit}[name]).launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'ar-EG',reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.studio-card').count(),9);assert.equal(await page.locator('.studio-facts strong').first().innerText(),'110');
    assert(await page.locator('.banner-image').evaluate(i=>i.complete&&i.naturalWidth>0));
    if(name==='chromium')await page.screenshot({path:'/tmp/lovecraft-review/desktop.png'});
    await page.locator('.studio-card').first().locator('.save-template').click();
    await page.locator('.studio-rail').getByRole('button',{name:/المحفوظات/}).click();assert.equal(await page.locator('.studio-card').count(),1);
    await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.save-template').first().getAttribute('aria-pressed'),'true');
    await page.getByRole('textbox',{name:'ابحث عن قالب',exact:true}).fill('زفاف');
    assert(await page.locator('.studio-card').count()>0);await page.locator('.studio-search button').click();
    await page.locator('.library-tabs').getByRole('button',{name:'الألعاب',exact:true}).click();assert.equal(await page.locator('.card-category').first().innerText(),'الألعاب');
    await page.locator('.library-filter').click();await page.getByRole('combobox',{name:'فئة القالب',exact:true}).selectOption('premium');await page.locator('.filter-done').click();assert((await page.locator('.card-tier').allInnerTexts()).every(t=>t.includes('مميز')));
    await page.locator('.studio-rail').getByRole('button',{name:'دليل الاستخدام'}).click();assert(await page.locator('.studio-help').isVisible());await page.keyboard.press('Escape');
    await page.goto(base+'/preview/love-confession',{waitUntil:'networkidle'});await page.getByRole('button',{name:/اضغط لفضّ الختم/}).click();assert(await page.getByText('رسالة مفتوحة',{exact:true}).isVisible());
    const foot=page.locator('[data-lovecraft-global-footer] a');assert.equal(await foot.innerText(),'developed by elsayed hasan');assert.equal(new URL(await foot.getAttribute('href')).pathname,'/201550802408');
    await page.goto(base+'/preview/wedding-celebration',{waitUntil:'networkidle'});await page.getByRole('button',{name:/جرّب تأكيد الحضور/}).click();assert(await page.getByText(/لم يُرسل أي رد/).isVisible());
    await page.goto(base+'/preview/choose-your-box',{waitUntil:'networkidle'});await page.getByRole('button',{name:/الصندوق الذهبي/}).click();
    await page.goto(base+'/preview/msg-video-surprise',{waitUntil:'networkidle'});await page.getByRole('button',{name:'تشغيل العرض',exact:true}).click();assert(await page.getByRole('button',{name:'إيقاف العرض'}).isVisible());
    await page.goto(base+'/preview/social-links-hub',{waitUntil:'networkidle'});assert.equal(await page.locator('a[href="https://www.behance.net/"]').count(),1);
    await page.setViewportSize({width:390,height:844});await page.goto(base+'/',{waitUntil:'networkidle'});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    if(name==='chromium')await page.screenshot({path:'/tmp/lovecraft-review/mobile.png'});
    await page.getByRole('button',{name:'فتح القائمة'}).click();assert(await page.locator('.studio-mobile-rail').isVisible());await page.locator('.studio-mobile-rail .rail-collections button').nth(1).click();assert.equal(await page.locator('.card-category').first().innerText(),'المناسبات');
    assert.deepEqual(errors,[]);reports.push({engine:name,version:browser.version(),desktop:true,mobileViewport:true,libraryInteractions:true,representativePreviews:true,uncaughtErrors:errors.length});
    console.log(name+': search, filters, bookmarks, guide, preview interactions, mobile navigation passed.');
  }finally{await browser.close();}
}
console.log(JSON.stringify(reports,null,2));
