/* FetchFlow: pure structural analysis. Does not execute queries. */
(function (root) {
  'use strict';
  const MAX_INPUT = 250000;
  const childElements = (parent, tag) => Array.from(parent?.children || parent?.childNodes || []).filter(n => n.nodeType === 1 && n.localName === tag);
  const attr = (n, name, fallback = '') => n?.getAttribute(name) ?? fallback;
  const bool = v => String(v).toLowerCase() === 'true';
  const pretty = s => String(s || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'}[c]));
  function parseFilter(node) {
    return {
      type: attr(node, 'type', 'and').toLowerCase() === 'or' ? 'or' : 'and',
      items: Array.from(node.children || node.childNodes || []).filter(e => e.nodeType === 1 && ['filter','condition'].includes(e.localName)).map(e => e.localName === 'filter' ? { kind: 'group', ...parseFilter(e) } : {
        kind: 'condition', attribute: attr(e, 'attribute'), entityName: attr(e,'entityname'), operator: attr(e,'operator','eq'),
        value: attr(e, 'value'), valueOf: attr(e,'valueof'), values: childElements(e, 'value').map(v => v.textContent?.trim() || ''),
        uitype: attr(e,'uitype'), uiName: attr(e,'uiname')
      })
    };
  }
  function parse(xml) {
    if (typeof xml !== 'string' || !xml.trim()) throw new Error('Paste some FetchXML or choose an example to begin.');
    if (xml.length > MAX_INPUT) throw new Error('FetchXML is larger than the 250 KB safety limit.');
    if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) throw new Error('DOCTYPE and ENTITY declarations are not supported for privacy and safety.');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const err = typeof doc.querySelector === 'function' ? doc.querySelector('parsererror') : doc.getElementsByTagName('parsererror')[0];
    if (err) throw new Error('The XML is not well-formed: ' + (err.textContent || '').slice(0, 200).replace(/\s+/g, ' '));
    const fetch = doc.documentElement;
    if (fetch?.localName !== 'fetch') throw new Error('The root element must be <fetch>.');
    const bases = childElements(fetch, 'entity');
    if (bases.length !== 1) throw new Error('FetchXML needs exactly one root <entity>.');
    const warnings = [];
    const nodes = [];
    let seq = 0;
    function readEntity(el, parentId = null, depth = 0) {
      if (depth > 18 || seq >= 80) throw new Error('The query exceeds the visualiser limit of 80 tables or 18 levels.');
      const id = 'e' + seq++;
      const name = attr(el, 'name');
      if (!name) throw new Error('An <entity> or <link-entity> has no name.');
      const kind = el.localName === 'entity' ? 'root' : 'linked';
      const node = {
        id, parentId, depth, kind, name, alias: attr(el, 'alias', name),
        from: attr(el, 'from'), to: attr(el, 'to'), linkType: kind === 'root' ? '' : attr(el,'link-type','inner').toLowerCase(),
        intersect: bool(attr(el,'intersect')), allAttributes: childElements(el,'all-attributes').length > 0,
        attributes: childElements(el,'attribute').map(a => ({
          name: attr(a,'name'), alias: attr(a,'alias'), aggregate: attr(a,'aggregate'), groupBy: bool(attr(a,'groupby')),
          dateGrouping: attr(a,'dategrouping'), distinct: bool(attr(a,'distinct'))
        })),
        filters: childElements(el,'filter').map(parseFilter),
        orders: childElements(el,'order').map(o => ({attribute:attr(o,'attribute'),alias:attr(o,'alias'),entityName:attr(o,'entityname'),descending:bool(attr(o,'descending'))})),
        children: []
      };
      nodes.push(node);
      if (kind === 'linked' && (!node.from || !node.to)) warnings.push(`The link to ${name} does not specify both from/to. Dataverse may infer a relationship; this visualiser cannot verify it.`);
      if (!['','inner','outer','natural','any','not any','all','not all','exists','in','matchfirstrowusingcrossapply'].includes(node.linkType)) warnings.push(`${name} uses an unfamiliar link-type: ${node.linkType}.`);
      if (['any','not any','all','not all','exists','in','matchfirstrowusingcrossapply'].includes(node.linkType)) warnings.push(`${name} uses ${node.linkType}, which may test related rows rather than return joined columns. Check the official FetchXML semantics.`);
      if (node.allAttributes || (node.attributes.length === 0 && kind === 'root')) warnings.push(`${name} selects all available columns; explicit columns are usually easier to maintain.`);
      for (const child of childElements(el,'link-entity')) node.children.push(readEntity(child, id, depth + 1).id);
      return node;
    }
    const main = readEntity(bases[0]);
    const options = Object.fromEntries(['top','count','page','distinct','aggregate','returntotalrecordcount','no-lock','mapping','latematerialize'].map(k => [k,attr(fetch,k)]));
    if (bool(options.aggregate) && bool(options.distinct)) warnings.push('Aggregate and distinct are both enabled: review the intended result carefully.');
    if (options.top && options.count) warnings.push('Both top and count are set; verify that this paging and limiting combination is supported.');
    if (nodes.some(n => n.filters.some(f => findCondition(f, c => c.entityName)))) warnings.push('Conditions with entityname may apply after a join, which differs from filters inside a link-entity.');
    return {nodes, rootId:main.id, options, warnings, xml};
  }
  function findCondition(group, test) { return group.items.some(i => i.kind === 'group' ? findCondition(i,test) : test(i)); }
  function filterText(group) {
    const parts = group.items.map(item => item.kind === 'group' ? '(' + filterText(item) + ')' : conditionText(item));
    return parts.join(` ${group.type.toUpperCase()} `) || '(empty filter)';
  }
  function conditionText(c) {
    let value = c.valueOf ? `column ${c.valueOf}` : c.values.length ? `[${c.values.join(', ')}]` : c.value !== '' ? `“${c.value}”` : '';
    const op = {'eq':'equals','ne':'does not equal','gt':'greater than','ge':'at least','lt':'less than','le':'at most','like':'matches','not-like':'does not match','null':'is empty','not-null':'is not empty','in':'is in','not-in':'is not in','between':'is between','on-or-after':'on or after','last-x-days':'in last N days','eq-userid':'equals current user','eq-userteams':'belongs to user teams'}[c.operator] || c.operator;
    return `${c.entityName ? c.entityName + '.' : ''}${c.attribute} ${op}${value ? ' ' + value : ''}`;
  }
  function outputColumns(model) {
    const items = [];
    model.nodes.forEach(n => {
      if(n.allAttributes || (n.attributes.length === 0 && n.kind === 'root')) items.push({source:n.alias, field:'*', label:`${n.alias}.*`, action:'all columns'});
      n.attributes.forEach(a => items.push({source:n.alias, field:a.name, label:a.alias || (n.kind === 'root' ? a.name : `${n.alias}.${a.name}`), action:a.aggregate || (a.groupBy ? 'group by' : 'selected')}));
    });
    return items;
  }
  function steps(model) {
    const result = [{title:`Start with ${model.nodes[0].name}`,detail:'Read rows from the primary Dataverse table.',kind:'source'}];
    model.nodes.slice(1).forEach(n => {
      const desc = `${n.linkType || 'inner'} link${n.from && n.to ? `: ${n.parentId ? (model.nodes.find(p=>p.id===n.parentId)?.alias || '') : ''}.${n.to} → ${n.alias}.${n.from}` : ': relationship not fully specified'}`;
      result.push({title:`Link ${n.name}`,detail:desc,kind:'join'});
    });
    model.nodes.forEach(n => n.filters.forEach(f => result.push({title:`Filter ${n.alias}`,detail:filterText(f)+(n.kind==='linked' ? ' · a linked-table filter may affect the join' : ''),kind:'filter'})));
    if(model.nodes.some(n=>n.attributes.some(a=>a.aggregate||a.groupBy)) || model.options.aggregate === 'true') result.push({title:'Group & calculate',detail:'Apply the requested groupings and aggregate expressions.',kind:'aggregate'});
    model.nodes.forEach(n => n.orders.forEach(o=>result.push({title:`Sort by ${o.attribute || o.alias}`,detail:`${o.descending ? 'Descending' : 'Ascending'}${o.entityName ? ' on ' + o.entityName : ''}`,kind:'sort'})));
    if(model.options.distinct === 'true') result.push({title:'Remove duplicate results',detail:'Distinct is enabled.',kind:'distinct'});
    if(model.options.top || model.options.count || model.options.page) result.push({title:'Limit or page',detail:[model.options.top && `top ${model.options.top}`,model.options.count && `page size ${model.options.count}`,model.options.page && `page ${model.options.page}`].filter(Boolean).join(' · '),kind:'limit'});
    result.push({title:'Return selected columns',detail:`${outputColumns(model).length} explicitly represented output field${outputColumns(model).length === 1 ? '' : 's'}${model.nodes.some(n=>n.allAttributes) ? ' including wildcard selection' : ''}.`,kind:'output'});
    return result;
  }
  function summary(model) {
    const root = model.nodes[0]; const joins = model.nodes.slice(1); const cols = outputColumns(model);
    const phrases = [`The query starts from the Dataverse ${root.name} table.`];
    joins.forEach(n=>phrases.push(`It connects to ${n.name} using a ${n.linkType || 'inner'} link${n.from && n.to ? `, matching ${model.nodes.find(p=>p.id===n.parentId)?.alias || 'parent'}.${n.to} with ${n.alias}.${n.from}` : ''}.`));
    const filters = model.nodes.flatMap(n=>n.filters.map(f=>`On ${n.alias}, keep rows where ${filterText(f)}.`));
    phrases.push(...filters);
    if(model.options.aggregate === 'true') phrases.push('This is an aggregate query, so output may be summarised rather than one row per source record.');
    if(model.options.distinct === 'true') phrases.push('Distinct is enabled to remove duplicate result combinations.');
    if(model.options.top) phrases.push(`The result is limited to at most ${model.options.top} rows.`);
    phrases.push(`The query describes ${cols.length} output fields${cols.some(c=>c.field==='*') ? ' (including wildcard columns)' : ''}.`);
    phrases.push('This is a structural interpretation, not a Dataverse execution plan. Record counts, permissions, relationships and performance cannot be verified without a connected environment.');
    return phrases;
  }
  function mermaid(model) {
    const lines = ['flowchart LR'];
    for(const n of model.nodes){lines.push(`  ${n.id}["${(n.name + (n.alias!==n.name ? ' as ' + n.alias : '')).replace(/["\\]/g,'')}"]`);if(n.parentId)lines.push(`  ${n.parentId} -->|"${(n.linkType + ' ' + n.to + ' = ' + n.from).replace(/["\\]/g,'')}"| ${n.id}`)}
    return lines.join('\n');
  }
  const api = {parse,steps,summary,filterText,conditionText,outputColumns,mermaid,pretty,esc};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  root.FetchXMLModel=api;
})(typeof window !== 'undefined' ? window : globalThis);