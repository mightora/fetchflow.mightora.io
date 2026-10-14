(function(root){
 'use strict';
 const M=root.FetchXMLModel;
 const download=(blob,name)=>{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 const cleanName = str => String(str).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'fetchxml';
 const safe = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const xmlText = s => safe(String(s??'')).replace(/\n/g,'</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">');
 function sourceInfo(m){return {summary:M.summary(m),steps:M.steps(m),nodes:m.nodes,columns:M.outputColumns(m),warnings:m.warnings,options:m.options};}
 async function saveText(content,type,name){download(new Blob([content],{type}),name);}
 function saveJson(m){return saveText(JSON.stringify(sourceInfo(m),null,2),'application/json','fetchxml-analysis.json');}
 function saveMermaid(m){return saveText(M.mermaid(m),'text/plain;charset=utf-8','fetchxml-relationships.mmd');}
 function saveSVG(svg,name){const txt='<?xml version="1.0" encoding="UTF-8"?>\n'+svg.outerHTML;return saveText(txt,'image/svg+xml;charset=utf-8',name+'.svg');}
 async function savePNG(svg,name){
  const data=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'});const url=URL.createObjectURL(data);
  try{const image=new Image();await new Promise((res,rej)=>{image.onload=res;image.onerror=rej;image.src=url;});const canvas=document.createElement('canvas');canvas.width=+svg.getAttribute('width')*2;canvas.height=+svg.getAttribute('height')*2;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);await new Promise(res=>canvas.toBlob(blob=>{if(blob)download(blob,name+'.png');res();},'image/png'));}finally{URL.revokeObjectURL(url);}
 }
 const pptColours={ink:'173244',primary:'128B99',soft:'EBF6F6',muted:'526B7B',accent:'EF9C40',purple:'6954A2'};
 function box(slide,x,y,w,h,title,lines=[],accent=pptColours.primary){
  slide.addShape('roundRect',{x,y,w,h,rectRadius:0.08,radius:0.08,fill:{color:pptColours.soft},line:{color:accent,width:1.5}});
  slide.addText(title,{x:x+0.12,y:y+0.10,w:w-0.25,h:0.30,bold:true,fontFace:'Aptos',fontSize:14,color:pptColours.ink,margin:0,breakLine:false});
  if(lines.length)slide.addText(lines.filter(Boolean).join('\n'),{x:x+0.12,y:y+0.50,w:w-0.25,h:h-0.56,fontFace:'Aptos',fontSize:10,color:pptColours.muted,margin:0,breakLine:false,fit:'shrink'});
 }
 function header(slide,title,subtitle='Every element is an editable PowerPoint shape or text box'){
  slide.background={color:'FFFFFF'};
  slide.addText('MIGHTORA  /  FETCHXML VISUALISER',{x:0.55,y:0.22,w:12.0,h:0.25,fontFace:'Aptos',fontSize:10,bold:true,color:pptColours.primary,margin:0});
  slide.addText(title,{x:0.55,y:0.64,w:12.2,h:0.55,fontFace:'Aptos Display',fontSize:27,bold:true,color:pptColours.ink,margin:0});
  slide.addText(subtitle,{x:0.55,y:1.22,w:12.2,h:0.3,fontFace:'Aptos',fontSize:12,color:pptColours.muted,margin:0});
  slide.addShape('line',{x:0.55,y:1.63,w:12.15,h:0,line:{color:'D3E5E8',width:1}});
 }
 function link(slide,x1,y1,x2,y2,label){
  slide.addShape('line',{x:x1,y:y1,w:x2-x1,h:y2-y1,line:{color:pptColours.primary,width:1.8,beginArrowType:'none',endArrowType:'triangle'}});
  if(label)slide.addText(label,{x:(x1+x2)/2-0.4,y:(y1+y2)/2-0.3,w:0.95,h:0.20,fontSize:9,bold:true,color:pptColours.purple,margin:0,align:'center'});
 }
 function savePptx(m){
  const Pptx=root.PptxGenJS || root.pptxgen;
  if(typeof Pptx!=='function')throw Error('PowerPoint export library is not available.');
  const pptx=new Pptx();pptx.layout='LAYOUT_WIDE';pptx.author='Mightora · FetchFlow';pptx.subject='Editable FetchXML analysis';pptx.title='FetchXML explained';pptx.company='Mightora';pptx.lang='en-GB';
  let slide=pptx.addSlide();header(slide,'What this FetchXML query does','Plain English explanation · structural analysis, not live Dataverse execution');
  const paras=M.summary(m);paras.slice(0,8).forEach((p,i)=>box(slide,0.6,1.84+i*0.63,12.1,0.54,`${i+1}. ${p}`,[],i===0?pptColours.primary:'C5D5DC'));
  slide=pptx.addSlide();header(slide,'Where data comes from','Dataverse tables and relationship columns · arrows are native line shapes');
  const maxDepth=Math.max(...m.nodes.map(n=>n.depth));const usableY=1.95,maxRows=Math.max(...Array.from(new Set(m.nodes.map(n=>n.depth))).map(d=>m.nodes.filter(n=>n.depth===d).length));
  const ygap=Math.min(1.42,5.1/Math.max(1,maxRows)); const stepX=Math.min(3.65,10/Math.max(1,maxDepth));const xpos=d=>0.80+d*stepX;
  const pos=new Map();
  m.nodes.forEach(n=>{const group=m.nodes.filter(q=>q.depth===n.depth),idx=group.findIndex(q=>q.id===n.id),y=usableY+idx*ygap;pos.set(n.id,{x:xpos(n.depth),y});});
  m.nodes.filter(n=>n.parentId).forEach(n=>{const p=pos.get(n.parentId),b=pos.get(n.id);link(slide,p.x+2.55,p.y+0.55,b.x,b.y+0.55,n.linkType);});
  m.nodes.forEach(n=>{const p=pos.get(n.id);box(slide,p.x,p.y,2.55,1.05,n.name,[`alias: ${n.alias}`,n.kind==='root'?'PRIMARY SOURCE':`${n.linkType} · ${n.to||'?'} = ${n.from||'?'}`],n.kind==='root'?pptColours.primary:pptColours.purple);});
  if(maxRows<=3){
    slide.addText('HOW TO READ THE RELATIONSHIPS',{x:0.8,y:5.0,w:11.5,h:0.3,fontFace:'Aptos',fontSize:13,bold:true,color:pptColours.primary,margin:0});
    box(slide,0.8,5.45,3.65,1.0,'Primary source',['Start here: this is the query’s root Dataverse table.']);
    box(slide,4.76,5.45,3.65,1.0,'Join columns',['Parent.to matches related.from. Aliases label related fields.'],pptColours.purple);
    box(slide,8.72,5.45,3.65,1.0,'Join behaviour',['Inner joins require a match. Outer joins may retain unmatched primary records.'],pptColours.accent);
  }
  const steps=M.steps(m);const chunks=[];for(let i=0;i<steps.length;i+=7)chunks.push(steps.slice(i,i+7));
  chunks.forEach((c,page)=>{slide=pptx.addSlide();header(slide,`How the query works${chunks.length>1 ? ` (${page+1}/${chunks.length})`:''}`,'Editable flowchart · the conceptual sequence of operations');c.forEach((step,i)=>{const y=1.90+i*0.75;box(slide,0.85,y,11.25,0.60,`${i+page*7+1}. ${step.title}`,[],pptColours.primary);slide.addText(step.detail,{x:4.3,y:y+0.14,w:7.3,h:0.28,fontFace:'Aptos',fontSize:10,color:pptColours.muted,margin:0,fit:'shrink'});if(i<c.length-1)link(slide,6.5,y+0.60,6.5,y+0.74,'');});});
  const cols=M.outputColumns(m);const colsChunks=[];for(let i=0;i<cols.length;i+=12)colsChunks.push(cols.slice(i,i+12));
  colsChunks.forEach((arr,page)=>{slide=pptx.addSlide();header(slide,`Where each output field comes from${colsChunks.length>1 ? ` (${page+1}/${colsChunks.length})`:''}`,'Each field and source is a native editable text box');arr.forEach((c,i)=>{const col=i%2,row=Math.floor(i/2),x=0.65+col*6.2,y=1.90+row*0.85;box(slide,x,y,5.75,0.73,c.label,[`${c.source}.${c.field} → ${c.action}`],pptColours.primary);});});
  slide=pptx.addSlide();header(slide,'Assumptions and review points','The tool does not connect to a Dataverse environment or inspect actual table metadata.');
  const lines=m.warnings.length?m.warnings:['No structural warnings were identified by this visualiser.'];
  [...lines,'Always verify permissions, relationship definitions, query execution and performance in Dataverse.'].slice(0,11).forEach((w,i)=>box(slide,0.75,1.9+i*0.48,11.7,0.42,`• ${w}`,[],pptColours.accent));
  return pptx.writeFile({fileName:'fetchxml-editable-diagrams.pptx'});
 }
 const run=(text,bold=false)=>`<w:r>${bold?'<w:rPr><w:b/></w:rPr>':''}<w:t xml:space="preserve">${safe(text)}</w:t></w:r>`;
 const p=(str,style='')=>`<w:p>${style?`<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`:''}${run(str)}</w:p>`;
 const cell=(str,header=false)=>`<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/><w:shd w:fill="${header?'E4F2F3':'FFFFFF'}"/></w:tcPr><w:p>${run(str,header)}</w:p></w:tc>`;
 function table(headers,rows){return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="5" w:color="B9CED7"/><w:left w:val="single" w:sz="5" w:color="B9CED7"/><w:bottom w:val="single" w:sz="5" w:color="B9CED7"/><w:right w:val="single" w:sz="5" w:color="B9CED7"/><w:insideH w:val="single" w:sz="4" w:color="DCE8EC"/><w:insideV w:val="single" w:sz="4" w:color="DCE8EC"/></w:tblBorders></w:tblPr><w:tblGrid>${headers.map(()=>`<w:gridCol w:w=\"${Math.floor(10000/headers.length)}\"/>`).join('')}</w:tblGrid><w:tr><w:trPr><w:tblHeader w:val="true"/></w:trPr>${headers.map(h=>cell(h,true)).join('')}</w:tr>${rows.map(row=>`<w:tr>${row.map(x=>cell(String(x??''))).join('')}</w:tr>`).join('')}</w:tbl>`;}
 async function saveDocx(m){
  if(!root.JSZip)throw Error('Word export library is not available.');
  const zip=new root.JSZip();const steps=M.steps(m);const cols=M.outputColumns(m);
  const joins=m.nodes.map(n=>[n.kind==='root'?'Primary source':'Related table',n.name,n.parentId?m.nodes.find(q=>q.id===n.parentId)?.alias||'':'—',n.kind==='root'?'—':`${n.linkType}: ${n.to||'?'} = ${n.from||'?'}`]);
  const contents=[p('FetchFlow — editable analysis','Title'),p('Generated with Mightora. All diagrams below use editable Word tables and text, not flattened screenshots.'),
    p('1. What this query does','Heading1'),...M.summary(m).map(x=>p('• '+x)),
    p('2. Data source & relationship diagram','Heading1'),p('Each row describes a Dataverse source and its relationship to its parent. Change any table cell to edit the diagram.'),table(['Role','Dataverse table','Parent alias','Join / matching columns'],joins),
    p('3. How the query works — flow diagram','Heading1'),p('Read from top to bottom. Every stage is an editable row.'),table(['Step','Operation','What it does'],steps.map((s,i)=>[i+1,s.title,s.detail])),
    p('4. Output field lineage','Heading1'),table(['Output field','Dataverse source column','Transformation'],cols.map(c=>[c.label,`${c.source}.${c.field}`,c.action])),
    p('5. Structural warnings','Heading1'),...(m.warnings.length?m.warnings:['No structural warnings detected.']).map(x=>p('• '+x)),
    p('6. Original FetchXML','Heading1'),...m.xml.split(/\r?\n/).map(line=>p(line||' ','Code')),p('Important limitation: This visualiser never executes FetchXML; it does not verify permissions, metadata, row counts, execution order or query cost.')];
  const body=contents.join('')+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="850" w:bottom="900" w:left="850" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>';
  zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  zip.file('word/styles.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:before="0" w:after="200"/></w:pPr><w:rPr><w:b/><w:color w:val="173244"/><w:sz w:val="38"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="220" w:after="100"/></w:pPr><w:rPr><w:b/><w:color w:val="128B99"/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/><w:color w:val="41596C"/></w:rPr></w:style></w:styles>`);
  zip.file('docProps/core.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>FetchFlow — Editable Analysis</dc:title><dc:creator>Mightora</dc:creator></cp:coreProperties>`);
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});download(blob,'fetchxml-editable-analysis.docx');
 }
 root.FetchXMLExports={download,saveText,saveJson,saveMermaid,saveSVG,savePNG,savePptx,saveDocx,sourceInfo};
})(window);