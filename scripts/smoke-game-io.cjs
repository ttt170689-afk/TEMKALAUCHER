// Real Electron filesystem integration. Tiny synthetic ZIP/fake EXE; no real game/network/Windows execution.
const {_electron:electron}=require('playwright'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const temp=fs.mkdtempSync(path.join(os.tmpdir(),'temka-game-io-'));let app;try{
 app=await electron.launch({args:[path.resolve(__dirname,'..'),'--disable-gpu','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND',`--user-data-dir=${path.join(temp,'profile')}`,...(process.platform==='linux'?['--no-sandbox']:[])]});
 await app.firstWindow();
 const result=await app.evaluate(async(_electron,data)=>{
  const req=process.mainModule.require.bind(process.mainModule),raw=req('original-fs'),p=req('node:path'),crypto=req('node:crypto'),{EventEmitter}=req('node:events');
  const {fixture}=req(p.join(data.root,'tests/portable-fixture.cjs')),{body,descriptor}=fixture();
  const old=p.join(data.temp,'C-old-Документы'),selected=p.join(data.temp,'E-temkagames');raw.mkdirSync(old);raw.mkdirSync(selected);
  const opts={platform:'win32',descriptor,minimumFreeBytes:0,checkAccess:async()=>{},fetchImpl:async()=>new Response(body),getDataPath:()=>p.join(data.temp,'ledger'),getDefaultRoot:()=>old,spawnImpl:()=>{const c=new EventEmitter();c.unref=()=>{};setTimeout(()=>c.emit('spawn'),0);return c;}};
  const {createBetaGame}=req(p.join(data.root,'electron/beta-game.cjs')),m=createBetaGame(opts);await m.setRoot(old);
  const o={game:'fantazia',token:'synthetic',accepted:true,root:selected};const before=await m.status(o),installed=await m.install(o),after=await m.status(o);const file=p.join(selected,'Fantazia-RP-3D/resources/app.asar'),bytes=raw.readFileSync(file),launched=await m.launch(o);
  let patchedError='';try{req('node:fs').readFileSync(file);}catch(e){patchedError=e.message;}
  return {before,installed,after,launched,asar:bytes.toString(),hash:crypto.createHash('sha256').update(bytes).digest('hex'),wrongCreated:raw.existsSync(p.join(old,'Fantazia-RP-3D')),patchedError,noAsar:!!process.noAsar};
 },{root:path.resolve(__dirname,'..'),temp});
 assert.equal(result.before.folder,path.join(temp,'E-temkagames/Fantazia-RP-3D'));assert.equal(result.after.phase,'installed');assert.equal(result.launched.phase,'running');assert.equal(result.asar,'synthetic');assert.equal(result.wrongCreated,false);assert.equal(result.noAsar,false);console.log(JSON.stringify(result,null,2));console.log('PASS real Electron ASAR-byte extraction/hash/record/fake launch + saved E root, no global ASAR switch or real EXE/network.');
 }finally{if(app){let timer;await Promise.race([app.close().catch(()=>{}),new Promise(resolve=>{timer=setTimeout(()=>{app.process().kill('SIGKILL');resolve();},4000);})]);clearTimeout(timer);}fs.rmSync(temp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
