const {test}=require('node:test');
const assert=require('node:assert/strict');
const Builder=require('../src/builder.js');
test('create a valid linked FetchXML query with encoded conditions',()=>{
 const xml=Builder.serialize({entity:'account',columns:'name,accountnumber',distinct:true,top:20,
 filters:[{attribute:'name',operator:'like',value:'A<&"%'},{attribute:'statecode',operator:'eq',value:'0'}],filterType:'and',
 orderColumn:'createdon',descending:true,
 join:{enabled:true,entity:'contact',from:'parentcustomerid',to:'accountid',alias:'related',type:'outer',columns:'fullname'}});
 assert.match(xml,/<fetch distinct="true" top="20">/);
 assert.match(xml,/value="A&lt;&amp;&quot;%"/);
 assert.match(xml,/link-entity name="contact" from="parentcustomerid" to="accountid" link-type="outer" alias="related"/);
 assert.match(xml,/<order attribute="createdon" descending="true"/);
});
test('reject missing root, invalid logical names and ambiguous empty fields',()=>{
 assert.throws(()=>Builder.serialize({entity:'bad table',columns:'name'}),/logical name/);
 assert.throws(()=>Builder.serialize({entity:'account',columns:''}),/Select at least one column/);
 assert.throws(()=>Builder.serialize({entity:'account',columns:'name,name'}),/duplicate/);
});
test('special operators support multi values but enforce correct count',()=>{
 const base={entity:'account',columns:'name',filters:[{attribute:'statecode',operator:'in',value:'0, 1'}]};
 assert.match(Builder.serialize(base),/<value>0<\/value>/);
 assert.match(Builder.serialize(base),/<value>1<\/value>/);
 assert.throws(()=>Builder.serialize({...base,filters:[{attribute:'createdon',operator:'between',value:'2020-01-01'}]}),/two/);
});
