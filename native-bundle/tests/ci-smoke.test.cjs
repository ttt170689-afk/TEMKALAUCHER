const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
// Publisher intentionally overwrites the working script before npm test/build.
// Test the protected copy BEFORE restoration, not the disposable old working copy.
const protectedSmoke=()=>fs.readFileSync(path.join(root,'native-bundle/scripts/smoke-electron.cjs'),'utf8');
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
 assert(smoke.includes("route(/^https?:/"));assert(smoke.includes('no real OTP'));
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
   assert(TARGETS.includes('scripts/smoke-electron.cjs'));assert(TARGETS.includes('tests/ci-smoke.test.cjs'));
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
test('checkout-level smoke regression passes with CRLF and mixed source files',()=>{
 const {execFileSync}=require('node:child_process');
 for(const checkout of ['CRLF','mixed']){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'temka-ci-checkout-'));
  try{
   fs.cpSync(path.join(root,'native-bundle'),path.join(temp,'native-bundle'),{recursive:true});
   fs.mkdirSync(path.join(temp,'tests'));fs.copyFileSync(__filename,path.join(temp,'tests/ci-smoke.test.cjs'));
   fs.mkdirSync(path.join(temp,'build-tools'));fs.copyFileSync(path.join(root,'build-tools/restore-native.mjs'),path.join(temp,'build-tools/restore-native.mjs'));
   const convert=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);if(entry.isDirectory()){convert(file);continue;}
    const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');let line=0;
    fs.writeFileSync(file,text.replace(/\n/g,()=>checkout==='CRLF'||++line%2?'\r\n':'\n'));
   }};convert(temp);
   // Filter only the three restoration cases: no recursive child-suite execution.
   const env={...process.env};delete env.NODE_TEST_CONTEXT;
   const result=execFileSync(process.execPath,['--test','--test-reporter=tap','--test-name-pattern=^Publisher-overwritten smoke',path.join(temp,'tests/ci-smoke.test.cjs')],{cwd:temp,stdio:'pipe',env,encoding:'utf8'});
   assert.match(result,/# pass 3(?:\r?\n|$)/);assert.match(result,/# fail 0(?:\r?\n|$)/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
 }
});
