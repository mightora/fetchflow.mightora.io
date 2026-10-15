const {test,expect}=require('@playwright/test');const fs=require('node:fs'),path=require('node:path');const JSZip=require('../vendor/jszip.min.js');
const offline=()=>fs.readFileSync(path.resolve(__dirname,'../dist/offline/index.html'),'utf8');
test('offline page renders diagrams, switches examples and has no external requests',async({page})=>{
 const requests=[];const errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(offline());
 await expect(page.locator('#metric-tables')).toHaveText('2');
 await expect(page.locator('mightora-footer.portable-footer')).toHaveCount(1);
 await expect(page.locator('.diagram-visual svg')).toHaveCount(3);
 await page.locator('#examples').selectOption('aggregate');
 await expect(page.locator('#metric-fields')).toHaveText('3');
 await expect(page.locator('#process-diagram')).toContainText('Group');
 await page.locator('#fetchxml').fill('<fetch><entity name="account"><attribute name="name" /></entity></fetch>');
 await expect(page.locator('#metric-tables')).toHaveText('1');
 expect(requests.filter(x=>x.startsWith('http'))).toHaveLength(0);
 expect(errors).toHaveLength(0);
});
test('PPTX diagrams and DOCX tables remain editable native Office elements',async({page})=>{
 await page.setContent(offline());
 for(const [format,file] of [['pptx','ppt/slides/slide2.xml'],['docx','word/document.xml']]){
  const event=page.waitForEvent('download');await page.locator(`[data-export="${format}"]`).first().click();
  const dl=await event;const buffer=fs.readFileSync(await dl.path());const zip=await JSZip.loadAsync(buffer);const text=await zip.file(file).async('string');
  if(format==='pptx'){expect(text).toMatch(/<p:sp>/);expect(text).not.toMatch(/<p:pic>/);}else{expect(text).toMatch(/<w:tbl>/);expect(text).toMatch(/<w:tblGrid>/);}
 }
});
test('visual composer generates valid FetchXML without losing existing diagram features',async({page})=>{
 const requests=[];const errors=[];
 page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(offline());
 await page.locator('#builder-table').fill('account');
 await page.locator('#builder-all').uncheck();
 await page.locator('#builder-columns').fill('name, accountnumber');
 await page.locator('#builder-add-filter').click();
 await page.locator('.builder-filter-row input').first().fill('statecode');
 await page.locator('.builder-filter-row input').nth(1).fill('0');
 await page.locator('#builder-join').check();
 await page.locator('#builder-join-table').fill('contact');
 await page.locator('#builder-join-from').fill('parentcustomerid');
 await page.locator('#builder-join-to').fill('accountid');
 await page.locator('#builder-join-columns').fill('fullname');
 await expect(page.locator('#builder-preview')).toContainText('link-entity name="contact"');
 await expect(page.locator('#builder-apply')).toBeEnabled();
 await page.locator('#builder-apply').click();
 await expect(page.locator('#metric-tables')).toHaveText('2');
 await expect(page.locator('#metric-fields')).toHaveText('3');
 await expect(page.locator('#fetchxml')).toHaveValue(/statecode/);
 await page.locator('#builder-import').click();
 await expect(page.locator('#builder-preview')).toContainText('statecode');
 await page.locator('#builder-table').fill('bad table');
 await expect(page.locator('#builder-apply')).toBeDisabled();
 expect(requests.filter(x=>x.startsWith('http'))).toHaveLength(0);
 expect(errors).toHaveLength(0);
});




test('public footer keeps shared components and fixes root-relative Mightora links',async({page})=>{
 const online=fs.readFileSync(path.resolve(__dirname,'../dist/index.html'),'utf8');
 await page.route('**/*',route=>route.abort());
 await page.setContent(online);
 await expect(page.locator('mightora-footer .footer-bottom-links a')).toHaveCount(2);
 await page.evaluate(()=>{
   const footer=document.querySelector('mightora-footer');
   const main=document.createElement('div');
   main.className='footer-main';
   const link=document.createElement('a');
   link.id='footer-route-check';
   link.setAttribute('href','/about/');
   link.textContent='About Mightora';
   main.appendChild(link);
   footer.insertBefore(main,footer.firstChild);
 });
 await expect(page.locator('#footer-route-check')).toHaveAttribute('href','https://mightora.io/about/');
});

