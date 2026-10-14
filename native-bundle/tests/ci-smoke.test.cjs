const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
// Publisher intentionally overwrites the working script before npm test/build.
// Test the protected copy BEFORE restoration, not the disposable old working copy.
// Canonicalize all source inspections, not only restoration comparisons.
// Windows Git checkouts may use CRLF while restored files use LF.
const sourceText=relative=>fs.readFileSync(path.join(root,relative),'utf8').replace(/\r\n/g,'\n');
const protectedSmoke=()=>sourceText('native-bundle/scripts/smoke-electron.cjs');
const restore=()=>import(pathToFileURL(path.join(root,'build-tools/restore-native.mjs')).href);
test('protected native smoke matches accessible local-name field and save button',()=>{
 const smoke=protectedSmoke(),ui=fs.readFileSync(path.join(root,'src/components/ProfileView.tsx'),'utf8');
 assert(smoke.includes("name:'Имя на устройстве',exact:true"));assert(ui.includes('aria-label="Имя на устройстве"'));
 assert(smoke.includes("name: 'Сохранить имя', exact: true"));assert(ui.includes('Сохранить имя'));
 assert(!/name:\s*'Сохранить'\s*,\s*exact:\s*true/.test(smoke));
 assert(!smoke.includes("locator('input[maxlength="));
});
test('native smoke requires all eight destinations, avatar and new friends/beta UI',()=>{
 const smoke=protectedSmoke();
 for(const label of ['Главная','Новости','Библиотека','Магазин','Dev','Друзья','Профиль','Настройки'])assert(smoke.includes(`'${label}'`));
 for(const required of ["phase('custom avatar upload and persistence')",".setInputFiles(","[data-friends-page]","name:'Уведомления'","name:'Бета-тест'","window.require","__trayEventSeen","phase('system clipboard IPC","clipboard.readText()","Скопировать свой юзернейм","copy failure does not claim success","partial friend search and public player cards","one avatar picker and editable public identity","new library selection filters tabs and honest game statistics"])assert(smoke.includes(required),required);
 assert(!smoke.includes("if (await page.getByLabel('Загрузить свою аватарку'"));
 assert(smoke.includes("installSmokeNetwork(app,"));assert(smoke.includes('no real OTP'));
});
test('native smoke isolates networking below renderer and auxiliary-window lifetimes',()=>{
 const smoke=protectedSmoke(),helper=fs.readFileSync(path.join(root,'native-bundle/scripts/smoke-network.cjs'),'utf8');
 assert(!smoke.includes('app.context().route('));
 assert(smoke.includes("phase('Dev owner cannot manage invitations from launcher')"));
 assert(smoke.includes('--host-resolver-rules=MAP * ~NOTFOUND'));assert(smoke.includes('--no-proxy-server'));
 assert(smoke.includes("phase('session network isolation survives foreign window destruction and reload')"));
 assert(smoke.includes('await probe();\n    await page.reload();\n    await probe();'));
 assert(smoke.includes("mockedEndpoints.has('/auth/v1/user')"));
 assert(smoke.includes('network.assertHealthy()'));assert(smoke.includes('await network.close()'));
 assert(helper.includes("protocol.handle('https', handler)"));assert(helper.includes("protocol.handle('http', handler)"));
 assert(helper.includes("server.listen(0, '127.0.0.1'"));
 assert(helper.includes('globalThis.fetch(bridge + encodeURIComponent(request.url)'));
 assert(helper.includes("redirect: 'error'"));assert(!helper.includes('fetch(request.url'));
 assert(helper.includes('Smoke fixture must not fall through to the internet'));
});
test('protected smoke navigation list exactly matches the real sidebar, including Shop and Dev',()=>{
 const smoke=protectedSmoke(),sidebar=fs.readFileSync(path.join(root,'src/components/Sidebar.tsx'),'utf8');
 const list=smoke.match(/const labels = \[([^\]]+)\]/);assert(list,'missing explicit destination contract');
 const expected=[...list[1].matchAll(/'([^']+)'/g)].map(match=>match[1]);
 const actual=[...sidebar.matchAll(/\{\s*id:\s*"[^"]+",\s*label:\s*"([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(expected,actual);assert.equal(new Set(expected).size,expected.length);
 assert(expected.includes('Магазин')&&expected.includes('Dev'));
 assert(smoke.includes("phase('shop and Dev navigation stay safe in local mode')"));
 assert(smoke.includes('Local mode must not call Dev gateway'));
 assert(smoke.includes("button.getAttribute('aria-label')"));
});
test('both workflow platforms keep the mandatory native smoke gate before packaging',()=>{
 const yml=fs.readFileSync(path.join(root,'.github/workflows/windows.yml'),'utf8'),pkg=require('../package.json');
 assert.equal(pkg.scripts['test:smoke'],'node scripts/smoke-electron.cjs');
 assert(yml.includes('run: npm run test:smoke'));assert(yml.includes('run: xvfb-run -a npm run test:smoke'));
 assert(!yml.includes('continue-on-error: true'));
 assert(yml.indexOf('run: npm run test:smoke')<yml.indexOf('npx electron-builder'));
});
// Git checks out text as LF or CRLF depending on the platform/configuration.
// restoreNative canonicalizes rewritten text to LF; compare canonical CONTENT,
// not the checkout's raw bytes. Exercise every checkout form even on Linux.
for(const checkout of ['LF','CRLF','mixed']){
 test(`Publisher-overwritten smoke is restored from ${checkout} checkout`,async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'temka-ci-smoke-'));
  try{
   fs.cpSync(path.join(root,'native-bundle'),path.join(temp,'native-bundle'),{recursive:true});
   const {restoreNative,TARGETS}=await restore();
   assert(TARGETS.includes('scripts/smoke-electron.cjs'));assert(TARGETS.includes('scripts/smoke-network.cjs'));assert(TARGETS.includes('tests/ci-smoke.test.cjs'));
   for(const relative of TARGETS){
    const file=path.join(temp,'native-bundle',relative);
    const canonical=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');let line=0;
    const text=checkout==='CRLF'?canonical.replace(/\n/g,'\r\n'):
     checkout==='mixed'?canonical.replace(/\n/g,()=>++line%2?'\r\n':'\n'):canonical;
    fs.writeFileSync(file,text);
   }
   const source=fs.readFileSync(path.join(temp,'native-bundle/scripts/smoke-electron.cjs'),'utf8');
   assert.equal(source.includes('\r\n'),checkout!=='LF');
   if(checkout==='mixed')assert(/(?<!\r)\n/.test(source));
   fs.mkdirSync(path.join(temp,'scripts'),{recursive:true});
   const output=path.join(temp,'scripts/smoke-electron.cjs');
   fs.writeFileSync(output,"// Old Publisher selector: name: 'Сохранить'\nthrow Error('old template');\n");
   restoreNative(temp,{verify:false});
   const actual=fs.readFileSync(output,'utf8');
   assert.equal(actual,source.replace(/\r\n/g,'\n'));
   assert.equal(actual,protectedSmoke().replace(/\r\n/g,'\n'));
   assert(!actual.includes('\r\n'));
   assert.equal(restoreNative(temp,{verify:false}).changed,0);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
 });
}
test('corrupt protected smoke stops restoration before touching any output',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'temka-ci-smoke-corrupt-'));
 try{
  fs.cpSync(path.join(root,'native-bundle'),path.join(temp,'native-bundle'),{recursive:true});fs.mkdirSync(path.join(temp,'scripts'),{recursive:true});
  const output=path.join(temp,'scripts/smoke-electron.cjs');fs.writeFileSync(output,'original');
  fs.appendFileSync(path.join(temp,'native-bundle/scripts/smoke-electron.cjs'),'corrupt');
  const {restoreNative}=await restore();assert.throws(()=>restoreNative(temp,{verify:false}),/checksum mismatch/);assert.equal(fs.readFileSync(output,'utf8'),'original');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

// Also change the test's OWN project checkout, not just its restoration fixture.
// This catches comparing restored LF against protectedSmoke()'s raw CRLF bytes.
test('checkout-level smoke regression passes with CRLF and mixed source files',{skip:process.env.TEMKA_CI_CHECKOUT_CHILD==='1'},()=>{
 const {execFileSync}=require('node:child_process');
 for(const checkout of ['LF','CRLF','mixed']){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'temka-ci-checkout-'));
  try{
   fs.cpSync(path.join(root,'native-bundle'),path.join(temp,'native-bundle'),{recursive:true});
   fs.mkdirSync(path.join(temp,'tests'));fs.copyFileSync(__filename,path.join(temp,'tests/ci-smoke.test.cjs'));
   // Include the real UI/workflow contracts so every non-recursive CI smoke
   // regression runs under this checkout's line endings, not only restoration.
   for(const relative of ['src/components/ProfileView.tsx','src/components/Sidebar.tsx','.github/workflows/windows.yml','package.json']){
    const destination=path.join(temp,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.copyFileSync(path.join(root,relative),destination);
   }
   fs.mkdirSync(path.join(temp,'build-tools'));fs.copyFileSync(path.join(root,'build-tools/restore-native.mjs'),path.join(temp,'build-tools/restore-native.mjs'));
   const convert=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);if(entry.isDirectory()){convert(file);continue;}
    const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');let line=0;
    fs.writeFileSync(file,checkout==='LF'?text:text.replace(/\n/g,()=>checkout==='CRLF'||++line%2?'\r\n':'\n'));
   }};convert(temp);
   // Run all nine non-recursive checks, including the network-isolation test.
   // Exclude only this subprocess-spawning test to avoid infinite recursion.
   const env={...process.env,TEMKA_CI_CHECKOUT_CHILD:'1'};delete env.NODE_TEST_CONTEXT;
   const result=execFileSync(process.execPath,['--test','--test-reporter=tap','--test-name-pattern=^(protected native smoke|native smoke requires|native smoke isolates|protected smoke navigation|both workflow platforms|Publisher-overwritten smoke|corrupt protected smoke)',path.join(temp,'tests/ci-smoke.test.cjs')],{cwd:temp,stdio:'pipe',env,encoding:'utf8'});
   assert.match(result,/# pass 9(?:\r?\n|$)/);assert.match(result,/# fail 0(?:\r?\n|$)/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
 }
});
