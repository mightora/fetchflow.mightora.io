const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
let DOMParser;try{DOMParser=require('@xmldom/xmldom').DOMParser}catch{DOMParser=require('/usr/local/slides_js/node_modules/@xmldom/xmldom').DOMParser}
// Parse with a proper XML DOM in Node; browser supplies the built-in DOMParser.
global.DOMParser=DOMParser;
const M=require('../src/model.js');
const examples=JSON.parse(fs.readFileSync(path.join(__dirname,'../examples/examples.json'),'utf8'));
test('six anonymised worked examples all parse',()=>{assert.equal(examples.length,6);for(const ex of examples){const m=M.parse(ex.xml);assert.ok(m.nodes.length>=1,ex.name);assert.ok(M.summary(m).length>=2);assert.ok(M.steps(m).length>=2);assert.match(M.mermaid(m),/flowchart LR/);}});
test('join direction uses parent.to -> related.from',()=>{const m=M.parse(examples.find(x=>x.id==='account-contact').xml);const n=m.nodes[1];assert.equal(n.name,'contact');assert.equal(n.from,'contactid');assert.equal(n.to,'primarycontactid');assert.equal(n.linkType,'inner');assert.ok(M.steps(m)[1].detail.includes('account.primarycontactid → primarycontact.contactid'));});
test('field aliases and aggregate operations preserved',()=>{const m=M.parse(examples.find(x=>x.id==='aggregate').xml);assert.equal(m.options.aggregate,'true');const cols=M.outputColumns(m);assert.equal(cols.length,3);assert.equal(cols[1].label,'pipeline_total');assert.equal(cols[1].action,'sum');assert.equal(cols[0].action,'group by');});
test('nested OR in AND filter retained',()=>{const m=M.parse(examples.find(x=>x.id==='cases').xml);const txt=M.filterText(m.nodes[0].filters[0]);assert.match(txt,/ AND /);assert.match(txt,/ OR /);});
test('outer join post-join condition warned',()=>{const m=M.parse(examples.find(x=>x.id==='unmatched').xml);assert.ok(m.warnings.some(x=>x.includes('entityname')));});
test('rejects entity declarations and invalid root',()=>{assert.throws(()=>M.parse('<!DOCTYPE fetch [<!ENTITY x "yes">]><fetch/>'),/DOCTYPE/);assert.throws(()=>M.parse('<query/>'),/root element/i);assert.throws(()=>M.parse('<fetch/>'),/exactly one/i);});
test('plain language output does not expose unsupported execution assertions',()=>{const m=M.parse(examples[1].xml);assert.ok(M.summary(m).at(-1).includes('not a Dataverse execution plan'));});