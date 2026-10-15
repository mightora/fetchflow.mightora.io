(function(root){
'use strict';
const nameRx=/^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const operators=['eq','ne','gt','ge','lt','le','like','not-like','begins-with','not-begin-with','ends-with','not-end-with','null','not-null','in','not-in','between','today','yesterday','tomorrow','last-x-days','next-x-days','eq-userid'];
const noValue=new Set(['null','not-null','today','yesterday','tomorrow','eq-userid']);
const multiValue=new Set(['in','not-in','between']);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const check=(s,label)=>{if(!nameRx.test(s||''))throw Error(label+' must be a valid Dataverse logical name.');return s;};
function serialize(state){
 if(!state||!Array.isArray(state.nodes))throw Error('No query is available.');
 const nodes=state.nodes,base=nodes.find(n=>n.id==='root');
 if(!base)throw Error('Select a source table first.');
 if(nodes.length>15)throw Error('Maximum 14 linked tables.');
 const map=new Map(nodes.map(n=>[n.id,n]));
 if(map.size!==nodes.length)throw Error('Duplicate table ID.');
 const seen=new Set();
 let attrCount=0;
 function render(n,depth){
  if(depth>8)throw Error('Maximum eight relationship levels.');
  if(seen.has(n.id))throw Error('Cyclic table relationship detected.');
  seen.add(n.id);
  const ind='  '.repeat(depth),tbl=check(n.table,'Table');
  if(n.id!=='root'){check(n.from,'Linked from column');check(n.to,'Parent to column');if(n.alias)check(n.alias,'Alias');}
  const type=n.linkType==='outer'?'outer':'inner';
  const tag=n.id==='root'?'entity':'link-entity';
  const at=n.id==='root'?'':` from="${esc(n.from)}" to="${esc(n.to)}" link-type="${type}"${n.alias?' alias="'+esc(n.alias)+'"':''}`;
  const lines=[`${ind}<${tag} name="${esc(tbl)}"${at}>`];
  const unique=new Set(n.fields||[]);
  if(unique.size!==(n.fields||[]).length)throw Error('Duplicate selected column in '+tbl+'.');
  for(const f of n.fields||[]){check(f,'Column');if(++attrCount>100)throw Error('Select no more than 100 fields across the query.');lines.push(`${ind}  <attribute name="${esc(f)}" />`);}
  const conditions=n.filters||[];
  if(conditions.length>25)throw Error('At most 25 filters per table.');
  if(conditions.length){
   lines.push(`${ind}  <filter type="${n.filterType==='or'?'or':'and'}">`);
   for(const c of conditions){
    check(c.attribute,'Filter column');
    if(!operators.includes(c.operator))throw Error('Unsupported condition operator.');
    let condition=`${ind}    <condition attribute="${esc(c.attribute)}" operator="${esc(c.operator)}"`;
    if(noValue.has(c.operator))lines.push(condition+' />');
    else if(multiValue.has(c.operator)){
      const vals=String(c.value||'').split(',').map(v=>v.trim()).filter(Boolean);
      if(!vals.length||vals.length>40||(c.operator==='between'&&vals.length!==2))throw Error(c.operator+' requires '+(c.operator==='between'?'two':'one or more')+' values.');
      lines.push(condition+'>');
      vals.forEach(v=>lines.push(`${ind}      <value>${esc(v)}</value>`));
      lines.push(`${ind}    </condition>`);
    }else{
      if(String(c.value??'').trim()==='')throw Error('Enter a value for '+c.attribute+'.');
      lines.push(condition+` value="${esc(String(c.value).trim())}" />`);
    }
   }
   lines.push(`${ind}  </filter>`);
  }
  if(n.id==='root'&&state.sort){check(state.sort,'Sort column');lines.push(`${ind}  <order attribute="${esc(state.sort)}"${state.descending?' descending="true"':''} />`);}
  for(const link of nodes.filter(child=>child.parent===n.id))lines.push(...render(link,depth+1));
  lines.push(`${ind}</${tag}>`);
  return lines;
 }
 const top=Number(state.top||50);
 if(!Number.isInteger(top)||top<1||top>50)throw Error('Preview row limit must be 1 to 50.');
 const xml=[`<fetch count="${top}"${state.distinct?' distinct="true"':''}>`,...render(base,1),'</fetch>'].join('\n');
 if(seen.size!==nodes.length)throw Error('An unconnected linked table was found.');
 return xml;
}
function importXML(xml){
 if(typeof DOMParser==='undefined')throw Error('Import requires a browser.');
 if(!xml||xml.length>250000||/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml))throw Error('Invalid or oversized XML.');
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.querySelector('parsererror')||doc.documentElement.localName!=='fetch')throw Error('Invalid FetchXML.');
 const fetch=doc.documentElement;
 const direct=(e,tag)=>Array.from(e.children).filter(c=>c.localName===tag);
 const supported=(el,keys)=>Array.from(el.attributes).every(a=>keys.includes(a.name));
 if(!supported(fetch,['count','top','distinct','page','mapping','version','output-format'])||direct(fetch,'entity').length!==1)throw Error('Advanced FetchXML options require source mode.');
 let serial=1, nodes=[];
 function read(el,parent=null,level=0){
  if(level>8||nodes.length>=15)throw Error('Too many linked entities.');
  const isRoot=!parent;
  if(!supported(el,isRoot?['name']:['name','from','to','link-type','alias']))throw Error('Advanced entity settings require source mode.');
  if(Array.from(el.children).some(c=>!['attribute','filter','order','link-entity'].includes(c.localName)))throw Error('Advanced FetchXML constructs require source mode.');
  const filters=direct(el,'filter');
  if(filters.length>1||filters.some(f=>!supported(f,['type'])||Array.from(f.children).some(c=>c.localName!=='condition')))throw Error('Nested or advanced filters require source mode.');
  const f=filters[0];
  const cond=f?direct(f,'condition').map(c=>{
    if(!supported(c,['attribute','operator','value'])||!operators.includes(c.getAttribute('operator')||''))throw Error('Advanced conditions require source mode.');
    const vals=direct(c,'value');
    if(Array.from(c.children).some(child=>child.localName!=='value'))throw Error('Unsupported condition child.');
    return {attribute:c.getAttribute('attribute')||'',operator:c.getAttribute('operator')||'eq',value:vals.length?vals.map(v=>v.textContent).join(', '):c.getAttribute('value')||''};
  }):[];
  const attrs=direct(el,'attribute');
  if(attrs.some(a=>!supported(a,['name'])))throw Error('Aliased or aggregate fields require source mode.');
  if(!isRoot&&direct(el,'order').length)throw Error('Linked sort requires source mode.');
  const id=isRoot?'root':'link'+serial++;
  nodes.push({id,parent,table:el.getAttribute('name')||'',fields:attrs.map(a=>a.getAttribute('name')),from:el.getAttribute('from')||'',to:el.getAttribute('to')||'',linkType:el.getAttribute('link-type')||'inner',alias:el.getAttribute('alias')||'',filterType:f?.getAttribute('type')||'and',filters:cond});
  direct(el,'link-entity').forEach(l=>read(l,id,level+1));
 }
 read(direct(fetch,'entity')[0]);
 const orders=direct(direct(fetch,'entity')[0],'order');
 if(orders.length>1||orders.some(o=>!supported(o,['attribute','descending'])))throw Error('Complex sorting requires source mode.');
 const state={nodes,distinct:fetch.getAttribute('distinct')==='true',top:Number(fetch.getAttribute('count')||fetch.getAttribute('top')||50),sort:orders[0]?.getAttribute('attribute')||'',descending:orders[0]?.getAttribute('descending')==='true'};
 // Ensure we never silently drop attributes or advanced content on import.
 serialize(state);
 return state;
}
function forPreview(xml,count=50){
 if(typeof DOMParser==='undefined')throw Error('FetchXML requires browser DOM support.');
 if(typeof xml!=='string'||xml.length>250000||/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml))throw Error('Invalid or oversized FetchXML.');
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.querySelector('parsererror')||doc.documentElement.localName!=='fetch')throw Error('Enter valid FetchXML.');
 const e=Array.from(doc.documentElement.children).filter(c=>c.localName==='entity');
 if(e.length!==1)throw Error('Exactly one root entity is required.');
 const table=check(e[0].getAttribute('name'),'Root table');
 const f=doc.documentElement;
 const existingTop=f.getAttribute('top');
 if(existingTop!==null){
  const n=Number(existingTop);
  if(!Number.isInteger(n)||n<1)throw Error('Invalid top value.');
  f.setAttribute('top',String(Math.min(n,count,50)));
 }else{
  f.setAttribute('count',String(Math.min(count,50)));
  f.setAttribute('page','1');
  f.removeAttribute('paging-cookie');
 }
 return {table,xml:new XMLSerializer().serializeToString(doc)};
}
const api={serialize,importXML,forPreview,operators,noValue,multiValue};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.FetchFlowQueryDesignerModel=api;
})(typeof window!=='undefined'?window:globalThis);