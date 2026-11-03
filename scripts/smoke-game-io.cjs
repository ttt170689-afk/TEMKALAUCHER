// Real Electron filesystem integration. Tiny synthetic ZIP/fake EXE; no real game/network/Windows execution.
const {_electron:electron}=require('playwright'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {stopElectron,cleanupFixture}=require('./smoke-lifecycle.cjs');
(async()=>{const temp=fs.mkdtempSync(path.join(os.tmpdir(),'temka-game-io-'));let app,result,failure,shutdown,cleaned;try{
 app=await electron.launch({timeout:30000,args:[path.join(__dirname,'fixtures/game-io-main.cjs'),'--disable-gpu','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND',`--user-data-dir=${path.join(temp,'profile')}`,...(process.platform==='linux'?['--no-sandbox']:[])]});
 await app.firstWindow({timeout:15000});
 result=await app.evaluate(async(_electron,data)=>{
  const req=process.mainModule.require.bind(process.mainModule),raw=req('original-fs'),p=req('node:path'),crypto=req('node:crypto'),{EventEmitter}=req('node:events');
  const {fixture}=req(p.join(data.root,'tests/portable-fixture.cjs')),{body,descriptor}=fixture();
  const old=p.join(data.temp,'C-old-Документы'),selected=p.join(data.temp,'E-temkagames');raw.mkdirSync(old);raw.mkdirSync(selected);
  const opts={platform:'win32',descriptor,minimumFreeBytes:0,checkAccess:async()=>{},fetchImpl:async()=>new Response(body),getDataPath:()=>p.join(data.temp,'ledger'),getDefaultRoot:()=>old,spawnImpl:()=>{const c=new EventEmitter();c.unref=()=>{};setTimeout(()=>c.emit('spawn'),0);return c;}};
  const {createBetaGame}=req(p.join(data.root,'electron/beta-game.cjs')),m=createBetaGame(opts);await m.setRoot(old);
  const o={game:'fantazia',token:'synthetic',accepted:true,root:selected};const before=await m.status(o),installed=await m.install(o),after=await m.status(o);const file=p.join(selected,'Fantazia-RP-3D/resources/app.asar'),bytes=raw.readFileSync(file),launched=await m.launch(o);
  let patchedError='';try{req('node:fs').readFileSync(file);}catch(e){patchedError=e.message;}
  return {before,installed,after,launched,asar:bytes.toString(),hash:crypto.createHash('sha256').update(bytes).digest('hex'),wrongCreated:raw.existsSync(p.join(old,'Fantazia-RP-3D')),patchedError,noAsar:!!process.noAsar};
 },{root:path.resolve(__dirname,'..'),temp});
 assert.equal(result.before.folder,path.join(temp,'E-temkagames/Fantazia-RP-3D'));assert.equal(result.after.phase,'installed');assert.equal(result.launched.phase,'running');assert.equal(result.asar,'synthetic');assert.equal(result.wrongCreated,false);assert.equal(result.noAsar,false);assert.match(result.patchedError,/Invalid package/);assert.equal(result.hash,'b3cc0475bb78a5026098858e9889acf666d31062d513d303314eca31d36e72f2');
 }catch(error){failure=error;}finally{
  let safeToClean=!app;
  try{if(app)shutdown=await stopElectron(app);safeToClean=true;}catch(error){if(!failure)failure=error;else console.error('Additional fixture shutdown error:',error);}
  // Only after owned Electron exit; bounded async retries handle transient Windows locks.
  try{cleaned=safeToClean?await cleanupFixture(temp):false;}catch(error){if(!failure)failure=error;else console.error('Additional fixture cleanup error:',error);}
  const diagnostics=path.resolve(__dirname,'../test-results/electron-smoke');
  fs.mkdirSync(diagnostics,{recursive:true});fs.writeFileSync(path.join(diagnostics,'game-io.json'),JSON.stringify({result,shutdown,cleaned,error:failure?.stack||null},null,2));
 }
 if(failure)throw failure;
 console.log(JSON.stringify({result,shutdown,cleaned},null,2));
 console.log('PASS real Electron ASAR-byte extraction/hash/record/fake launch + saved E root, no global ASAR switch or real EXE/network.');
})().then(()=>finish(0),error=>{console.error(error);finish(1);});
// A one-shot fixture must not keep Node alive on an orphaned Playwright transport.
// Assertions AND awaited shutdown/cleanup have already completed; never force success.
function finish(code){process.stdout.write('',()=>process.stderr.write('',()=>process.exit(code)));}
