const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const JSZip=require(path.join(root,'vendor/jszip.min.js'));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const has=p=>fs.existsSync(path.join(root,p));
function dataAsset(file,fallback) {
 if(has(file)){const ext=path.extname(file).toLowerCase(),mime=ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg';return `data:${mime};base64,`+fs.readFileSync(path.join(root,file)).toString('base64');}
 return 'data:image/svg+xml;base64,'+Buffer.from(fallback).toString('base64');
}
const brandFallback='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 200"><rect width="900" height="200" fill="#102e40"/><text x="12" y="138" font-size="114" font-weight="800" font-family="Arial" fill="#fff">MIGHTORA</text></svg>';
const avatarFallback='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#128b99"/><text x="60" y="79" font-size="53" text-anchor="middle" font-family="Arial" font-weight="700" fill="#fff">IT</text></svg>';
const techFallback='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="19" fill="#173244"/><text x="60" y="79" font-size="50" text-anchor="middle" font-family="Arial" fill="#fff">TT</text></svg>';
const logo=dataAsset('assets/mightora-logo.png',brandFallback),avatar=dataAsset('assets/author-avatar.png',avatarFallback),tt=dataAsset('assets/author-blog-logo.png',techFallback);
const examples=JSON.parse(read('examples/examples.json'));
const vendor=read('vendor/jszip.min.js')+'\n'+read('vendor/pptxgen.min.js');
const scripts=vendor+'\n'+['src/model.js','src/diagrams.js','src/exports.js','src/app.js'].map(read).join('\n');
const css=read('src/styles.css');
const document=read('src/index.template.html');
const hash=s=>`'sha256-${crypto.createHash('sha256').update(s).digest('base64')}'`;
const patch=`<script>(function(){const original=window.fetch;window.fetch=async function(input,init){const response=await original.call(this,input,init);const target=typeof input==='string'?input:input&&input.url||'';if(/footer\\.ya?ml(?:[?#]|$)/i.test(target)&&response.ok){try{const content=await response.clone().text();const fixed=content.replace(/\\t/g,'  ').replace(/^(\\s{4})(\\S)/gm,'  $2');return new Response(fixed,{status:response.status,statusText:response.statusText,headers:response.headers});}catch{return response;}}return response;};})();</script>`;
function assemble(offline){
 let html=document;
 const pre=`window.__OFFLINE__=${offline};window.FETCHXML_EXAMPLES=${JSON.stringify(examples).replace(/</g,'\\u003c')};\n`;
 const app=pre+scripts;
 const escapedApp=app.replace(/<\/script/gi,'<\\/script');
 html=html.replace('/*BUILD_CSS*/',css).replace('<!--SCRIPTS-->',()=>`<script>${escapedApp}</script>`);
 html=html.replace('<!--BRAND_STYLE-->',offline?'':`<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/shared.css" />`);
 if(offline){
  html=html.replace('<!--FOOTER_PATCH-->','');
  html=html.replace(/<!--ONLINE_HEADER_START-->[\s\S]*?<!--ONLINE_HEADER_END-->/,'');
  html=html.replace('<!--OFFLINE_HEADER-->',`<header class="top-fallback"><div class="container"><a href="#workspace" aria-label="Mightora FetchFlow"><img src="${logo}" alt="Mightora" width="180" height="40" class="header-logo" /></a><nav aria-label="Main navigation"><a href="#workspace">Editor</a><a href="#diagrams">Diagrams</a><a href="#exports">Exports</a></nav></div></header>`);
  html=html.replace(/<!--ONLINE_FOOTER_START-->[\s\S]*?<!--ONLINE_FOOTER_END-->/,'');
  html=html.replace('<!--OFFLINE_FOOTER-->',`<footer class="fallback-footer"><div class="container"><strong>FetchFlow by Mightora</strong><p>Offline Edition – No Internet Connection Required · MIT licensed · locally processed.</p></div></footer>`);
  html=html.replace('src="https://techtweedie.github.io/images/author/ian-tweedie-sq2_hu_a380911c6f4726de.png"',`src="${avatar}"`);
  html=html.replace('src="https://raw.githubusercontent.com/TechTweedie/techtweedie.github.io/v2/assets/images/site/main-logo.png"',`src="${tt}"`);
  html=html.replace('<body>','<body class="offline-mode">');
  // CSP includes script/style hashes; forbids connections and all network content.
  const csp=`default-src 'none'; script-src ${hash(escapedApp)}; style-src ${hash(css)}; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; manifest-src 'none'`;
  html=html.replace('<!--BUILD_CSP-->',`<meta http-equiv="Content-Security-Policy" content="${csp}" />`);
 }else{
  html=html.replace('<!--OFFLINE_HEADER-->','').replace('<!--OFFLINE_FOOTER-->','');
  html=html.replace('<!--BUILD_CSP-->','');
  html=html.replace('<!--FOOTER_PATCH-->',patch+`<script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js" defer></script><script src="https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/components.js" defer></script>`);
 }
 return html;
}
(async()=>{
 if(process.env.REQUIRE_BRAND_ASSETS==='1' && !has('assets/mightora-logo.png')) throw new Error('Official Mightora logo is required for a production build.');
 const dist=path.join(root,'dist');fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(path.join(dist,'offline'),{recursive:true});fs.mkdirSync(path.join(dist,'downloads'),{recursive:true});
 const online=assemble(false),offline=assemble(true);
 fs.writeFileSync(path.join(dist,'index.html'),online);fs.writeFileSync(path.join(dist,'offline/index.html'),offline);
 fs.writeFileSync(path.join(dist,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: https://fetchflow.mightora.io/sitemap.xml\n');
 fs.writeFileSync(path.join(dist,'sitemap.xml'),'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://fetchflow.mightora.io/</loc></url></urlset>');
 fs.copyFileSync(path.join(root,'LICENSE'),path.join(dist,'LICENSE'));
 if(has('CNAME'))fs.copyFileSync(path.join(root,'CNAME'),path.join(dist,'CNAME'));
 const zip=new JSZip();zip.file('index.html',offline);zip.file('LICENSE',read('LICENSE'));
 zip.file('README.txt','Mightora FetchFlow — Offline Edition\n\n1. Extract ZIP.\n2. Double-click index.html in Chrome, Edge, Firefox or Safari.\n3. Load a sample or paste FetchXML.\n4. Export editable PPTX, DOCX, diagrams and JSON.\n\nNo connection, account, server or installation is required. All FetchXML processing occurs locally.\n\nTo verify network privacy: F12 > Developer Tools > Network > Preserve log > Reload. Inspect requests. The on-screen resource summary is not a full network audit.\n\nSource: https://github.com/mightora/fetchflow.mightora.io\n');
 const buffer=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 fs.writeFileSync(path.join(dist,'downloads/Mightora-FetchFlow-Offline.zip'),buffer);
 console.log(`Online HTML ${(online.length/1024).toFixed(1)} KB | Offline HTML ${(offline.length/1024).toFixed(1)} KB | ZIP ${(buffer.length/1024).toFixed(1)} KB`);
 if(!has('assets/mightora-logo.png'))console.warn('Note: official brand logo was not downloaded locally. CI downloads authoritative brand assets before publishing.');
})();