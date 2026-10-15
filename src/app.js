(function(root){
  'use strict';
  const M=root.FetchXMLModel,D=root.FetchXMLDiagrams,E=root.FetchXMLExports;
  const $=id=>document.getElementById(id);
  let current=null,timeout=null,rendered={};
  const examples=root.FETCHXML_EXAMPLES||[];
  function announce(message){$('status').textContent=message;}
  function plain(id,content){$(id).textContent=String(content);}
  function setModel(model){
    current=model;
    const steps=M.steps(model),fields=M.outputColumns(model);
    plain('metric-tables',model.nodes.length);
    plain('metric-fields',fields.length);
    plain('metric-filters',model.nodes.reduce((sum,n)=>sum+n.filters.length,0));
    plain('metric-steps',steps.length);
    $('errors').hidden=true;
    $('analysis').hidden=false;
    const explanations=$('explanations');explanations.replaceChildren();
    M.summary(model).forEach((line,i)=>{const li=document.createElement('li');li.textContent=line;if(i===0)li.className='lead-explanation';explanations.append(li);});
    const warningBox=$('warnings'),list=$('warning-list');list.replaceChildren();warningBox.hidden=!model.warnings.length;
    model.warnings.forEach(w=>{const li=document.createElement('li');li.textContent=w;list.append(li);});
    const joins=$('join-list');joins.replaceChildren();model.nodes.forEach(n=>{const d=document.createElement('div');d.className='join-row';const b=document.createElement('strong');b.textContent=n.name;const s=document.createElement('span');s.textContent=n.kind==='root'?'Primary table':`${n.linkType} · ${model.nodes.find(p=>p.id===n.parentId)?.alias||'parent'}.${n.to||'?'} → ${n.alias}.${n.from||'?'}`;d.append(b,s);joins.append(d);});
    const output=$('output-list');output.replaceChildren();fields.forEach(c=>{const d=document.createElement('div');d.className='output-row';const b=document.createElement('strong');b.textContent=c.label;const s=document.createElement('span');s.textContent=`${c.source}.${c.field} · ${c.action}`;d.append(b,s);output.append(d);});
    const shapes=[['relationship','entity-diagram',D.relationship],['pipeline','process-diagram',D.pipeline],['lineage','lineage-diagram',D.lineage]];
    shapes.forEach(([key,id,fn])=>{const graph=fn(model);$(id).replaceChildren(graph);rendered[key]=graph;});
    $('raw-summary').textContent=`${model.nodes[0].name} · ${model.nodes.length-1} joins · ${fields.length} output fields`;
    announce('FetchXML visualised. Three diagrams and editable exports are ready.');
  }
  function visualise(){
    const xml=$('fetchxml').value;
    try{setModel(M.parse(xml));}catch(error){current=null;$('analysis').hidden=true;$('errors').hidden=false;$('error-message').textContent=error.message;announce('Unable to visualise this XML. '+error.message);}
  }
  function selectExample(id){const ex=examples.find(e=>e.id===id);if(!ex)return;$('fetchxml').value=ex.xml;$('example-name').textContent=ex.description;visualise();}
  async function runExport(action){
    if(!current){announce('Enter valid FetchXML before exporting.');return;}
    const btn=document.querySelector(`[data-export="${action}"]`);if(btn)btn.disabled=true;
    try{
      if(action==='pptx')await E.savePptx(current);
      if(action==='docx')await E.saveDocx(current);
      if(action==='json')await E.saveJson(current);
      if(action==='mermaid')await E.saveMermaid(current);
      if(action==='xml')await E.saveText($('fetchxml').value,'application/xml','query.fetchxml.xml');
      if(action.startsWith('svg-'))await E.saveSVG(rendered[action.slice(4)],`fetchxml-${action.slice(4)}`);
      if(action.startsWith('png-'))await E.savePNG(rendered[action.slice(4)],`fetchxml-${action.slice(4)}`);
      announce(`${action.toUpperCase()} export prepared.`);
    }catch(error){announce('Export failed: '+error.message);console.error('Export failed',error);}finally{if(btn)btn.disabled=false;}
  }
  function network(){
    const items=performance.getEntriesByType('resource').map(r=>{let url;try{url=new URL(r.name)}catch{return null}return {host:url.host,kind:r.initiatorType};}).filter(Boolean);
    const hosts=new Map();items.forEach(i=>hosts.set(i.host,(hosts.get(i.host)||0)+1));
    const list=$('network-domains');list.replaceChildren();
    if(root.__OFFLINE__){const li=document.createElement('li');li.textContent='Offline build: no network resources are required by the application.';list.append(li);} else if(!hosts.size){const li=document.createElement('li');li.textContent='No external resource timing entries visible to this page.';list.append(li);}else{hosts.forEach((count,host)=>{const li=document.createElement('li');li.textContent=`${host} · ${count} resource${count===1?'':'s'}`;list.append(li);});}
    plain('network-count',`${items.length} resource request${items.length===1?'':'s'} visible through the Performance API`);
  }
  function init(){
    const sample=$('examples');examples.forEach(e=>{const option=document.createElement('option');option.value=e.id;option.textContent=e.name;sample.append(option);});
    sample.addEventListener('change',()=>selectExample(sample.value));
    $('visualise').addEventListener('click',visualise);
    $('fetchxml').addEventListener('input',()=>{clearTimeout(timeout);timeout=setTimeout(visualise,420);});
    $('clear').addEventListener('click',()=>{$('fetchxml').value='';$('example-name').textContent='';visualise();$('fetchxml').focus();});
    $('format').addEventListener('click',()=>{try{const doc=new DOMParser().parseFromString($('fetchxml').value,'application/xml');if(doc.querySelector('parsererror'))throw Error('Fix XML errors before formatting.');const raw=new XMLSerializer().serializeToString(doc);let depth=0;const formatted=raw.replace(/>\s*</g,'>\n<').split('\n').map(line=>{if(/^<\//.test(line))depth=Math.max(0,depth-1);const out='  '.repeat(depth)+line;if(/^<[^!?/][^>]*[^/]>/i.test(line)&&!/<\/[^>]+>$/.test(line))depth++;return out;}).join('\n');$('fetchxml').value=formatted;visualise();}catch(e){announce(e.message);}});
    document.querySelectorAll('[data-export]').forEach(b=>b.addEventListener('click',()=>runExport(b.dataset.export)));
    $('copy-summary').addEventListener('click',async()=>{if(!current)return;try{await navigator.clipboard.writeText(M.summary(current).join('\n'));announce('Explanation copied.');}catch(e){announce('Clipboard not available here. Use the export options instead.');}});
    if(root.FetchXMLBuilder){
      root.FetchXMLBuilder.mount($('builder'),{
        getXML:()=> $('fetchxml').value,
        onApply:xml=>{ $('fetchxml').value=xml; $('example-name').textContent='Generated with the visual builder'; visualise(); $('workspace').scrollIntoView({behavior:'smooth',block:'start'}); }
      });
    }
    $('network-refresh').addEventListener('click',network);
    if(root.__OFFLINE__){
      const banner=$('offline-status');
      if(banner && !root.__DATAVERSE_PAGE__)banner.hidden=false;
      document.querySelectorAll('.online-only').forEach(x=>x.hidden=true);
    }
    if(root.__DATAVERSE_PAGE__){
      // Full-page app starts with the same simple query shown in the visual
      // composer, rather than an unrelated, advanced sample query.
      let entity='account';
      try{
        const params=new URLSearchParams(root.location.search);
        const context=params.get('data');
        const details=context&&context.length<=1500?JSON.parse(context):null;
        const candidate=details?.entityName||params.get('typename');
        if(/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(candidate||''))entity=candidate;
      }catch{}
      $('fetchxml').value=root.FetchXMLBuilder.serialize({entity,allColumns:true});
      $('example-name').textContent='Starter query — use the visual builder above to customise it.';
      sample.value='';
      visualise();
    }else{
      selectExample('account-contact');sample.value='account-contact';
    }
    network();setTimeout(network,1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);