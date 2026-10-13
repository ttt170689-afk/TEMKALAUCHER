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
test('native smoke requires all six destinations, avatar and new friends/beta UI',()=>{
 const smoke=protectedSmoke();
 for(const label of ['Главная','Новости','Библиотека','Друзья','Профиль','Настройки'])assert(smoke.includes(`'${label}'`));
 for(const required of ["phase('custom avatar upload and persistence')",".setInputFiles(","[data-friends-page]","name:'Уведомления'","name:'Бета-тест'","window.require","__trayEventSeen"])assert(smoke.includes(required),required);
 assert(!smoke.includes("if (await page.getByLabel('Загрузить свою аватарку'"));
 assert(smoke.includes("route(/^https?:/"));assert(smoke.includes('no real OTP'));
});
test('both workflow platforms keep the mandatory native smoke gate before packaging',()=>{
 const yml=fs.readFileSync(path.join(root,'.github/workflows/windows.yml'),'utf8'),pkg=require('../package.json');
 assert.equal(pkg.scripts['test:smoke'],'node scripts/smoke-electron.cjs');
 assert(yml.includes('run: npm run test:smoke'));assert(yml.includes('run: xvfb-run -a npm run test:smoke'));
 assert(!yml.includes('continue-on-error: true'));
 assert(yml.indexOf('run: npm run test:smoke')<yml.indexOf('npx electron-builder'));
});
test('Publisher-overwritten smoke script is restored exactly from the protected bundle',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'temka-ci-smoke-'));
 try{
  fs.cpSync(path.join(root,'native-bundle'),path.join(temp,'native-bundle'),{recursive:true});fs.mkdirSync(path.join(temp,'scripts'),{recursive:true});
  fs.writeFileSync(path.join(temp,'scripts/smoke-electron.cjs'),"// Old Publisher selector: name: 'Сохранить'\nthrow Error('old template');\n");
  const {restoreNative,TARGETS}=await restore();assert(TARGETS.includes('scripts/smoke-electron.cjs'));assert(TARGETS.includes('tests/ci-smoke.test.cjs'));
  restoreNative(temp,{verify:false});assert.equal(fs.readFileSync(path.join(temp,'scripts/smoke-electron.cjs'),'utf8'),protectedSmoke());
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('corrupt protected smoke stops restoration before touching any output',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'temka-ci-smoke-corrupt-'));
 try{
  fs.cpSync(path.join(root,'native-bundle'),path.join(temp,'native-bundle'),{recursive:true});fs.mkdirSync(path.join(temp,'scripts'),{recursive:true});
  const output=path.join(temp,'scripts/smoke-electron.cjs');fs.writeFileSync(output,'original');
  fs.appendFileSync(path.join(temp,'native-bundle/scripts/smoke-electron.cjs'),'corrupt');
  const {restoreNative}=await restore();assert.throws(()=>restoreNative(temp,{verify:false}),/checksum mismatch/);assert.equal(fs.readFileSync(output,'utf8'),'original');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
