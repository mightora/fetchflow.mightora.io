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
const scripts=vendor+'\n'+['src/model.js','src/diagrams.js','src/exports.js','src/builder.js','src/app.js'].map(read).join('\n');
const baseCss=read('src/styles.css');
const document=read('src/index.template.html');
const hash=s=>`'sha256-${crypto.createHash('sha256').update(s).digest('base64')}'`;
const patch=`<script>(function(){const original=window.fetch;window.fetch=async function(input,init){const response=await original.call(this,input,init);const target=typeof input==='string'?input:input&&input.url||'';if(/footer\\.ya?ml(?:[?#]|$)/i.test(target)&&response.ok){try{const content=await response.clone().text();const fixed=content.replace(/\\t/g,'  ').replace(/^(\\s{4})(\\S)/gm,'  $2');return new Response(fixed,{status:response.status,statusText:response.statusText,headers:response.headers});}catch{return response;}}return response;};})();</script>`;
function assemble(offline,dataverse=false){
 let html=document;
 const css=baseCss+(dataverse?'\n'+read('src/dataverse-page.css'):'');
 const pre=`window.__OFFLINE__=${offline};window.__DATAVERSE__=${dataverse};window.__DATAVERSE_PAGE__=${dataverse};window.FETCHXML_EXAMPLES=${JSON.stringify(examples).replace(/</g,'\\u003c')};\n`;
 const app=pre+scripts;
 const escapedApp=app.replace(/<\/script/gi,'<\\/script');
 html=html.replace('/*BUILD_CSS*/',css).replace('<!--SCRIPTS-->',()=>`<script>${escapedApp}</script>`);
 html=html.replace('<!--BRAND_STYLE-->',offline?'':`<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/shared.css" />`);
 if(offline){
  // Installation downloads and website-specific instructions belong only
  // on the public website, not inside local HTML or Dataverse app pages.
  html=html.replace(/<!--ONLINE_INSTALL_START-->[\s\S]*?<!--ONLINE_INSTALL_END-->/,'');
  html=html.replace(/<a href="#model-driven">07 · Power Apps setup<\/a>/,'');
  html=html.replace('08 · Privacy & help','07 · Privacy & help');
  html=html.replace(/<p class="hero-install-cta">[\s\S]*?<\/p>/,'');
  // Remove the exports-area teaser and replace the online-only FAQ anchor.
  html=html.replace(/<div class="download-card online-only"><div><strong>Install in your model-driven Power App<\/strong>[\s\S]*?<a class="btn" href="#model-driven">View installation instructions →<\/a><\/div>/,'');
  html=html.replace('Use the <a href="#model-driven">on-page installation guide</a>',
                    'On the online FetchFlow website, use the installation guide');
  html=html.replace('<!--FOOTER_PATCH-->','');
  // Offline edition must never fetch live CI badges: status is only verifiable online.
  html=html.replace(/<img\s+class="live-badge"[^>]*>/gi,'');
  html=html.replace(/<!--ONLINE_HEADER_START-->[\s\S]*?<!--ONLINE_HEADER_END-->/,'');
  const offlineHeader=`<header class="top-fallback"><div class="container"><a href="#workspace" aria-label="Mightora FetchFlow"><img src="${logo}" alt="Mightora" width="180" height="40" class="header-logo" /></a><nav aria-label="Main navigation"><a href="#builder">Build</a><a href="#workspace">Editor</a><a href="#diagrams">Diagrams</a><a href="#exports">Exports</a></nav></div></header>`;
  const appHeader=dataverse?read('dataverse/page-header.template.html').replace('<!--BRAND_LOGO-->',logo):offlineHeader;
  html=html.replace('<!--OFFLINE_HEADER-->',appHeader);
  html=html.replace(/<!--ONLINE_FOOTER_START-->[\s\S]*?<!--ONLINE_FOOTER_END-->/,'');
  // Portable editions use a small self-contained <mightora-footer> without
  // loading shared-ui, js-yaml, telemetry, fonts or remote images.
  const portableFooter=`<mightora-footer class="portable-footer${dataverse?' embedded-footer':''}" role="contentinfo" aria-label="Mightora FetchFlow footer">
    <div class="container">
      <div class="portable-footer-brand">
        <img class="portable-footer-logo" src="${logo}" alt="Mightora" width="150" height="38">
        <p class="portable-footer-description">${dataverse?'FetchFlow for model-driven apps · Queries are built locally.':'Offline Edition – No Internet Connection Required · All query analysis stays on this device.'}</p>
      </div>
      <div class="footer-bottom">
        <div class="footer-copy">© ${new Date().getFullYear()} FetchFlow by <a href="https://mightora.io" target="_blank" rel="noopener noreferrer">Mightora</a>.</div>
        <div class="footer-bottom-links">
          <a href="https://github.com/mightora/fetchflow.mightora.io" target="_blank" rel="noopener noreferrer">Source code</a>
          <a href="https://github.com/mightora/fetchflow.mightora.io/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT licence</a>
          <a href="https://mightora.io/privacy-policy/" target="_blank" rel="noopener noreferrer">Privacy</a>
        </div>
      </div>
    </div>
  </mightora-footer>`;
  html=html.replace('<!--OFFLINE_FOOTER-->',portableFooter);
  html=html.replace('src="https://techtweedie.github.io/images/author/ian-tweedie-sq2_hu_a380911c6f4726de.png"',`src="${avatar}"`);
  html=html.replace('src="https://raw.githubusercontent.com/TechTweedie/techtweedie.github.io/v2/assets/images/site/main-logo.png"',`src="${tt}"`);
  html=html.replace('<body>',dataverse?'<body class="offline-mode dataverse-page">':'<body class="offline-mode">');
  if(dataverse){
   // The app supplies its own navigation and chrome. Retain the query builder,
   // editor, analysis, diagrams and exports, rather than nesting a marketing site.
   html=html.replace(/<section class="hero">[\s\S]*?<\/section>/,'');
   html=html.replace(/<mightora-author>[\s\S]*?<\/mightora-author>/,'');
   html=html.replace(/<section class="badges"[\s\S]*?<\/section>/,'');
   html=html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,'');
   html=html.replace('<title>FetchFlow – Understand Dataverse Queries | Mightora</title>',
                     '<title>FetchFlow | Model-driven app page | Mightora</title>');
   html=html.replace(/<div id="offline-status" class="offline-banner" hidden>[\s\S]*?<\/div><\/div>/,'');
  }
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
 const dist=path.join(root,'dist');fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(path.join(dist,'offline'),{recursive:true});fs.mkdirSync(path.join(dist,'downloads'),{recursive:true});fs.mkdirSync(path.join(dist,'dataverse'),{recursive:true});
 const online=assemble(false),offline=assemble(true),dataverse=assemble(true,true);
 fs.writeFileSync(path.join(dist,'index.html'),online);fs.writeFileSync(path.join(dist,'offline/index.html'),offline);
 fs.writeFileSync(path.join(dist,'dataverse/mightora_fetchflow_builder.html'),dataverse);
 // Form launcher is a small, locally executable HTML web resource. Hash its
 // static inline CSS/JS instead of allowing unrestricted inline content.
 let launcher=read('dataverse/launcher.template.html').replace('<!--BRAND_LOGO-->',logo);
 const launcherStyle=launcher.match(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/i)[1];
 const launcherScript=launcher.match(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/i)[1];
 const launchCsp="default-src 'none'; script-src "+hash(launcherScript)+"; style-src "+hash(launcherStyle)+"; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
 launcher=launcher.replace('<!--LAUNCHER_CSP-->', '<meta http-equiv="Content-Security-Policy" content="'+launchCsp+'" />');
 fs.writeFileSync(path.join(dist,'dataverse/mightora_fetchflow_launcher.html'),launcher);
 const command=read('dataverse/mightora_fetchflow_command.js');
 fs.writeFileSync(path.join(dist,'dataverse/mightora_fetchflow_command.js'),command);
 fs.copyFileSync(path.join(root,'dataverse/README.md'),path.join(dist,'dataverse/README.md'));
 fs.writeFileSync(path.join(dist,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: https://fetchflow.mightora.io/sitemap.xml\n');
 fs.writeFileSync(path.join(dist,'sitemap.xml'),'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://fetchflow.mightora.io/</loc></url></urlset>');
 fs.copyFileSync(path.join(root,'LICENSE'),path.join(dist,'LICENSE'));
 if(has('CNAME'))fs.copyFileSync(path.join(root,'CNAME'),path.join(dist,'CNAME'));
 const zip=new JSZip();zip.file('index.html',offline);zip.file('LICENSE',read('LICENSE'));
 zip.file('README.txt','Mightora FetchFlow — Offline Edition\n\n1. Extract ZIP.\n2. Double-click index.html in Chrome, Edge, Firefox or Safari.\n3. Load a sample or paste FetchXML.\n4. Export editable PPTX, DOCX, diagrams and JSON.\n\nNo connection, account, server or installation is required. All FetchXML processing occurs locally.\n\nTo verify network privacy: F12 > Developer Tools > Network > Preserve log > Reload. Inspect requests. The on-screen resource summary is not a full network audit.\n\nSource: https://github.com/mightora/fetchflow.mightora.io\n');
 const buffer=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 fs.writeFileSync(path.join(dist,'downloads/Mightora-FetchFlow-Offline.zip'),buffer);
 const webZip=new JSZip();
 webZip.file('mightora_fetchflow_builder.html',dataverse);
 webZip.file('mightora_fetchflow_launcher.html',launcher);
 webZip.file('mightora_fetchflow_command.js',command);
 webZip.file('README.md',read('dataverse/README.md'));
 webZip.file('LICENSE',read('LICENSE'));
 const webBuffer=await webZip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 fs.writeFileSync(path.join(dist,'downloads/Mightora-FetchFlow-Dataverse.zip'),webBuffer);
 console.log(`Online HTML ${(online.length/1024).toFixed(1)} KB | Offline HTML ${(offline.length/1024).toFixed(1)} KB | Offline ZIP ${(buffer.length/1024).toFixed(1)} KB | Dataverse ZIP ${(webBuffer.length/1024).toFixed(1)} KB`);
 if(!has('assets/mightora-logo.png'))console.warn('Note: official brand logo was not downloaded locally. CI downloads authoritative brand assets before publishing.');
})();
