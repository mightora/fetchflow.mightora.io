const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const html=()=>fs.readFileSync(path.resolve(__dirname,'../dist/dataverse/mightora_fetchflow_builder.html'),'utf8');
const base='https://test.crm.dynamics.com';
async function mockedDataverse(page){
 await page.addInitScript(()=>{
  window.__queryCalls=[];
  window.Xrm={
   Utility:{getGlobalContext:()=>({getClientUrl:()=>location.origin})},
   WebApi:{online:{retrieveMultipleRecords:async(entity,options,limit)=>{
     window.__queryCalls.push({entity,options,limit});
     return {entities:[{name:'Contoso',accountnumber:'C001'},{name:'North <script>alert(1)</script>',accountnumber:'N002'}]};
   }}}
  };
 });
 const label=value=>({UserLocalizedLabel:{Label:value}});
 await page.route(base+'/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/WebResources/builder.html')return route.fulfill({status:200,contentType:'text/html',body:html()});
  if(url.pathname.endsWith('/EntityDefinitions')){
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({value:[
    {LogicalName:'account',DisplayName:label('Account'),IsPrivate:false},
    {LogicalName:'contact',DisplayName:label('Contact'),IsPrivate:false}
   ]})});
  }
  if(url.pathname.endsWith('/Attributes')){
   const contact=url.pathname.includes('contact');
   const fields=contact?[['fullname','Full Name'],['lastname','Last Name'],['parentcustomerid','Parent Account']]:
    [['name','Name'],['accountnumber','Account Number'],['accountid','Account']];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({value:fields.map(([name,display])=>({LogicalName:name,DisplayName:label(display),IsValidForRead:true,AttributeType:'String'}))})});
  }
  if(url.pathname.endsWith('/OneToManyRelationships')){
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({value:[
    {SchemaName:'account_contacts',ReferencingEntity:'contact',ReferencedEntity:'account',ReferencingAttribute:'parentcustomerid',ReferencedAttribute:'accountid'}
   ]})});
  }
  if(url.pathname.endsWith('/ManyToOneRelationships'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({value:[]})});
  return route.abort();
 });
 await page.goto(base+'/WebResources/builder.html');
 await expect(page.locator('#connection')).toContainText('Connected to Dataverse');
 await expect(page.locator('#field-list .field-row')).toHaveCount(3);
}
test('builder shows only the clean query canvas, not the explorer panels',async({page})=>{
 await mockedDataverse(page);
 await expect(page.locator('.query-canvas .query-card')).toHaveCount(1);
 await expect(page.locator('#builder-view')).toBeVisible();
 for(const id of ['xml-view','results-view','visual-view'])await expect(page.locator('#'+id)).toBeHidden();
 await expect(page.locator('mightora-author,.hero,.quick-jump-nav')).toHaveCount(0);
});
test('drag fields onto base and linked entities, set filters, execute and inspect XML and diagrams',async({page})=>{
 await mockedDataverse(page);
 await page.locator('.field-row[data-field="name"]').dragTo(page.locator('[data-drop="root"]'));
 await expect(page.locator('[data-node="root"] .chip')).toContainText(['name']);
 await page.locator('[data-node="root"] [data-action="add-filter"]').click();
 await page.locator('[data-node="root"] [data-prop="filter-attribute"]').fill('accountnumber');
 await page.locator('[data-node="root"] [data-prop="filter-operator"]').selectOption('like');
 await page.locator('[data-node="root"] [data-prop="filter-value"]').fill('A%');
 await page.locator('[data-node="root"] [data-action="add-link"]').click();
 await expect(page.locator('.query-canvas .query-card')).toHaveCount(2);
 await expect(page.locator('[data-node="link1"] [data-prop="table"]')).toHaveValue('contact');
 await expect(page.locator('[data-node="link1"] [data-prop="from"]')).toHaveValue('parentcustomerid');
 await expect(page.locator('[data-node="link1"] [data-prop="to"]')).toHaveValue('accountid');
 await expect(page.locator('.field-row[data-field="fullname"]')).toBeVisible();
 await page.locator('.field-row[data-field="fullname"] .field-add').click();
 await expect(page.locator('[data-node="link1"] .chip')).toContainText(['fullname']);
 await page.locator('[data-node="link1"] [data-action="add-filter"]').click();
 await page.locator('[data-node="link1"] [data-prop="filter-attribute"]').fill('lastname');
 await page.locator('[data-node="link1"] [data-prop="filter-value"]').fill('Smith');
 await page.locator('#btn-xml').click();
 await expect(page.locator('#xml-view')).toBeVisible();
 await expect(page.locator('#xml-source')).toHaveValue(/link-entity name="contact"/);
 await expect(page.locator('#xml-source')).toHaveValue(/attribute="lastname" operator="eq" value="Smith"/);
 await page.locator('#btn-visualise').click();
 await expect(page.locator('#visual-view')).toBeVisible();
 await expect(page.locator('#diagram-rel svg')).toHaveCount(1);
 await expect(page.locator('#diagram-flow svg')).toHaveCount(1);
 await expect(page.locator('#diagram-fields svg')).toHaveCount(1);
 await page.locator('#btn-run').click();
 await expect(page.locator('#results-view')).toBeVisible();
 await expect(page.locator('#results-summary')).toContainText('2 records returned');
 await expect(page.locator('#results-table')).toContainText('Contoso');
 await expect(page.locator('#results-table script')).toHaveCount(0);
 const calls=await page.evaluate(()=>window.__queryCalls);
 expect(calls).toHaveLength(1);
 expect(calls[0].entity).toBe('account');
 expect(calls[0].limit).toBe(50);
 expect(calls[0].options).toContain('link-entity');
});
test('source editing preserves advanced XML when visual import cannot represent it',async({page})=>{
 await mockedDataverse(page);
 await page.locator('#btn-xml').click();
 await page.locator('#edit-xml').click();
 const advanced='<fetch aggregate="true"><entity name="account"><attribute name="accountid" aggregate="count" alias="total" /></entity></fetch>';
 await page.locator('#xml-source').fill(advanced);
 await page.locator('#import-xml').click();
 await expect(page.locator('#xml-status')).toContainText('Visual import unavailable');
 await expect(page.locator('#xml-source')).toHaveValue(advanced);
 await page.locator('#btn-run').click();
 await expect(page.locator('#results-status')).toContainText('successfully');
 const calls=await page.evaluate(()=>window.__queryCalls);
 expect(calls[0].options).toContain('aggregate="true"');
});
test('unconnected web resource remains usable for building but does not execute',async({page})=>{
 const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.setContent(html());
 await expect(page.locator('#connection')).toContainText('Offline preview');
 await expect(page.locator('#btn-run')).toBeDisabled();
 await expect(page.locator('#builder-view')).toBeVisible();
 await page.locator('#btn-xml').click();
 await expect(page.locator('#xml-source')).toHaveValue(/entity name="account"/);
 expect(requests.filter(u=>u.startsWith('http'))).toHaveLength(0);
});
test('mobile size retains controls, allows field add and shows XML',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await mockedDataverse(page);
 await expect(page.locator('#field-list .field-row').first()).toBeVisible();
 await page.locator('.field-row[data-field="accountnumber"] .field-add').click();
 await page.locator('#btn-xml').click();
 await expect(page.locator('#xml-source')).toHaveValue(/attribute name="accountnumber"/);
 const width=await page.evaluate(()=>document.documentElement.scrollWidth);
 expect(width).toBeLessThanOrEqual(405);
});
