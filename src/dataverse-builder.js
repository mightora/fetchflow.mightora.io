(function(root){
'use strict';
const M=root.FetchFlowQueryDesignerModel, X=root.FetchXMLModel, Diagrams=root.FetchXMLDiagrams;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels=o=>o?.UserLocalizedLabel?.Label||o?.LocalizedLabels?.[0]?.Label||'';
const nameRx=/^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const maxRecords=50;
let xrm=null,origin='',tableList=[],activeId='root',nextId=1,manualXML=null;
let nodes=[{id:'root',parent:null,table:'account',fields:[],filters:[],filterType:'and',linkType:'inner',from:'',to:'',alias:''}];
let attributes=new Map(),relationships=new Map(),loadingSchema=new Map(),resultRun=0;
const state=()=>({nodes,top:Number($('query-top').value)||50,sort:$('query-sort').value.trim(),distinct:$('query-distinct').checked,descending:$('query-order').value==='desc'});
const node=id=>nodes.find(n=>n.id===id);
const selected=()=>node(activeId)||nodes[0];
const updateStatus=(id,msg,bad=false)=>{const el=$(id);if(el){el.textContent=msg;el.classList.toggle('error',bad);}};
const option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
function context(){
 let host=null;
 try{host=root.Xrm||root.parent?.Xrm||root.top?.Xrm;}catch{}
 if(!host?.WebApi?.online?.retrieveMultipleRecords||!host?.Utility?.getGlobalContext)return null;
 try{
  const url=new URL(host.Utility.getGlobalContext().getClientUrl());
  if(url.origin!==root.location.origin)return null;
  return {api:host,origin:url.origin};
 }catch{return null;}
}
async function apiGet(path){
 if(!origin)throw Error('Open this web resource in your model-driven app.');
 const url=new URL('/api/data/v9.2/'+path,origin);
 if(url.origin!==root.location.origin)throw Error('Cross-origin metadata requests are blocked.');
 const res=await fetch(url.href,{credentials:'same-origin',headers:{'Accept':'application/json','OData-Version':'4.0','OData-MaxVersion':'4.0'}});
 if(!res.ok){
  let message='Metadata request failed ('+res.status+').';
  try{const data=await res.json();message=data.error?.message||message;}catch{}
  throw Error(message);
 }
 return res.json();
}
async function loadTables(){
 if(!origin)return;
 updateStatus('metadata-status','Loading Dataverse table definitions…');
 try{
  let url='EntityDefinitions?$select=LogicalName,DisplayName,IsPrivate',items=[];
  // Follow continuation links only on the current Dataverse origin.
  for(let page=0;page<10&&url;page++){
   const data=await apiGet(url);
   items=items.concat(data.value||[]);
   const next=data['@odata.nextLink'];
   if(next){const u=new URL(next,origin);if(u.origin!==origin||!u.pathname.includes('/api/data/v9.2/'))throw Error('Unexpected metadata continuation origin.');url=u.pathname.split('/api/data/v9.2/')[1]+u.search;}
   else url='';
  }
  tableList=items.filter(t=>nameRx.test(t.LogicalName||'')&&!t.IsPrivate).map(t=>({name:t.LogicalName,label:labels(t.DisplayName)||t.LogicalName})).sort((a,b)=>a.label.localeCompare(b.label));
  $('all-tables').replaceChildren(...tableList.map(t=>option(t.name,t.label)));
  showTables();
  updateStatus('metadata-status',tableList.length+' tables available. Pick one to start.');
  if(tableList.some(t=>t.name==='account')){await loadFields('account');renderFields();}
 }catch(e){updateStatus('metadata-status',e.message,true);}
}
function showTables(){
 const term=$('table-search').value.toLowerCase().trim(),picker=$('tables'),old=picker.value;
 const matches=tableList.filter(t=>(t.label+' '+t.name).toLowerCase().includes(term)).slice(0,400);
 picker.replaceChildren(...matches.map(t=>option(t.name,t.label+' · '+t.name)));
 if(matches.some(t=>t.name===old))picker.value=old;
 else if(matches.some(t=>t.name===selected().table))picker.value=selected().table;
 $('set-root').disabled=!picker.value;
}
async function loadFields(table){
 if(!nameRx.test(table))return [];
 if(attributes.has(table))return attributes.get(table);
 if(loadingSchema.has(table))return loadingSchema.get(table);
 const pending=(async()=>{
  const data=await apiGet("EntityDefinitions(LogicalName='"+table+"')/Attributes?$select=LogicalName,DisplayName,AttributeType,IsValidForRead");
  const fields=(data.value||[]).filter(v=>nameRx.test(v.LogicalName||'')&&v.IsValidForRead!==false)
   .map(v=>({name:v.LogicalName,label:labels(v.DisplayName)||v.LogicalName,type:v.AttributeType||''})).sort((a,b)=>a.label.localeCompare(b.label));
  attributes.set(table,fields);return fields;
 })();
 loadingSchema.set(table,pending);
 try{return await pending;}finally{loadingSchema.delete(table);}
}
async function loadRelations(table){
 if(!nameRx.test(table)||!origin)return [];
 if(relationships.has(table))return relationships.get(table);
 const paths=['OneToManyRelationships','ManyToOneRelationships'];
 const rs=await Promise.allSettled(paths.map(segment=>apiGet("EntityDefinitions(LogicalName='"+table+"')/"+segment+'?$select=SchemaName,ReferencingEntity,ReferencedEntity,ReferencingAttribute,ReferencedAttribute')));
 let all=[];
 rs.forEach((r,i)=>{
  if(r.status!=='fulfilled')return;
  (r.value.value||[]).forEach(item=>{
   const linked=i===0?item.ReferencingEntity:item.ReferencedEntity;
   const from=i===0?item.ReferencingAttribute:item.ReferencedAttribute;
   const to=i===0?item.ReferencedAttribute:item.ReferencingAttribute;
   if([linked,from,to].every(x=>nameRx.test(x||''))&&!all.some(a=>a.table===linked&&a.from===from&&a.to===to))
     all.push({table:linked,from,to,name:item.SchemaName||linked});
  });
 });
 relationships.set(table,all.slice(0,1000));return relationships.get(table);
}
async function selectContext(id){
 if(!node(id))return;
 activeId=id;renderCanvas();renderFields();
 if(!origin)return;
 try{
  await loadFields(selected().table);
  if(activeId===id)renderFields();
 }catch(e){updateStatus('metadata-status',e.message,true);}
}
function renderFields(){
 const n=selected(),fields=attributes.get(n.table)||[],term=$('field-search').value.toLowerCase(),list=$('field-list');
 $('field-title').textContent=n.table||'Select a table';$('field-count').textContent=fields.length?fields.length+' fields':'';
 const found=fields.filter(f=>(f.label+' '+f.name).toLowerCase().includes(term)).slice(0,250);
 list.replaceChildren();
 if(!found.length){const p=document.createElement('p');p.className='help';p.textContent=origin?'No fields loaded or matching. Select a table and try again.':'Connect to Dataverse to drag available fields.';list.append(p);}
 found.forEach(f=>{
  const row=document.createElement('div');row.className='field-row';row.draggable=true;row.dataset.field=f.name;row.dataset.table=n.table;row.setAttribute('role','listitem');row.title='Drag into the query or click +';
  const name=document.createElement('div');name.className='field-name';
  const label=document.createElement('strong');label.textContent=f.label;const technical=document.createElement('small');technical.textContent=f.name+(f.type?' · '+f.type:'');
  name.append(label,technical);
  const add=document.createElement('button');add.className='field-add';add.type='button';add.dataset.field=f.name;add.setAttribute('aria-label','Add '+f.label+' to '+n.table);add.textContent='+';
  row.append(name,add);list.append(row);
 });
}
function fieldOptions(n,value){
 const fields=attributes.get(n.table)||[];
 const out=fields.map(f=>'<option value="'+esc(f.name)+'">'+esc(f.label)+' · '+esc(f.name)+'</option>').join('');
 return '<input class="filter-column" list="cols-'+esc(n.id)+'" data-prop="filter-attribute" value="'+esc(value)+'" placeholder="Column name" aria-label="Filter column"><datalist id="cols-'+esc(n.id)+'">'+out+'</datalist>';
}
const opOptions=current=>M.operators.map(op=>'<option value="'+op+'"'+(current===op?' selected':'')+'>'+op+'</option>').join('');
function renderCard(n){
 const rootNode=n.id==='root',isActive=n.id===activeId,links=nodes.filter(e=>e.parent===n.id).length;
 const outer=document.createElement('article');outer.className='query-card'+(isActive?' selected':'')+(rootNode?'':' link-card');outer.dataset.node=n.id;
 const choices=(relationships.get(node(n.parent)?.table)||[]).filter(r=>r.table===n.table);
 const relOpts=choices.length?choices.map((r,i)=>'<option value="'+i+'">'+esc(r.name)+' ('+esc(r.from)+' → '+esc(r.to)+')</option>').join(''):'';
 outer.innerHTML=`<div class="card-head"><div><span class="card-title">${rootNode?'Primary table':'Linked entity'} · ${esc(n.table)}</span><span class="card-subtitle">${rootNode?'Root data source':esc(node(n.parent)?.table||'')+' → '+esc(n.table)} · ${n.fields.length} selected fields · ${n.filters.length} filters</span></div><div class="card-actions"><button type="button" class="button mini" data-action="select">Show fields</button>${rootNode?'':'<button type="button" class="button mini" data-action="remove-node">Remove link</button>'}</div></div>
 <div class="card-body">
 ${rootNode?'':`<div class="field-config">
 <label>Linked table <input data-prop="table" list="all-tables" value="${esc(n.table)}" aria-label="Linked table logical name"></label>
 <label>From (linked column) <input data-prop="from" value="${esc(n.from)}" aria-label="Linked from column"></label>
 <label>To (parent column) <input data-prop="to" value="${esc(n.to)}" aria-label="Parent to column"></label>
 <label>Join <select data-prop="linkType"><option value="inner" ${n.linkType==='inner'?'selected':''}>Inner</option><option value="outer" ${n.linkType==='outer'?'selected':''}>Outer</option></select></label>
 <label>Alias <input data-prop="alias" value="${esc(n.alias)}" placeholder="Optional"></label>
 </div>
 ${relOpts?'<div class="relationship-options"><label class="field-label">Suggested relationships<select data-action="relationship"><option value="">Choose a relationship…</option>'+relOpts+'</select></label></div>':''}`}
 <div class="card-group"><h3>Selected fields</h3><div class="field-drop" data-drop="${esc(n.id)}" tabindex="0" aria-label="Drop fields into ${esc(n.table)}">
 ${n.fields.length?n.fields.map(f=>'<span class="chip">'+esc(f)+' <button type="button" data-action="remove-field" data-field="'+esc(f)+'" aria-label="Remove '+esc(f)+'">×</button></span>').join(''):'<span class="empty">Drag fields here, or choose <strong>Show fields</strong> then click +</span>'}
 </div></div>
 <div class="card-group"><div class="filter-bar"><h3>Filter conditions</h3><label>Match <select data-prop="filterType"><option value="and" ${n.filterType!=='or'?'selected':''}>ALL (AND)</option><option value="or" ${n.filterType==='or'?'selected':''}>ANY (OR)</option></select></label></div>
 <div class="filter-rows">${n.filters.map((c,i)=>'<div class="filter-row" data-index="'+i+'">'+fieldOptions(n,c.attribute)+'<select data-prop="filter-operator" aria-label="Filter operator">'+opOptions(c.operator)+'</select><input data-prop="filter-value" aria-label="Filter value" value="'+esc(c.value)+'" placeholder="Filter value" '+(M.noValue.has(c.operator)?'disabled':'')+'><button class="remove" type="button" data-action="remove-filter" aria-label="Remove condition">×</button></div>').join('')}</div>
 <div class="link-add"><button type="button" class="button mini" data-action="add-filter">+ Add condition</button><button type="button" class="button mini" data-action="add-link">+ Linked entity</button>${links?'<span class="help">'+links+' child links</span>':''}</div></div>
 </div>`;
 return outer;
}
function renderCanvas(){
 const canvas=$('query-canvas');canvas.replaceChildren();
 const rootNode=node('root');
 if(!rootNode){canvas.innerHTML='<div class="root-placeholder"><strong>Choose a table</strong>Search the tables on the left to begin.</div>';return;}
 // Query nodes are stored in parent-before-child order, supporting nesting.
 const visit=(id,level=0)=>{
  const n=node(id);if(!n||level>8)return;
  if(id!=='root'){const connector=document.createElement('p');connector.className='link-connector';connector.textContent='↳ '+n.linkType.toUpperCase()+' JOIN';canvas.append(connector);}
  canvas.append(renderCard(n));
  nodes.filter(item=>item.parent===id).forEach(c=>visit(c.id,level+1));
 };
 visit('root');
}
function show(view){
 ['builder','xml','results','visual'].forEach(key=>$(key==='builder'?'builder-view':key+'-view').hidden=key!==view);
 if(view==='xml'){if(!manualXML)updateXML();$('xml-source').value=manualXML||renderXML();}
 root.scrollTo?.({top:0,behavior:'instant'});
}
function renderXML(){return M.serialize(state());}
function updateXML(){
 try{
  const xml=renderXML();
  if(!manualXML)$('xml-source').value=xml;
  updateStatus('xml-status',manualXML?'Custom XML source is active; visual changes will require confirmation.':'Generated FetchXML is ready.');
  return xml;
 }catch(e){updateStatus('xml-status','Incomplete query: '+e.message,true);return '';}
}
function takeVisualEdit(){
 if(!manualXML)return true;
 if(!root.confirm('You have manually edited FetchXML. Changing the visual builder will replace your custom XML. Continue?'))return false;
 manualXML=null;$('xml-source').readOnly=true;$('edit-xml').textContent='Edit XML';return true;
}
function touch(){updateXML();}
function addField(table,field,targetId){
 const n=node(targetId);if(!n||n.table!==table)return updateStatus('metadata-status','Select a matching table card to add the field.',true);
 if(!takeVisualEdit())return;
 if(!nameRx.test(field))return;
 if(!n.fields.includes(field)){n.fields.push(field);renderCanvas();touch();}
}
async function changeTable(n,table){
 if(!nameRx.test(table)){updateStatus('metadata-status','Enter a valid Dataverse logical table name.',true);return;}
 if(!takeVisualEdit())return;
 n.table=table;n.fields=[];n.filters=[];renderCanvas();touch();
 if(!origin)return;
 try{await loadFields(table);if(activeId===n.id)renderFields();}catch(e){updateStatus('metadata-status',e.message,true);}
}
function addLink(parent){
 if(!takeVisualEdit())return;
 if(nodes.length>=15)return updateStatus('metadata-status','Maximum of 14 linked entities.',true);
 const suggestions=relationships.get(parent.table)||[];
 const first=suggestions[0];
 const n={id:'link'+nextId++,parent:parent.id,table:first?.table||'',fields:[],filters:[],filterType:'and',from:first?.from||'',to:first?.to||'',linkType:'inner',alias:''};
 if(!n.table)n.table=tableList.find(t=>t.name!==parent.table)?.name||'contact';
 nodes.push(n);activeId=n.id;renderCanvas();touch();
 if(origin){void loadFields(n.table).then(()=>{if(activeId===n.id)renderFields();}).catch(e=>updateStatus('metadata-status',e.message,true));}
}
async function loadRelationshipOptions(n){
 if(!origin)return;
 try{await loadRelations(n.table);renderCanvas();}catch(e){updateStatus('metadata-status',e.message,true);}
}
function initEvents(){
 $('tables').addEventListener('change',()=>{$('set-root').disabled=!$('tables').value;});
 $('table-search').addEventListener('input',showTables);
 $('field-search').addEventListener('input',renderFields);
 $('refresh-tables').addEventListener('click',()=>{tableList=[];void loadTables();});
 $('set-root').addEventListener('click',async()=>{
  const table=$('tables').value;if(!table)return;
  if((nodes.length>1||nodes[0].fields.length)&&table!==nodes[0].table&&!root.confirm('Replace the current query with '+table+'?'))return;
  if(!takeVisualEdit())return;
  nodes=[{id:'root',parent:null,table,fields:[],filters:[],filterType:'and',linkType:'inner',from:'',to:'',alias:''}];
  activeId='root';renderCanvas();touch();
  try{await loadFields(table);renderFields();}catch(e){updateStatus('metadata-status',e.message,true);}
 });
 $('field-list').addEventListener('click',e=>{
  const b=e.target.closest('.field-add');if(b){addField(selected().table,b.dataset.field,activeId);}
 });
 $('field-list').addEventListener('dragstart',e=>{
  const row=e.target.closest('.field-row');if(!row)return;
  e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('application/x-fetchflow-field',JSON.stringify({table:row.dataset.table,field:row.dataset.field}));
  e.dataTransfer.setData('text/plain',row.dataset.field);
 });
 const canvas=$('query-canvas');
 canvas.addEventListener('dragover',e=>{const drop=e.target.closest('[data-drop]');if(drop){e.preventDefault();e.dataTransfer.dropEffect='copy';drop.classList.add('active');}});
 canvas.addEventListener('dragleave',e=>{const drop=e.target.closest('[data-drop]');if(drop&&!drop.contains(e.relatedTarget))drop.classList.remove('active');});
 canvas.addEventListener('drop',e=>{
  const drop=e.target.closest('[data-drop]');if(!drop)return;
  e.preventDefault();drop.classList.remove('active');
  try{const payload=JSON.parse(e.dataTransfer.getData('application/x-fetchflow-field'));addField(payload.table,payload.field,drop.dataset.drop);}catch{updateStatus('metadata-status','Drag a field from the field list.',true);}
 });
 canvas.addEventListener('click',e=>{
  const button=e.target.closest('button[data-action]');if(!button)return;
  const card=button.closest('[data-node]'),n=node(card?.dataset.node);if(!n)return;
  const action=button.dataset.action;
  if(action==='select'){void selectContext(n.id);return;}
  if(!takeVisualEdit())return;
  if(action==='remove-node'){
   const children=new Set([n.id]);let change=true;
   while(change){change=false;nodes.forEach(x=>{if(children.has(x.parent)&&!children.has(x.id)){children.add(x.id);change=true;}});}
   nodes=nodes.filter(x=>!children.has(x.id));activeId='root';
  }else if(action==='remove-field'){n.fields=n.fields.filter(f=>f!==button.dataset.field);}
  else if(action==='remove-filter'){n.filters.splice(Number(button.closest('[data-index]')?.dataset.index),1);}
  else if(action==='add-filter'){if(n.filters.length>=25)return; n.filters.push({attribute:'',operator:'eq',value:''});}
  else if(action==='add-link'){void loadRelations(n.table).then(()=>addLink(n)).catch(()=>addLink(n));return;}
  renderCanvas();touch();
 });
 function changeInput(e){
  const target=e.target,card=target.closest('[data-node]'),n=node(card?.dataset.node);if(!n)return;
  const prop=target.dataset.prop;if(!prop)return;
  if(!takeVisualEdit()){renderCanvas();return;}
  const idx=Number(target.closest('[data-index]')?.dataset.index);
  if(prop==='filter-attribute')n.filters[idx].attribute=target.value.trim();
  else if(prop==='filter-operator'){n.filters[idx].operator=target.value;const value=target.closest('.filter-row')?.querySelector('[data-prop="filter-value"]');if(value)value.disabled=M.noValue.has(target.value);}
  else if(prop==='filter-value')n.filters[idx].value=target.value;
  else if(prop==='filterType')n.filterType=target.value;
  else if(prop==='table'){if(e.type==='change'){void changeTable(n,target.value.trim());}return;}
  else n[prop]=target.value;
  touch();
 }
 canvas.addEventListener('input',changeInput);canvas.addEventListener('change',e=>{
  const target=e.target;
  if(target.dataset.action==='relationship'){
   const n=node(target.closest('[data-node]')?.dataset.node),parent=node(n?.parent);
   if(!n||!parent||!target.value||!takeVisualEdit())return;
   const r=(relationships.get(parent.table)||[]).filter(x=>x.table===n.table)[Number(target.value)];
   if(r){n.from=r.from;n.to=r.to;renderCanvas();touch();}
  }else changeInput(e);
 });
 ['query-top','query-distinct','query-sort','query-order'].forEach(id=>$(id).addEventListener('input',()=>{if(takeVisualEdit())touch();}));
 $('reset-query').addEventListener('click',()=>{if(!root.confirm('Clear the current visual query?')||!takeVisualEdit())return;nodes=[{id:'root',parent:null,table:'account',fields:[],filters:[],filterType:'and',from:'',to:'',alias:'',linkType:'inner'}];activeId='root';renderCanvas();renderFields();touch();});
 $('btn-xml').addEventListener('click',()=>show('xml'));
 ['back-design','results-back','visual-back'].forEach(id=>$(id).addEventListener('click',()=>show('builder')));
 $('edit-xml').addEventListener('click',()=>{const field=$('xml-source');field.readOnly=!field.readOnly;$('edit-xml').textContent=field.readOnly?'Edit XML':'Finish editing';if(!field.readOnly){field.focus();manualXML=field.value;}});
 $('xml-source').addEventListener('input',()=>{if(!$('xml-source').readOnly){manualXML=$('xml-source').value;updateStatus('xml-status','Manual FetchXML mode. Execution and visualisation use this source.');}});
 $('import-xml').addEventListener('click',()=>{
  try{const imported=M.importXML($('xml-source').value);nodes=imported.nodes;nextId=1+nodes.length;activeId='root';manualXML=null;$('xml-source').readOnly=true;$('edit-xml').textContent='Edit XML';
  $('query-top').value=Math.min(50,imported.top||50);$('query-sort').value=imported.sort;$('query-distinct').checked=imported.distinct;$('query-order').value=imported.descending?'desc':'asc';renderCanvas();renderFields();touch();show('builder');
  }catch(e){manualXML=$('xml-source').value;updateStatus('xml-status','Visual import unavailable: '+e.message+' XML remains available in source mode.',true);}
 });
 $('copy-xml').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(currentXML());updateStatus('xml-status','Copied FetchXML to clipboard.');}catch(e){updateStatus('xml-status','Clipboard unavailable; select and copy the XML text.',true);}});
 $('download-xml').addEventListener('click',()=>{const xml=currentXML();if(!xml)return;const url=URL.createObjectURL(new Blob([xml],{type:'application/xml'})),a=document.createElement('a');a.href=url;a.download='fetchflow-query.xml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 $('btn-visualise').addEventListener('click',()=>{show('visual');try{
  const model=X.parse(currentXML());
  const entries=[['diagram-rel',Diagrams.relationship],['diagram-flow',Diagrams.pipeline],['diagram-fields',Diagrams.lineage]];
  entries.forEach(([id,fn])=>$(id).replaceChildren(fn(model)));
  updateStatus('visual-status',model.nodes.length+' tables analysed · visualisation generated locally.');
 }catch(e){['diagram-rel','diagram-flow','diagram-fields'].forEach(id=>$(id).replaceChildren());updateStatus('visual-status',e.message,true);}
 });
 $('btn-run').addEventListener('click',execute);
}
function currentXML(){try{return manualXML??renderXML();}catch(e){updateStatus('xml-status',e.message,true);return '';}}
async function execute(){
 if(!xrm)return updateStatus('metadata-status','Live execution requires a signed-in Dataverse model-driven app.',true);
 let query;
 try{query=M.forPreview(currentXML(),Number($('query-top').value)||50);}catch(e){show('xml');updateStatus('xml-status',e.message,true);return;}
 show('results');$('results-head').replaceChildren();$('results-body').replaceChildren();
 $('btn-run').disabled=true;const serial=++resultRun;
 updateStatus('results-status','Executing FetchXML against the current Dataverse environment…');
 try{
  const result=await xrm.WebApi.online.retrieveMultipleRecords(query.table,'?fetchXml='+query.xml,maxRecords);
  if(serial!==resultRun)return;
  const records=(result.entities||[]).slice(0,maxRecords);
  const columns=Array.from(new Set(records.flatMap(record=>Object.keys(record).filter(key=>!key.startsWith('@')&&!key.includes('@')).slice(0,50)))).slice(0,30);
  const tr=document.createElement('tr');columns.forEach(name=>{const th=document.createElement('th');th.textContent=name;th.scope='col';tr.append(th);});$('results-head').append(tr);
  records.forEach(record=>{const row=document.createElement('tr');columns.forEach(col=>{
   const cell=document.createElement('td'),raw=record[col+'@OData.Community.Display.V1.FormattedValue']??record[col];
   const value=raw===null||raw===undefined?'—':typeof raw==='object'?JSON.stringify(raw):String(raw);
   cell.textContent=value.length>350?value.slice(0,347)+'…':value;row.append(cell);
  });$('results-body').append(row);});
  $('results-summary').textContent=records.length+' records returned'+(result.nextLink||result.fetchXmlPagingCookie?' · more may be available':'');
  updateStatus('results-status',records.length?'Query executed successfully.':'Query executed successfully; no matching records.');
 }catch(e){$('results-summary').textContent='Execution failed';updateStatus('results-status',e.message||String(e),true);}
 finally{if(serial===resultRun)$('btn-run').disabled=false;}
}
function start(){
 initEvents();
 const ctx=context();
 if(ctx){xrm=ctx.api;origin=ctx.origin;$('connection').textContent='● Connected to Dataverse';$('connection').classList.add('ok');$('btn-run').disabled=false;void loadTables();}
 else{$('connection').textContent='Offline preview · no Dataverse';updateStatus('metadata-status','Open the HTML as a model-driven app web resource to browse metadata and execute queries.');}
 renderCanvas();renderFields();updateXML();
 const params=new URLSearchParams(root.location.search);
 try{const data=params.get('data');const parsed=data&&data.length<1500?JSON.parse(data):null;const name=parsed?.entityName||params.get('typename');if(nameRx.test(name||''))void changeTable(nodes[0],name);}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})(window);