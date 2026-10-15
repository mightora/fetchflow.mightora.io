const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const JSZip=require('../vendor/jszip.min.js');
(async()=>{
 const dist=path.join(__dirname,'../dist');
 const offline=fs.readFileSync(path.join(dist,'offline/index.html'),'utf8');
 const online=fs.readFileSync(path.join(dist,'index.html'),'utf8');
 assert(offline.includes('Offline Edition – No Internet Connection Required'));
 assert(offline.includes("connect-src 'none'"));
 assert(!/<script[^>]+src=/i.test(offline),'Offline must not load remote scripts');
 assert(!/<link[^>]+rel="stylesheet"[^>]+href="https?:/i.test(offline),'Offline must not load remote stylesheets');
 assert(!/<img[^>]+src="https?:/i.test(offline),'Offline must not load remote image assets');
 assert(!offline.includes('class="live-badge"'),'Offline build must omit dynamic GitHub badges');
 for(const name of ['ci','codeql','pages']) assert(online.includes('/actions/workflows/'+name+'.yml/badge.svg?branch=main'),'Online workflow badge missing: '+name);
 assert(online.includes('mightora-header')&&online.includes('mightora-footer')&&online.includes('mightora-author'));
 assert(online.includes('mightora/shared-ui@main/shared.css'));
 assert(online.includes('mightora/shared-ui@main/components.js'));
 assert(online.indexOf('js-yaml.min.js')<online.indexOf('shared-ui@main/components.js'));
 assert(online.indexOf('class="badges"')<online.indexOf('<mightora-footer aria-label="Mightora footer">'));
 assert(online.includes('<mightora-footer aria-label="Mightora footer">'),'Online must use official shared component');
 assert(online.includes('class="footer-fallback"'),'Online footer must show fallback while shared links load');
 assert(online.includes('https://mightora.io/tools/'),'Fallback links must include Mightora tools');
 assert(online.includes('https://mightora.io/privacy-policy/'),'Fallback links must include privacy');
 assert(online.includes('const fixed=yaml.replace('),'Shared footer YAML interceptor must preserve nesting');
 assert(!online.includes("replace(/^(\\\\s{4})(\\\\S)/gm"),'Shared footer YAML must never unindent valid nested keys');
 assert(!offline.includes('class="footer-fallback"'),'Offline build must keep compact self-contained footer only');

 assert(online.includes('class="footer-year"'),'The shared footer must show an updatable copyright year');
 assert(online.includes('class="footer-bottom-links"'),'The shared footer must include its secondary link row');
 assert(online.includes('class="site-footer__note"'),'The shared footer must include its standard note');
 assert(online.includes('normaliseSharedFooterLinks'),'Root-relative shared links must resolve to mightora.io');
 assert(online.includes('id="model-driven"'),'Public website must include Dataverse install guide');
 assert(online.includes('id="install-heading"'),'Dataverse guide must have a section heading');
 assert(online.includes('href="#model-driven"'),'Public site must link to install guide from navigation');
 assert(online.includes('href="dataverse/mightora_fetchflow_builder.html" download='),'Direct HTML web resource download must be on site');
 assert(online.includes('href="downloads/Mightora-FetchFlow-Dataverse.zip" download'),'Dataverse ZIP download must be on site');
 assert(online.includes('class="install-steps"'),'Six-step installation guide must be visible');
 assert(online.includes('not</strong> an importable Dataverse solution ZIP'),'Avoid representing web resource ZIP as an importable solution');
 assert(!offline.includes('id="model-driven"'),'Website-only installer must not ship inside offline HTML');
 assert(!offline.includes('href="#model-driven"'),'Offline navigation must not point to removed installer');

 assert(online.includes('footer\\.ya?ml'),'Required shared YAML normalisation workaround must remain');
 assert(offline.includes('class="portable-footer"'),'Standalone offline HTML must have the Mightora footer');
 assert(offline.includes('class="portable-footer-logo"'),'Portable footer must embed the official logo');
 assert(offline.includes('class="footer-bottom-links"'),'Portable footer must include privacy and source links');
 assert(!offline.includes('<footer class="fallback-footer"'),'Offline must not use legacy raw footer');

 const m=offline.match(/<script>([\s\S]*?)<\/script>/),csp=offline.match(/script-src 'sha256-([^']+)'/);
 assert(m&&csp);
 const digest=crypto.createHash('sha256').update(m[1]).digest('base64');
 assert.equal(csp[1],digest,'CSP must match bundled inline JavaScript');
 const zip=new JSZip();await zip.loadAsync(fs.readFileSync(path.join(dist,'downloads/Mightora-FetchFlow-Offline.zip')));
 assert.equal(await zip.file('index.html').async('string'),offline,'Offline ZIP must exactly match HTML release');
 const data=fs.readFileSync(path.join(dist,'dataverse/mightora_fetchflow_builder.html'),'utf8');
 const launcher=fs.readFileSync(path.join(dist,'dataverse/mightora_fetchflow_launcher.html'),'utf8');
 const command=fs.readFileSync(path.join(dist,'dataverse/mightora_fetchflow_command.js'),'utf8');
 assert(data.includes('window.__DATAVERSE__=true;'));
 assert(data.includes('window.__DATAVERSE_PAGE__=true;'),'Dataverse edition must enable full-page mode');
 assert(!data.includes('id="model-driven"'),'App web resource must not contain public installation instructions');
 assert(!data.includes('href="#model-driven"'),'App page navigation must not link to website installer');

 assert(data.includes('class="dv-page-header"'),'Model-driven page must contain a compact Mightora header');
 assert(data.includes('<img class="dv-page-logo" src="data:image/'),'Official Mightora brand logo must be embedded');
 assert(data.includes('class="quick-jump-nav"'),'Full-page navigation shortcuts must be available');
 assert(!data.includes('<section class="hero">'),'Model-driven resource must not include public marketing hero');
 assert(!data.includes('<mightora-author>'),'The public author card must not repeat inside model-driven app');
 assert(!data.includes('<section class="badges"'),'External GitHub badges must not be loaded in the app page');
 assert(data.includes('<mightora-footer class="portable-footer embedded-footer"'),'App edition needs a compact self-contained Mightora footer');
 assert(data.includes('class="portable-footer-logo"'),'App footer must embed the official logo');
 assert(!data.includes('<div class="footer-main">'),'App edition must not duplicate shared multicolumn site navigation');
 assert(!data.includes('footer.yaml'),'App edition must not fetch shared footer data');
 assert(!data.includes('<div id="offline-status"'),'App page should not claim to be the offline download edition');
 const cssBlock=data.match(/<style>([\s\S]*?)<\/style>/);
 const cssHash=data.match(/style-src 'sha256-([^']+)'/);
 assert(cssBlock && cssHash && data.includes('dataverse-page'));
 assert.equal(crypto.createHash('sha256').update(cssBlock[1]).digest('base64'),cssHash[1],'App page CSP style hash must match its embedded CSS');
 assert(data.includes("connect-src 'none'"));
 assert(data.includes('builder-preview')&&data.includes('FetchXMLBuilder'));
 assert(!/<script[^>]+src=/i.test(data),'Dataverse edition must be self-contained');
 assert(!/<img[^>]+src="https?:/i.test(data),'Dataverse edition must not load images from external hosts');
 assert(launcher.includes('navigateTo')&&launcher.includes('mightora_fetchflow_builder.html'));
 assert(command.includes('MightoraFetchFlow')&&command.includes('navigateTo'));
 for(const resource of [data,launcher]){
  const inline=[...resource.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)];
  const hashValue=resource.match(/script-src 'sha256-([^']+)'/);
  assert(inline.length && hashValue,'Dataverse web resources must hash their inline script');
  assert(inline.some(match=>crypto.createHash('sha256').update(match[1]).digest('base64')===hashValue[1]),'Web resource CSP script hash must match');
 }
 const solutionZip=new JSZip();
 await solutionZip.loadAsync(fs.readFileSync(path.join(dist,'downloads/Mightora-FetchFlow-Dataverse.zip')));
 for(const [name,value] of [['mightora_fetchflow_builder.html',data],['mightora_fetchflow_launcher.html',launcher],['mightora_fetchflow_command.js',command]]) {
   assert.equal(await solutionZip.file(name).async('string'),value,'Dataverse ZIP must contain matching release: '+name);
 }
 for(const p of ['README.md','LICENSE'])assert(solutionZip.file(p));
 assert(online.includes('Mightora-FetchFlow-Dataverse.zip'),'Dataverse download link must be present');
 for(const p of ['README.txt','LICENSE']) assert(zip.file(p));
 console.log('✓ Both editions, branding components, CSP hashes and ZIP/HTML parity verified');
})();
