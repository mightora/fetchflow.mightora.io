const {test}=require('node:test');
const assert=require('node:assert/strict');
const Query=require('../src/dataverse-builder-model.js');
const query=()=>({top:25,distinct:true,sort:'createdon',descending:true,nodes:[
 {id:'root',parent:null,table:'account',fields:['name','accountnumber'],filterType:'and',filters:[{attribute:'statecode',operator:'eq',value:'0'}]},
 {id:'link1',parent:'root',table:'contact',fields:['fullname'],from:'parentcustomerid',to:'accountid',linkType:'inner',alias:'person',filterType:'or',filters:[{attribute:'lastname',operator:'like',value:"O'Brian%"}]},
 {id:'link2',parent:'link1',table:'systemuser',fields:['fullname'],from:'systemuserid',to:'ownerid',linkType:'outer',alias:'user',filterType:'and',filters:[]}
]});
test('serializes multiple linked entities, nested relationships, filters and sorting',()=>{
 const xml=Query.serialize(query());
 assert.match(xml,/<fetch count="25" distinct="true">/);
 assert.match(xml,/<entity name="account">/);
 assert.match(xml,/<link-entity name="contact" from="parentcustomerid" to="accountid" link-type="inner" alias="person">/);
 assert.match(xml,/<link-entity name="systemuser" from="systemuserid" to="ownerid" link-type="outer" alias="user">/);
 assert.match(xml,/<filter type="or">/);
 assert.match(xml,/value="O&apos;Brian%"/);
 assert.match(xml,/<order attribute="createdon" descending="true"/);
});
test('supports multiple filter values and escapes XML safely',()=>{
 const state=query();state.nodes[0].filters=[{attribute:'name',operator:'in',value:'A&B, C<D'}];
 const xml=Query.serialize(state);
 assert.match(xml,/<value>A&amp;B<\/value>/);
 assert.match(xml,/<value>C&lt;D<\/value>/);
});
test('rejects invalid joins, unsafe identifiers and excessive query size',()=>{
 const state=query();state.nodes[1].from='invalid join';assert.throws(()=>Query.serialize(state),/logical name/);
 const state2=query();state2.nodes[1].parent='missing';assert.throws(()=>Query.serialize(state2),/unconnected/);
 const state3=query();state3.nodes[0].filters=[{attribute:'name',operator:'between',value:'one'}];
 assert.throws(()=>Query.serialize(state3),/two values/);
 const state4=query();state4.top=300;assert.throws(()=>Query.serialize(state4),/row limit/);
});
