(function (root) {
  'use strict';
  const X = root.FetchXMLModel;
  const NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs = {}, text) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,String(v)));
    if (text !== undefined) node.textContent=String(text);
    return node;
  }
  const clr = {ink:'#173244',muted:'#526b7b',primary:'#128b99',accent:'#ef9c40',bg:'#ffffff',line:'#b6c9d1',soft:'#eaf6f6',purple:'#6954a2'};
  function svgBase(w,h,label) {
    const s=el('svg',{xmlns:NS,viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img','aria-label':label,'font-family':'Arial, Helvetica, sans-serif'});
    s.append(el('title',{},label),el('rect',{width:w,height:h,fill:clr.bg,rx:14}));
    return s;
  }
  function text(svg,x,y,value,{size=15,color=clr.ink,weight=400,max=38}={}) {
    let str=String(value||'');if(str.length>max)str=str.slice(0,max-1)+'…';
    svg.append(el('text',{x,y,fill:color,'font-size':size,'font-weight':weight},str));
  }
  function pill(svg,x,y,label,color=clr.primary) {
    const width=Math.min(156,Math.max(80,label.length*8+18));
    svg.append(el('rect',{x,y,width,height:23,rx:11,fill:color}));
    text(svg,x+9,y+16,label,{size:12,color:'#ffffff',weight:700,max:18});
  }
  function relationship(model){
    const byDepth = new Map();
    model.nodes.forEach(n => {if(!byDepth.has(n.depth))byDepth.set(n.depth,[]);byDepth.get(n.depth).push(n);});
    const maxDepth=Math.max(...model.nodes.map(n=>n.depth));const maxRows=Math.max(...Array.from(byDepth.values()).map(a=>a.length));
    const w=Math.max(790,(maxDepth+1)*315+64),h=Math.max(300,maxRows*180+90);
    const svg=svgBase(w,h,'Dataverse source tables and relationship links');const positions=new Map();
    for(const [depth,nodes] of byDepth){ const interval=h/(nodes.length+1);nodes.forEach((n,i)=>positions.set(n.id,{x:35+depth*315,y:interval*(i+1)-70})); }
    for(const n of model.nodes.filter(n=>n.parentId)){
      const a=positions.get(n.parentId),b=positions.get(n.id);const ay=a.y+67,by=b.y+67;
      svg.append(el('path',{d:`M ${a.x+255} ${ay} C ${a.x+286} ${ay}, ${b.x-33} ${by}, ${b.x} ${by}`,stroke:clr.primary,'stroke-width':2.5,fill:'none'}));
      svg.append(el('circle',{cx:b.x,cy:by,r:5,fill:clr.accent}));
      text(svg,(a.x+b.x+255)/2-18,(ay+by)/2-11,n.linkType,{size:12,color:clr.purple,weight:700,max:10});
    }
    for(const n of model.nodes){
      const {x,y}=positions.get(n.id);
      svg.append(el('rect',{x,y,width:255,height:134,rx:14,fill:n.kind==='root'?clr.soft:'#f5f7fa',stroke:n.kind==='root'?clr.primary:'#c3d2db','stroke-width':2}));
      text(svg,x+14,y+25,n.name,{size:20,weight:700,max:20});
      text(svg,x+14,y+46,`alias: ${n.alias}`,{size:13,color:clr.muted,max:26});
      if(n.kind==='root')pill(svg,x+14,y+59,'PRIMARY SOURCE');else pill(svg,x+14,y+59,n.linkType.toUpperCase()+' JOIN',clr.purple);
      text(svg,x+14,y+108,`${n.attributes.length} selected · ${n.filters.length} filter groups`,{size:12,color:clr.muted,max:32});
      if(n.kind==='linked')text(svg,x+14,y+125,`${n.to||'?'} = ${n.from||'?'}`,{size:11,color:clr.ink,max:33});
    }
    return svg;
  }
  function pipeline(model){
    const steps=X.steps(model);const w=920,h=Math.max(290,steps.length*83+30);const svg=svgBase(w,h,'How FetchXML shapes the result');
    const tones={source:clr.primary,join:clr.purple,filter:'#cc7a32',sort:'#5579a9',aggregate:'#5579a9',distinct:'#5579a9',limit:'#5579a9',output:clr.primary};
    steps.forEach((s,i)=>{const y=25+i*83;
      svg.append(el('rect',{x:60,y,width:800,height:65,rx:12,fill:i%2===0?'#f4f9fa':'#f7f8fb',stroke:'#d4e0e5'}));
      svg.append(el('circle',{cx:90,cy:y+32,r:17,fill:tones[s.kind]||clr.primary}));
      text(svg,84,y+38,String(i+1),{size:16,weight:700,color:'#fff',max:3});
      text(svg,125,y+25,s.title,{size:18,weight:700,max:66});
      text(svg,125,y+46,s.detail,{size:13,color:clr.muted,max:99});
      if(i!==steps.length-1)svg.append(el('path',{d:`M 90 ${y+65} V ${y+78} M 84 ${y+72} L 90 ${y+78} L 96 ${y+72}`,stroke:clr.primary,'stroke-width':2,fill:'none'}));
    });return svg;
  }
  function lineage(model){
    const fields=X.outputColumns(model);const items=fields.length ? fields.slice(0,80) : [{label:'No selected columns',source:'?',field:'?',action:'unknown'}];
    const columns=2,rows=Math.ceil(items.length/columns);const w=960,h=Math.max(265,rows*99+95);const svg=svgBase(w,h,'Output column lineage and source tables');
    text(svg,34,37,'SOURCE COLUMN',{size:13,color:clr.muted,weight:700});text(svg,305,37,'OUTPUT FIELD',{size:13,color:clr.muted,weight:700});
    items.forEach((f,i)=>{const col=i%2,row=Math.floor(i/2),x=32+col*460,y=54+row*99;
      svg.append(el('rect',{x,y,width:440,height:78,rx:12,fill:'#f6f9fb',stroke:'#cbdce3'}));
      text(svg,x+13,y+25,`${f.source}.${f.field}`,{size:13,color:clr.muted,max:26});
      svg.append(el('path',{d:`M ${x+190} ${y+39} H ${x+215} l -7 -6 m 7 6 l -7 6`,stroke:clr.primary,'stroke-width':2,fill:'none'}));
      text(svg,x+229,y+27,f.label,{size:16,weight:700,max:22});
      text(svg,x+229,y+53,f.action,{size:13,color:clr.purple,max:26});
    });return svg;
  }
  root.FetchXMLDiagrams={relationship,pipeline,lineage};
})(window);