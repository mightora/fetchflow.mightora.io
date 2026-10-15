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

test('Dataverse full-page resource is local, compact and preserves the visual builder',async({page})=>{
 const requests=[],errors=[];
 page.on('request',request=>requests.push(request.url()));
 page.on('pageerror',error=>errors.push(error.message));
 const dataverse=fs.readFileSync(path.resolve(__dirname,'../dist/dataverse/mightora_fetchflow_builder.html'),'utf8');
 await page.setContent(dataverse);
 await expect(page.locator('body')).toHaveClass(/dataverse-page/);
 await expect(page.locator('.dv-page-logo')).toHaveAttribute('src',new RegExp('^data:image/'));
 await expect(page.locator('.dv-page-heading h1')).toContainText('FetchFlow');
 await expect(page.locator('mightora-header, mightora-author')).toHaveCount(0);
 await expect(page.locator('mightora-footer.portable-footer.embedded-footer')).toHaveCount(1);
 await expect(page.locator('mightora-footer .footer-bottom-links a')).toHaveCount(3);
 await expect(page.locator('.hero')).toHaveCount(0);
 await expect(page.locator('#builder')).toBeVisible();
 await expect(page.locator('#metric-tables')).toHaveText('1');
 await page.locator('#builder-all').uncheck();
 await page.locator('#builder-columns').fill('name, accountnumber');
 await page.locator('#builder-apply').click();
 await expect(page.locator('#metric-fields')).toHaveText('2');
 await expect(page.locator('#fetchxml')).toHaveValue(/attribute name="accountnumber"/);
 await expect(page.locator('.diagram-visual svg')).toHaveCount(3);
 expect(requests.filter(url=>url.startsWith('http'))).toHaveLength(0);
 expect(errors).toHaveLength(0);
});
test('Dataverse full-page layout remains usable at tablet widths',async({page})=>{
 await page.setViewportSize({width:820,height:900});
 const dataverse=fs.readFileSync(path.resolve(__dirname,'../dist/dataverse/mightora_fetchflow_builder.html'),'utf8');
 await page.setContent(dataverse);
 await expect(page.locator('#builder-table')).toBeVisible();
 await expect(page.locator('#builder-preview')).toBeVisible();
 await expect(page.locator('#builder-apply')).toBeEnabled();
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
 expect(matchingHTML).toContain('window.__DATAVERSE_PAGE__=true;');
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
