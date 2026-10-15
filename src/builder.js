(function fetchFlowBuilder(root) {
  'use strict';
  const names = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
  const operators = ['eq','ne','gt','ge','lt','le','like','not-like','begins-with','not-begin-with','ends-with','not-end-with','null','not-null','in','not-in','between','on','on-or-before','on-or-after','today','yesterday','tomorrow','last-x-days','next-x-days','eq-userid'];
  const noValue = new Set(['null','not-null','today','yesterday','tomorrow','eq-userid']);
  const multiValue = new Set(['in','not-in','between']);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const assertName = (value, label) => {
    const name = String(value || '').trim();
    if (!names.test(name)) throw Error(`${label} must be a valid Dataverse logical name (letters, digits and underscores).`);
    return name;
  };
  const fields = (value, label) => {
    const list = String(value || '').split(',').map(v => v.trim()).filter(Boolean);
    if (list.length > 80) throw Error(`${label}: at most 80 columns are supported.`);
    const unique = new Set();
    for (const field of list) { assertName(field, label); if (unique.has(field)) throw Error(`${label} has a duplicate column: ${field}`); unique.add(field); }
    return list;
  };
  function serialize(state) {
    const entity = assertName(state.entity, 'Primary table');
    const selected = fields(state.columns, 'Selected columns');
    if (!selected.length && !state.allColumns) throw Error('Select at least one column or enable all columns.');
    const top = String(state.top || '').trim();
    if (top && (!/^[1-9]\d*$/.test(top) || Number(top) > 5000)) throw Error('Top rows must be between 1 and 5000.');
    const indent = n => '  '.repeat(n);
    const output = [`<fetch${state.distinct ? ' distinct="true"' : ''}${top ? ` top="${top}"` : ''}>`,`  <entity name="${escape(entity)}">`];
    if (state.allColumns) output.push('    <all-attributes />');
    else selected.forEach(f => output.push(`    <attribute name="${escape(f)}" />`));
    if (state.filters?.length) {
      const type = state.filterType === 'or' ? 'or' : 'and';
      output.push(`    <filter type="${type}">`);
      for (const c of state.filters) {
        const attribute = assertName(c.attribute, 'Filter column');
        if (!operators.includes(c.operator)) throw Error(`Unsupported filter operator: ${c.operator}`);
        let xml = `      <condition attribute="${escape(attribute)}" operator="${escape(c.operator)}"`;
        if (noValue.has(c.operator)) output.push(xml + ' />');
        else if (multiValue.has(c.operator)) {
          const values = String(c.value || '').split(',').map(x => x.trim()).filter(Boolean);
          if (!values.length || values.length > 40) throw Error(`${c.operator} needs 1–40 comma-separated values.`);
          if (c.operator === 'between' && values.length !== 2) throw Error('Between requires two comma-separated values.');
          output.push(xml + '>');
          values.forEach(v => output.push(`        <value>${escape(v)}</value>`));
          output.push('      </condition>');
        } else {
          if (!String(c.value || '').trim()) throw Error(`Filter ${attribute} requires a value.`);
          output.push(xml + ` value="${escape(String(c.value).trim())}" />`);
        }
      }
      output.push('    </filter>');
    }
    if (state.orderColumn) output.push(`    <order attribute="${escape(assertName(state.orderColumn, 'Sort column'))}"${state.descending ? ' descending="true"' : ''} />`);
    if (state.join?.enabled) {
      const j = state.join;
      const table = assertName(j.entity, 'Related table');
      const from = assertName(j.from, 'Related table join column');
      const to = assertName(j.to, 'Primary table join column');
      const alias = j.alias ? ` alias="${escape(assertName(j.alias, 'Join alias'))}"` : '';
      const type = j.type === 'outer' ? 'outer' : 'inner';
      output.push(`    <link-entity name="${escape(table)}" from="${escape(from)}" to="${escape(to)}" link-type="${type}"${alias}>`);
      for (const f of fields(j.columns, 'Linked columns')) output.push(`${indent(3)}<attribute name="${escape(f)}" />`);
      output.push('    </link-entity>');
    }
    output.push('  </entity>','</fetch>');
    return output.join('\n');
  }
  function importSimple(xml) {
    if (typeof DOMParser === 'undefined') throw Error('Import is only supported in browsers.');
    if (xml.length > 250000 || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) throw Error('This XML cannot be safely imported.');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'fetch') throw Error('Paste valid FetchXML first.');
    const f = doc.documentElement, roots = Array.from(f.children).filter(x => x.localName === 'entity');
    if (roots.length !== 1) throw Error('Exactly one primary entity is required.');
    const e = roots[0], direct = (node,name) => Array.from(node.children).filter(x => x.localName === name);
    const allowedFetch = ['top','distinct','mapping','version','output-format'];
    if (Array.from(f.attributes).some(x => !allowedFetch.includes(x.name))) throw Error('Advanced FetchXML options are not editable in the basic builder. Keep using the XML editor to preserve them.');
    if (direct(e,'filter').length > 1 || direct(e,'order').length > 1 || direct(e,'link-entity').length > 1) throw Error('This query uses multiple filters, sorts or joins. Editing it visually could lose information.');
    if (direct(e,'link-entity').some(l => direct(l,'filter').length || direct(l,'link-entity').length || direct(l,'order').length)) throw Error('Nested linked filters or joins require the XML editor.');
    if (Array.from(e.children).some(x => !['attribute','all-attributes','filter','order','link-entity'].includes(x.localName))) throw Error('Advanced entity constructs require the XML editor.');
    const allowedAttr = el => Array.from(el.attributes).every(a => a.name === 'name');
    if (!direct(e,'attribute').every(allowedAttr) || direct(e,'link-entity').some(l=>!direct(l,'attribute').every(allowedAttr))) throw Error('Aggregate, group-by or aliased columns require the XML editor.');
    const filter = direct(e,'filter')[0], conds = filter ? Array.from(filter.children) : [];
    if (conds.some(c=>c.localName !== 'condition' || Array.from(c.attributes).some(a=>!['attribute','operator','value'].includes(a.name)) || !operators.includes(c.getAttribute('operator')||''))) throw Error('The filters contain advanced expressions not supported by the visual builder.');
    const s = {entity:e.getAttribute('name')||'',columns:direct(e,'attribute').map(a=>a.getAttribute('name')).join(', '),allColumns:!!direct(e,'all-attributes').length,distinct:f.getAttribute('distinct')==='true',top:f.getAttribute('top')||'',filterType:filter?.getAttribute('type')==='or'?'or':'and',filters:conds.map(c=>({attribute:c.getAttribute('attribute')||'',operator:c.getAttribute('operator')||'eq',value:multiValue.has(c.getAttribute('operator'))?Array.from(c.children).map(v=>v.textContent).join(', '):(c.getAttribute('value')||'')}))};
    const o = direct(e,'order')[0];s.orderColumn=o?.getAttribute('attribute')||'';s.descending=o?.getAttribute('descending')==='true';
    const l=direct(e,'link-entity')[0];
    s.join=l?{enabled:true,entity:l.getAttribute('name')||'',from:l.getAttribute('from')||'',to:l.getAttribute('to')||'',type:l.getAttribute('link-type')||'inner',alias:l.getAttribute('alias')||'',columns:direct(l,'attribute').map(a=>a.getAttribute('name')).join(', ')}:{enabled:false};
    serialize(s);
    return s;
  }
  function mount(container, options = {}) {
    if (!container) return;
    const $ = id => container.querySelector(`#${id}`);
    const rows = $('builder-filters');
    const inputs = ['builder-table','builder-columns','builder-all','builder-distinct','builder-top','builder-filter-type','builder-sort','builder-descending','builder-join','builder-join-table','builder-join-from','builder-join-to','builder-join-alias','builder-join-type','builder-join-columns'];
    let currentXML = '';
    const message = (m, error=false) => { $('builder-message').textContent=m; $('builder-message').classList.toggle('builder-error',error); };
    const addRow = (value={}) => {
      if (rows.children.length >= 25) return message('Maximum of 25 conditions.',true);
      const row = document.createElement('div');row.className='builder-filter-row';
      const attr=document.createElement('input');attr.type='text';attr.placeholder='Column logical name';attr.setAttribute('aria-label','Filter column');attr.value=value.attribute||'';
      const op=document.createElement('select');op.setAttribute('aria-label','Filter operator');
      operators.forEach(o=>{const opt=document.createElement('option');opt.value=o;opt.textContent=o;op.append(opt);});
      op.value=operators.includes(value.operator)?value.operator:'eq';
      const val=document.createElement('input');val.type='text';val.placeholder='Value (comma-separated for in / between)';val.setAttribute('aria-label','Filter value');val.value=value.value||'';
      const del=document.createElement('button');del.type='button';del.className='btn btn-ghost';del.textContent='Remove';del.setAttribute('aria-label','Remove filter condition');
      op.addEventListener('change',()=>{val.disabled=noValue.has(op.value);refresh();});
      del.addEventListener('click',()=>{row.remove();refresh();});[attr,val].forEach(e=>e.addEventListener('input',refresh));val.disabled=noValue.has(op.value);
      row.append(attr,op,val,del);rows.append(row);refresh();
    };
    const collect = () => ({
      entity:$('builder-table').value, columns:$('builder-columns').value, allColumns:$('builder-all').checked,
      distinct:$('builder-distinct').checked,top:$('builder-top').value,
      filterType:$('builder-filter-type').value,
      filters:Array.from(rows.children).map(r=>({attribute:r.children[0].value,operator:r.children[1].value,value:r.children[2].value})),
      orderColumn:$('builder-sort').value.trim(),descending:$('builder-descending').checked,
      join:{enabled:$('builder-join').checked,entity:$('builder-join-table').value,from:$('builder-join-from').value,to:$('builder-join-to').value,alias:$('builder-join-alias').value,type:$('builder-join-type').value,columns:$('builder-join-columns').value}
    });
    function refresh() {
      $('builder-columns').disabled=$('builder-all').checked;
      $('builder-join-fields').hidden=!$('builder-join').checked;
      try {
        currentXML=serialize(collect());$('builder-preview').textContent=currentXML;
        ['builder-apply','builder-copy','builder-download'].forEach(id=>$(id).disabled=false);message('Valid FetchXML · ready to use');
      } catch (err) {
        currentXML='';$('builder-preview').textContent='Complete the fields above to generate FetchXML.';
        ['builder-apply','builder-copy','builder-download'].forEach(id=>$(id).disabled=true);message(err.message,true);
      }
    }
    function fill(s) {
      $('builder-table').value=s.entity||'account';$('builder-columns').value=s.columns||'';
      $('builder-all').checked=!!s.allColumns;$('builder-distinct').checked=!!s.distinct;
      $('builder-top').value=s.top||'';$('builder-filter-type').value=s.filterType||'and';$('builder-sort').value=s.orderColumn||'';
      $('builder-descending').checked=!!s.descending;
      $('builder-join').checked=!!s.join?.enabled;
      $('builder-join-table').value=s.join?.entity||'';$('builder-join-from').value=s.join?.from||'';$('builder-join-to').value=s.join?.to||'';
      $('builder-join-alias').value=s.join?.alias||'';$('builder-join-type').value=s.join?.type==='outer'?'outer':'inner';$('builder-join-columns').value=s.join?.columns||'';
      rows.replaceChildren();(s.filters||[]).forEach(addRow);refresh();
    }
    inputs.forEach(id=>$(id).addEventListener('input',refresh));
    $('builder-add-filter').addEventListener('click',()=>addRow());
    $('builder-apply').addEventListener('click',()=>{if (currentXML) {options.onApply?.(currentXML);message('FetchXML applied to the editor and visualisation.');}});
    $('builder-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(currentXML);message('FetchXML copied.');}catch{message('Clipboard unavailable; select the XML preview or apply it to the editor.',true);}});
    $('builder-download').addEventListener('click',()=>{if(!currentXML)return;const url=URL.createObjectURL(new Blob([currentXML],{type:'application/xml;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='query.fetchxml.xml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);});
    $('builder-import').addEventListener('click',()=>{try{fill(importSimple(options.getXML?.()||''));message('Imported a supported simple query. Advanced constructs remain editable in the XML editor.');}catch(err){message('Import not applied: '+err.message,true);}});
    $('builder-reset').addEventListener('click',()=>fill({entity:'account',columns:'name, accountnumber',filters:[],filterType:'and',join:{enabled:false}}));
    let table='account';try{const data=new URLSearchParams(location.search).get('data');if(data&&data.length<1500){const parsed=JSON.parse(data);if(parsed&&names.test(parsed.entityName||''))table=parsed.entityName;}}catch{}
    fill({entity:table,columns:'',allColumns:true,filters:[],join:{enabled:false}});
  }
  const api={serialize,importSimple,mount,operators};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FetchXMLBuilder=api;
})(typeof window !== 'undefined' ? window : globalThis);
