(function FetchFlowDataverseLive(root){
  'use strict';
  // This module is bundled only into the Dataverse web resource. It never
  // requests credentials, calls external domains, or writes Dataverse data.
  const $=id=>document.getElementById(id);
  const logicalName=/^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
  const MAX_RESULTS=50, MAX_XML_LENGTH=250000, MAX_COLUMNS=25;
  const label=value=>(value&&value.UserLocalizedLabel&&value.UserLocalizedLabel.Label)
    ||(value&&value.LocalizedLabels&&value.LocalizedLabels[0]&&value.LocalizedLabels[0].Label)||'';
  const cleanName=(name)=>{
    if(!logicalName.test(name||''))throw Error('Use a valid Dataverse table logical name.');
    return name;
  };
  function getClient(){
    let xrm=null;
    try{xrm=root.Xrm||(root.parent&&root.parent.Xrm)||(root.top&&root.top.Xrm)||null;}catch{}
    if(!xrm||!xrm.WebApi||!xrm.Utility||typeof xrm.Utility.getGlobalContext!=='function')return null;
    try{
      const base=xrm.Utility.getGlobalContext().getClientUrl();
      const url=new URL(base);
      // Never accept an injected cross-origin URL for queries or metadata.
      if(url.origin!==root.location.origin)return null;
      return {xrm,base:url.origin};
    }catch{return null;}
  }
  function prepareQuery(xml){
    if(typeof xml!=='string'||!xml.trim()||xml.length>MAX_XML_LENGTH||/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml))throw Error('Provide safe FetchXML of at most 250 KB.');
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror')||doc.documentElement.localName!=='fetch')throw Error('This is not valid FetchXML.');
    const fetch=doc.documentElement;
    const entities=Array.from(fetch.children).filter(child=>child.localName==='entity');
    if(entities.length!==1)throw Error('FetchXML must have one primary entity.');
    const entity=cleanName(entities[0].getAttribute('name'));
    // Bound the preview without modifying the editable query.
    // Avoid adding count when top is present (top and paging cannot be combined).
    const top=fetch.getAttribute('top');
    if(top!==null){
      const n=Number(top);
      if(!Number.isInteger(n)||n<1)throw Error('Top must be a positive integer.');
      fetch.setAttribute('top',String(Math.min(n,MAX_RESULTS)));
    }else{
      fetch.setAttribute('count',String(MAX_RESULTS));
      fetch.setAttribute('page','1');
      fetch.removeAttribute('paging-cookie');
    }
    return {entity,xml:new XMLSerializer().serializeToString(doc)};
  }
  async function requestJson(client,path){
    const url=new URL('/api/data/v9.2/'+path,client.base);
    if(url.origin!==root.location.origin)throw Error('Metadata request must remain on the Dataverse host.');
    const response=await root.fetch(url.href,{method:'GET',credentials:'same-origin',headers:{
      'Accept':'application/json','OData-MaxVersion':'4.0','OData-Version':'4.0'
    }});
    if(!response.ok){
      const detail=await response.text().catch(()=>'');
      let message='Dataverse metadata request failed (HTTP '+response.status+').';
      try{const data=JSON.parse(detail);if(data.error&&data.error.message)message+=' '+data.error.message;}catch{}
      throw Error(message);
    }
    return response.json();
  }
  function displayResults(data){
    const result=$('dv-query-results'),head=$('dv-result-head'),body=$('dv-result-body');
    head.replaceChildren();body.replaceChildren();
    const entities=Array.isArray(data.entities)?data.entities:[];
    const keys=[];
    entities.forEach(row=>Object.keys(row).forEach(key=>{
      if(key.startsWith('@')||key.includes('@OData.')||key.includes('@odata.')||key.endsWith('@Microsoft.Dynamics.CRM.lookuplogicalname'))return;
      const plain=key.split('@')[0];
      if(plain && !keys.includes(plain) && keys.length<MAX_COLUMNS)keys.push(plain);
    }));
    if(keys.length){
      const tr=document.createElement('tr');
      keys.forEach(key=>{const th=document.createElement('th');th.scope='col';th.textContent=key;tr.append(th);});
      head.append(tr);
    }
    for(const row of entities){
      const tr=document.createElement('tr');
      keys.forEach(key=>{
        const td=document.createElement('td');
        const formatted=row[key+'@OData.Community.Display.V1.FormattedValue'];
        const value=formatted!==undefined?formatted:row[key];
        const shown=value===null||value===undefined?'—':typeof value==='object'?JSON.stringify(value):String(value);
        td.textContent=shown.length>240?shown.slice(0,237)+'…':shown;
        td.title=shown.length>240?'Value truncated for display':'';
        tr.append(td);
      });
      body.append(tr);
    }
    $('dv-result-count').textContent=entities.length+' row'+(entities.length===1?'':'s')+' returned';
    $('dv-result-more').textContent=data.nextLink||data.fetchXmlPagingCookie?'More rows may exist; only the first 50 are shown.':'First page · maximum 50 rows';
    result.hidden=false;
  }
  function init(){
    const panel=$('dataverse-live');
    if(!panel)return;
    const connection=$('dv-connection'),status=$('dv-schema-status'),queryStatus=$('dv-query-status');
    const tablePicker=$('dv-table-picker'),columns=$('dv-columns'),relations=$('dv-relationships');
    const useTable=$('dv-use-table'),reload=$('dv-refresh-columns'),useRelation=$('dv-use-relationship');
    const run=$('dv-run-query'),clear=$('dv-cancel-query');
    const savedViews=$('dv-saved-views'),refreshViews=$('dv-refresh-views'),openView=$('dv-open-view');
    const client=getClient();
    let tables=[],relationships=[],views=[],activeTable='',sequence=0,queryToken=0,loading=false;
    const report=(element,message,error=false)=>{element.textContent=message;element.classList.toggle('dv-live-error',error);};
    const emit=element=>element.dispatchEvent(new Event('input',{bubbles:true}));
    function setConnection(ok,message){connection.textContent=message;connection.classList.toggle('is-connected',ok);}
    function showTables(){
      const term=$('dv-table-search').value.trim().toLowerCase();
      const found=tables.filter(x=>x.name.includes(term)||x.label.toLowerCase().includes(term)).slice(0,250);
      const previous=tablePicker.value;
      tablePicker.replaceChildren();
      found.forEach(item=>{
        const opt=document.createElement('option');opt.value=item.name;opt.textContent=item.label+' ('+item.name+')';tablePicker.append(opt);
      });
      if(found.some(item=>item.name===previous))tablePicker.value=previous;
      else if(found.some(item=>item.name===$('builder-table').value))tablePicker.value=$('builder-table').value;
      useTable.disabled=!tablePicker.value;
      if(!found.length)report(status,'No matching tables. You can still enter a logical name directly in the builder.');
    }
    async function populateRelations(name,token){
      relations.replaceChildren();const initial=document.createElement('option');initial.value='';initial.textContent='Choose a relationship to populate the linked table';relations.append(initial);
      useRelation.disabled=true;relationships=[];
      const keys=['OneToManyRelationships','ManyToOneRelationships'];
      const responses=await Promise.allSettled(keys.map(x=>requestJson(client,"EntityDefinitions(LogicalName='"+name+"')/"+x+'?$select=SchemaName,ReferencingEntity,ReferencedEntity,ReferencingAttribute,ReferencedAttribute')));
      if(token!==sequence)return;
      const entries=[];
      responses.forEach((r,i)=>{
        if(r.status!=='fulfilled')return;
        (r.value.value||[]).forEach(item=>{
          const isOne=i===0;
          const linked=isOne?item.ReferencingEntity:item.ReferencedEntity;
          const from=isOne?item.ReferencingAttribute:item.ReferencedAttribute;
          const to=isOne?item.ReferencedAttribute:item.ReferencingAttribute;
          if(!logicalName.test(linked||'')||!logicalName.test(from||'')||!logicalName.test(to||''))return;
          if(entries.some(e=>e.linked===linked&&e.from===from&&e.to===to))return;
          entries.push({linked,from,to,display:(item.SchemaName||linked)+' · '+linked+' ('+from+' → '+to+')'});
        });
      });
      relationships=entries.slice(0,1000);
      relationships.forEach((x,i)=>{
        const opt=document.createElement('option');opt.value=String(i);opt.textContent=x.display;relations.append(opt);
      });
      if(!relationships.length)initial.textContent='No relationships available; enter join keys manually below';
    }
    async function loadColumns(name){
      cleanName(name);
      const token=++sequence;
      activeTable=name;report(status,'Loading columns and relationships for '+name+'…');
      columns.replaceChildren();
      try{
        const path="EntityDefinitions(LogicalName='"+name+"')/Attributes?$select=LogicalName,DisplayName,AttributeType,IsValidForRead";
        const payload=await requestJson(client,path);
        if(token!==sequence)return;
        const fields=(payload.value||[]).filter(f=>logicalName.test(f.LogicalName||'')&&f.IsValidForRead!==false)
          .map(f=>({name:f.LogicalName,label:label(f.DisplayName)||f.LogicalName,type:f.AttributeType||''}))
          .sort((a,b)=>a.label.localeCompare(b.label));
        fields.forEach(f=>{
          const o=document.createElement('option');o.value=f.name;o.textContent=f.label+' ('+f.name+')'+(f.type?' · '+f.type:'');columns.append(o);
        });
        // Metadata-assisted UX defaults to specific columns, not all-attributes.
        if(!$('builder-columns').value.trim()&&$('builder-all').checked){
          const defaults=fields.filter(f=>f.name==='name'||f.name==='fullname'||f.name==='accountnumber').slice(0,2);
          (defaults.length?defaults:fields.slice(0,2)).forEach(f=>{
            const option=Array.from(columns.options).find(o=>o.value===f.name);if(option)option.selected=true;
          });
          updateBuilderColumns();
        }else{
          const selected=new Set($('builder-columns').value.split(',').map(s=>s.trim()));
          Array.from(columns.options).forEach(opt=>{opt.selected=selected.has(opt.value);});
        }
        updateFieldSuggestions(fields);
        report(status,'Loaded '+fields.length+' readable columns from '+name+'. Choose columns or edit the visual builder below.');
        void populateRelations(name,token);
      }catch(err){if(token===sequence)report(status,err.message,true);}
    }
    function updateBuilderColumns(){
      if(columns.disabled)return;
      const names=Array.from(columns.selectedOptions).map(o=>o.value);
      if(!names.length)return;
      $('builder-all').checked=false;emit($('builder-all'));
      $('builder-columns').value=names.join(', ');emit($('builder-columns'));
    }
    function updateFieldSuggestions(fields){
      let list=$('dv-field-suggestions');
      if(!list){list=document.createElement('datalist');list.id='dv-field-suggestions';panel.append(list);}
      list.replaceChildren();
      fields.forEach(f=>{const opt=document.createElement('option');opt.value=f.name;opt.label=f.label;list.append(opt);});
      ['builder-columns','builder-sort','builder-join-to'].forEach(id=>$(id).setAttribute('list',list.id));
      document.querySelectorAll('.builder-filter-row input[aria-label="Filter column"]').forEach(x=>x.setAttribute('list',list.id));
    }
    async function loadTables(){
      report(status,'Discovering Dataverse tables…');
      try{
        const response=await requestJson(client,'EntityDefinitions?$select=LogicalName,DisplayName,IsPrivate');
        tables=(response.value||[]).filter(e=>logicalName.test(e.LogicalName||'')&&!e.IsPrivate)
          .map(e=>({name:e.LogicalName,label:label(e.DisplayName)||e.LogicalName}))
          .sort((a,b)=>a.label.localeCompare(b.label));
        if(!tables.length)throw Error('No readable table definitions returned.');
        showTables();
        reload.disabled=false;
        const initial=$('builder-table').value||'account';
        if(tables.some(t=>t.name===initial))tablePicker.value=initial;
        useTable.disabled=false;
        report(status,tables.length+' tables discovered. Choose a table or search above.');
        await loadColumns(initial);
      }catch(err){
        report(status,err.message+'. Check metadata permissions, or type logical names in the visual builder.',true);
        reload.disabled=false;
      }
    }
    async function loadViews(){
      refreshViews.disabled=true;
      report(status,'Reading accessible Dataverse view definitions…');
      // Read system and personal views separately: permission to read one
      // category does not guarantee access to the other.
      const queries=['savedquery','userquery'];
      const results=await Promise.allSettled(queries.map(entity=>client.xrm.WebApi.online.retrieveMultipleRecords(entity,
        '?$select=name,fetchxml,returnedtypecode&$orderby=name asc&$top=100',100)));
      views=[];
      results.forEach((result,index)=>{
        if(result.status!=='fulfilled')return;
        (result.value.entities||[]).forEach(view=>{
          if(typeof view.fetchxml!=='string'||!view.fetchxml.trim()||view.fetchxml.length>MAX_XML_LENGTH)return;
          views.push({name:view.name||'Unnamed view',source:queries[index]==='savedquery'?'System':'Personal',
            entity:view.returnedtypecode||'',xml:view.fetchxml});
        });
      });
      savedViews.replaceChildren();
      const placeholder=document.createElement('option');placeholder.value='';
      placeholder.textContent=views.length?'Select an accessible saved view':'No accessible views found';
      savedViews.append(placeholder);
      views.sort((a,b)=>a.name.localeCompare(b.name)).forEach((view,index)=>{
        const opt=document.createElement('option');opt.value=String(index);
        opt.textContent=view.source+' · '+view.name+(view.entity?' ('+view.entity+')':'');
        savedViews.append(opt);
      });
      openView.disabled=true;refreshViews.disabled=false;
      report(status,views.length?'Loaded '+views.length+' view definitions (up to 100 system and 100 personal). Select one to open its FetchXML.':
        'No accessible view definitions. Check user roles, or use the XML editor to paste a query.',!views.length);
    }
    async function executeQuery(){
      if(loading)return;
      let prepared;
      try{
        const xml=$('dv-query-source').value==='editor'?$('fetchxml').value:$('builder-preview').textContent;
        prepared=prepareQuery(xml);
      }catch(error){report(queryStatus,error.message,true);return;}
      const token=++queryToken;
      loading=true;run.disabled=true;clear.disabled=false;
      $('dv-query-results').hidden=true;
      report(queryStatus,'Executing read-only FetchXML as the current Dataverse user…');
      try{
        // IMPORTANT: Xrm.WebApi accepts raw, unencoded FetchXML in its options.
        const data=await client.xrm.WebApi.online.retrieveMultipleRecords(prepared.entity,'?fetchXml='+prepared.xml,MAX_RESULTS);
        if(token!==queryToken)return;
        displayResults(data);
        report(queryStatus,'Query succeeded. Preview is limited to the first 50 records.');
      }catch(error){
        if(token===queryToken)report(queryStatus,'Dataverse query failed: '+(error&&error.message||String(error)),true);
      }finally{
        if(token===queryToken){loading=false;run.disabled=false;clear.disabled=false;}
      }
    }
    columns.addEventListener('change',updateBuilderColumns);
    $('builder-add-filter').addEventListener('click',()=>{
      const list=$('dv-field-suggestions');
      if(list)document.querySelectorAll('.builder-filter-row input[aria-label="Filter column"]').forEach(x=>x.setAttribute('list',list.id));
    });
    $('dv-table-search').addEventListener('input',showTables);
    tablePicker.addEventListener('change',()=>{useTable.disabled=!tablePicker.value;});
    useTable.addEventListener('click',()=>{
      if(!tablePicker.value)return;
      $('builder-table').value=tablePicker.value;
      $('builder-columns').value='';$('builder-all').checked=true;emit($('builder-all'));emit($('builder-table'));
      loadColumns(tablePicker.value);
    });
    reload.addEventListener('click',()=>loadColumns($('builder-table').value.trim()));
    relations.addEventListener('change',()=>{useRelation.disabled=!relations.value;});
    useRelation.addEventListener('click',()=>{
      const r=relationships[Number(relations.value)];
      if(!r)return;
      $('builder-join').checked=true;emit($('builder-join'));
      const values={'builder-join-table':r.linked,'builder-join-from':r.from,'builder-join-to':r.to};
      Object.keys(values).forEach(id=>{$(id).value=values[id];emit($(id));});
      report(status,'Added relationship '+r.display+'. Review its join type and selected fields below.');
    });
    savedViews.addEventListener('change',()=>{openView.disabled=!savedViews.value;});
    refreshViews.addEventListener('click',()=>void loadViews());
    openView.addEventListener('click',()=>{
      const view=views[Number(savedViews.value)];
      if(!view)return;
      $('fetchxml').value=view.xml;
      $('dv-query-source').value='editor';
      $('example-name').textContent='Loaded '+view.source.toLowerCase()+' view: '+view.name;
      $('visualise').click();
      report(queryStatus,'Loaded '+view.source.toLowerCase()+' view "'+view.name+'" into the XML editor. Press Run to test it live.');
      $('workspace').scrollIntoView({behavior:'smooth',block:'start'});
    });
    run.addEventListener('click',executeQuery);
    clear.addEventListener('click',()=>{
      ++queryToken;loading=false;run.disabled=false;clear.disabled=true;$('dv-query-results').hidden=true;
      report(queryStatus,'Result preview cleared. FetchXML remains available in the builder and editor.');
    });
    if(!client||!client.xrm.WebApi.online||!client.xrm.WebApi.online.retrieveMultipleRecords){
      setConnection(false,'Dataverse not connected');
      report(status,'This edition must run as a web resource inside a signed-in model-driven app. No environment API is available here.',true);
      report(queryStatus,'Live execution is disabled outside Dataverse; the visual builder and Explorer remain available.');
      return;
    }
    setConnection(true,'Connected · current Dataverse user');
    run.disabled=false;
    refreshViews.disabled=false;
    void loadTables();
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={prepareQuery};
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
    else init();
  }
})(typeof window!=='undefined'?window:globalThis);
