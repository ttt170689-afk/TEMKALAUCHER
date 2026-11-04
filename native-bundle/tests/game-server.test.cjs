const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{EventEmitter}=require('node:events');
const {GAME_SERVER,prepareGameServer}=require('../electron/game-server.cjs');
const {createBetaGame,PACKAGE}=require('../electron/beta-game.cjs');
const {fixture}=require('./portable-fixture.cjs');
function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'temka-server-profile-'));}
const remove=t=>fs.rmSync(t,{recursive:true,force:true});
test('original game server constant is pinned and production IPC supplies native appData path',()=>{
 assert.equal(GAME_SERVER,'https://fantazia-rp-3d1.onrender.com/');assert.equal(PACKAGE.server,GAME_SERVER);
 const main=fs.readFileSync(path.resolve(__dirname,'../electron/main.cjs'),'utf8');assert(main.includes("getAppDataPath:()=>app.getPath('appData')"));
});
test('first launch seeds original game version1 server.json and pins its dedicated profile',async()=>{
 const t=temp();try{const c=await prepareGameServer(t),profile=path.join(t,'Fantazia RP 3D');assert.equal(c.seeded,1);assert.deepEqual(c.args,['--user-data-dir='+profile]);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,'server.json'))),{version:1,url:GAME_SERVER});assert.equal((await prepareGameServer(t)).seeded,0);}finally{remove(t);}
});
test('existing original profile and account/cookie bytes are retained without migration',async()=>{
 const t=temp();try{const p=path.join(t,'FantaziaRP3D'),cookies=path.join(p,'Partitions/fantazia-online-v1');fs.mkdirSync(cookies,{recursive:true});fs.writeFileSync(path.join(cookies,'Cookies'),'existing-private-session-fixture');const c=await prepareGameServer(t);assert.equal(c.seeded,1);assert.deepEqual(c.args,['--user-data-dir='+p]);assert.equal(fs.readFileSync(path.join(cookies,'Cookies'),'utf8'),'existing-private-session-fixture');assert(!fs.existsSync(path.join(t,'Fantazia RP 3D')));}finally{remove(t);}
});
test('saved server config is never overwritten, even if custom/old/malformed',async()=>{
 const t=temp();try{const p=path.join(t,'Fantazia RP 3D');fs.mkdirSync(p);for(const text of ['{"version":1,"url":"https://another-server.invalid/","extra":"keep"}\n','old malformed config','{"url":""}']){fs.writeFileSync(path.join(p,'server.json'),text);assert.equal((await prepareGameServer(t)).seeded,0);assert.equal(fs.readFileSync(path.join(p,'server.json'),'utf8'),text);}}finally{remove(t);}
});
test('multiple legacy profiles do not force-switch accounts; only missing configs are seeded',async()=>{
 const t=temp();try{for(const n of ['Fantazia RP 3D','fantazia-rp-desktop'])fs.mkdirSync(path.join(t,n));fs.writeFileSync(path.join(t,'fantazia-rp-desktop/server.json'),'{"url":"https://existing.invalid/"}');const c=await prepareGameServer(t);assert.equal(c.seeded,1);assert.deepEqual(c.args,[]);assert.equal(fs.readFileSync(path.join(t,'fantazia-rp-desktop/server.json'),'utf8'),'{"url":"https://existing.invalid/"}');}finally{remove(t);}
});
test('server profile helper rejects relative paths and unexpected config directories',async()=>{
 await assert.rejects(prepareGameServer('relative'),/профиля/);const t=temp();try{fs.mkdirSync(path.join(t,'Fantazia RP 3D/server.json'),{recursive:true});await assert.rejects(prepareGameServer(t),/ссылкой или папкой/);}finally{remove(t);}
});
test('server config symlinks cannot redirect writes outside the game profile',{skip:process.platform==='win32'},async()=>{
 const t=temp();try{const outside=path.join(t,'private');fs.writeFileSync(outside,'do not touch');fs.mkdirSync(path.join(t,'Fantazia RP 3D'));fs.symlinkSync(outside,path.join(t,'Fantazia RP 3D/server.json'));await assert.rejects(prepareGameServer(t),/ссылкой/);assert.equal(fs.readFileSync(outside,'utf8'),'do not touch');}finally{remove(t);}
});
test('native Play sets default server only after approval + verified install, before spawning original EXE',async()=>{
 const t=temp(),{body,descriptor}=fixture();let allowed=false,spawned=0;
 const appData=path.join(t,'appData');
 const manager=createBetaGame({platform:'win32',getDataPath:()=>path.join(t,'ledger'),getDefaultRoot:()=>path.join(t,'games'),getAppDataPath:()=>appData,descriptor,minimumFreeBytes:0,checkAccess:async()=>{if(!allowed)throw Error('denied');},fetchImpl:async()=>new Response(body),spawnImpl:(exe,args,options)=>{spawned++;assert.equal(options.shell,false);assert.equal(JSON.parse(fs.readFileSync(path.join(appData,'Fantazia RP 3D/server.json'))).url,GAME_SERVER);assert.deepEqual(args,['--user-data-dir='+path.join(appData,'Fantazia RP 3D')]);const c=new EventEmitter();c.unref=()=>{};setTimeout(()=>c.emit('spawn'),0);return c;}}),o={game:'fantazia',token:'synthetic',accepted:true};
 try{await assert.rejects(manager.launch(o),/denied/);assert(!fs.existsSync(appData));allowed=true;await assert.rejects(manager.launch(o),/не найдена/);assert(!fs.existsSync(appData));await manager.install(o);assert(!fs.existsSync(appData));await manager.launch(o);assert.equal(spawned,1);assert.equal((await manager.status(o)).phase,'running');}finally{remove(t);}
});
