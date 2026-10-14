const {test,expect}=require('@playwright/test');const fs=require('node:fs'),path=require('node:path');const JSZip=require('../vendor/jszip.min.js');
const offline=()=>fs.readFileSync(path.resolve(__dirname,'../dist/offline/index.html'),'utf8');
test('offline page renders diagrams, switches examples and has no external requests',async({page})=>{
 const requests=[];const errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(offline());
 await expect(page.locator('#metric-tables')).toHaveText('2');
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