test('public site shows direct web-resource downloads and model-driven app installation steps',async({page})=>{
 const online=fs.readFileSync(path.resolve(__dirname,'../dist/index.html'),'utf8');
 await page.route('**/*',route=>route.abort());
 await page.setContent(online);
 const install=page.locator('#model-driven');
 await expect(install).toBeVisible();
 await expect(page.locator('.quick-jump-nav a[href="#model-driven"]')).toHaveCount(1);
 await expect(install.locator('.install-steps li')).toHaveCount(6);
 await expect(install.locator('a[download="mightora_fetchflow_builder.html"]')).toHaveAttribute('href','dataverse/mightora_fetchflow_builder.html');
 await expect(install.locator('a[href="downloads/Mightora-FetchFlow-Dataverse.zip"]')).toHaveCount(1);
 await expect(install).toContainText('not an importable Dataverse solution ZIP');
 await expect(install).toContainText('Show in navigation');
 const matchingHTML=fs.readFileSync(path.resolve(__dirname,'../dist/dataverse/mightora_fetchflow_builder.html'),'utf8');
 expect(matchingHTML).toContain('id="builder-view"');
});
test('installation instructions work on narrow mobile layouts',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const online=fs.readFileSync(path.resolve(__dirname,'../dist/index.html'),'utf8');
 await page.route('**/*',route=>route.abort());
 await page.setContent(online);
 const install=page.locator('#model-driven');
 await install.scrollIntoViewIfNeeded();
 await expect(install).toBeVisible();
 await expect(install.locator('.install-steps li')).toHaveCount(6);
 const bounds=await install.boundingBox();
 expect(bounds).not.toBeNull();
 expect(bounds.width).toBeLessThanOrEqual(390);
});

test('Mightora footer navigation remains visible even when shared scripts or YAML are unavailable',async({page})=>{
 const online=fs.readFileSync(path.resolve(__dirname,'../dist/index.html'),'utf8');
 await page.route('**/*',route=>route.abort());
 await page.setContent(online);
 const footer=page.locator('mightora-footer');
 await expect(footer.locator('.footer-fallback')).toBeVisible();
 await expect(footer.locator('.footer-fallback .footer-col')).toHaveCount(3);
 await expect(footer.locator('.footer-fallback .footer-links a').first()).toBeVisible();
 await expect(footer.locator('.footer-fallback .footer-links a[href="https://mightora.io/tools/"]')).toBeVisible();
 await expect(footer.locator('.footer-fallback .footer-links a[href="https://mightora.io/privacy-policy/"]')).toBeVisible();
 const appearance=await footer.locator('.footer-fallback .footer-links a').first().evaluate(a=>({
   color:getComputedStyle(a).color,visibility:getComputedStyle(a).visibility
 }));
 expect(appearance.visibility).toBe('visible');
 expect(appearance.color).not.toBe('rgb(23, 50, 68)');
 await page.evaluate(()=>{
   const footer=document.querySelector('mightora-footer');
   const wrapper=document.createElement('div');
   wrapper.className='container';
   wrapper.innerHTML='<div class="footer-main"><div class="footer-col"><ul class="footer-links"><li><a href="/about/">About</a></li></ul></div></div>';
   footer.prepend(wrapper);
 });
 await expect(footer.locator(':scope > .footer-fallback')).toBeHidden();
 await expect(footer.locator(':scope > .container > .footer-main .footer-links a')).toHaveAttribute('href','https://mightora.io/about/');
 await expect(footer.locator(':scope > .container > .footer-main .footer-links a')).toBeVisible();
});
test('shared Mightora footer YAML intercept keeps valid list and field indentation',async({page})=>{
 const online=fs.readFileSync(path.resolve(__dirname,'../dist/index.html'),'utf8');
 const yaml='sections:\\n  - title: "Site"\\n    column: 1\\n    position: 1\\n    links:\\n      - name: "About"\\n        url: "/about/"\\n';
 await page.route('**/*',route=>{
   if(route.request().url().endsWith('/footer.yaml')){
     return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'text/plain'},body:yaml});
   }
   return route.abort();
 });
 await page.setContent(online);
 const response=await page.evaluate(async()=>{
   const r=await fetch('https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/footer.yaml');
   return r.text();
 });
 expect(response).toBe(yaml);
});
test('fallback footer navigation is readable on mobile widths',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const online=fs.readFileSync(path.resolve(__dirname,'../dist/index.html'),'utf8');
 await page.route('**/*',route=>route.abort());
 await page.setContent(online);
 const footer=page.locator('mightora-footer');
 await footer.scrollIntoViewIfNeeded();
 await expect(footer.locator('.footer-fallback .footer-col')).toHaveCount(3);
 await expect(footer.locator('.footer-fallback .footer-links a').first()).toBeVisible();
 const width=await footer.evaluate(el=>el.getBoundingClientRect().width);
 expect(width).toBeLessThanOrEqual(390);
});



