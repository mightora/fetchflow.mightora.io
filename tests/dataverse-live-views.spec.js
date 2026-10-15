const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');

test('read existing Dataverse view FetchXML and execute it using signed-in WebApi',async({page})=>{
  const origin='https://test.crm.dynamics.com';
  const html=fs.readFileSync(path.resolve(__dirname,'../dist/dataverse/mightora_fetchflow_builder.html'),'utf8');
  await page.addInitScript(()=>{
    window.__readCalls=[];
    window.Xrm={
      Utility:{getGlobalContext:()=>({getClientUrl:()=>location.origin})},
      WebApi:{online:{retrieveMultipleRecords:async(entity,options,maxPageSize)=>{
        window.__readCalls.push({entity,options,maxPageSize});
        if(entity==='savedquery')return {entities:[
          {name:'Active Accounts',returnedtypecode:'account',fetchxml:'<fetch><entity name="account"><attribute name="name" /></entity></fetch>'}
        ]};
        if(entity==='userquery')return {entities:[]};
        return {entities:[{name:'Example company'}]};
      }}}
    };
  });
  await page.route(origin+'/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/WebResources/builder.html')return route.fulfill({status:200,contentType:'text/html',body:html});
    if(url.pathname.includes('/EntityDefinitions')){
      const payload=url.pathname.endsWith('/EntityDefinitions')
        ?{value:[{LogicalName:'account',DisplayName:{UserLocalizedLabel:{Label:'Account'}},IsPrivate:false}]}
        :{value:[{LogicalName:'name',DisplayName:{UserLocalizedLabel:{Label:'Account Name'}},IsValidForRead:true}]};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
    }
    return route.abort();
  });
  await page.goto(origin+'/WebResources/builder.html');
  await expect(page.locator('#dv-connection')).toContainText('Connected');
  await page.locator('#dv-refresh-views').click();
  await expect(page.locator('#dv-saved-views option')).toHaveCount(2);
  await page.locator('#dv-saved-views').selectOption('0');
  await page.locator('#dv-open-view').click();
  await expect(page.locator('#fetchxml')).toHaveValue(/attribute name="name"/);
  await expect(page.locator('#dv-query-source')).toHaveValue('editor');
  await page.locator('#dv-run-query').click();
  await expect(page.locator('#dv-query-status')).toContainText('succeeded');
  await expect(page.locator('#dv-result-count')).toContainText('1 row returned');
  const calls=await page.evaluate(()=>window.__readCalls);
  expect(calls.filter(x=>x.entity==='savedquery')).toHaveLength(1);
  expect(calls.filter(x=>x.entity==='userquery')).toHaveLength(1);
  const resultCalls=calls.filter(x=>x.entity==='account');
  expect(resultCalls).toHaveLength(1);
  expect(resultCalls[0].options).toContain('count="50"');
});
