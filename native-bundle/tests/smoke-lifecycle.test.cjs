const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events'),path=require('node:path'),os=require('node:os');
const {stopElectron,cleanupFixture}=require('../scripts/smoke-lifecycle.cjs');
function child(){const c=new EventEmitter();c.pid=12345;c.exitCode=null;c.signalCode=null;c.finish=()=>{c.exitCode=0;c.emit('exit',0,null);};return c;}
const directory=path.join(os.tmpdir(),'temka-game-io-Test123');
test('game-io graceful shutdown awaits the actual Electron exit before cleanup',async()=>{
 const c=child();let killed=false;
 const app={process:()=>c,close:async()=>{c.finish();}};
 assert.deepEqual(await stopElectron(app,{platform:'win32',runCommand:async()=>{killed=true;}}),{forced:false});assert.equal(killed,false);
});
test('game-io Windows timeout terminates only its owned PID AND descendant process tree, then waits for exit',async()=>{
 const c=child(),commands=[];c.kill=()=>assert.fail('Windows parent-only kill leaves Chromium children');
 const shutdown=await stopElectron({process:()=>c,close:()=>new Promise(()=>{})},{platform:'win32',closeTimeout:5,exitTimeout:1000,runCommand:async(...args)=>{commands.push(args);setTimeout(()=>c.finish(),10);}});
 assert.equal(shutdown.forced,true);assert.deepEqual(commands[0],['taskkill',['/PID','12345','/T','/F'],{windowsHide:true,timeout:10000}]);assert.equal(c.exitCode,0);
});
test('game-io Linux fallback also waits for process exit, not only kill delivery',async()=>{
 const c=child();c.kill=signal=>{assert.equal(signal,'SIGKILL');setTimeout(()=>c.finish(),10);return true;};
 assert.deepEqual(await stopElectron({process:()=>c,close:async()=>{throw Error('transport closed');}},{platform:'linux',exitTimeout:1000}),{forced:true});assert.equal(c.exitCode,0);
});
test('game-io cannot report success when its Electron process remains alive',async()=>{
 const c=child();await assert.rejects(stopElectron({process:()=>c,close:async()=>{}},{platform:'win32',runCommand:async()=>{},exitTimeout:5}),/did not exit/);
});
test('game-io taskkill failure is an error while its owned process is alive',async()=>{
 const c=child();await assert.rejects(stopElectron({process:()=>c,close:async()=>{}},{platform:'win32',runCommand:async()=>{throw Error('taskkill failed');}}),/taskkill failed/);
});
test('game-io does not taskkill an already exited PID even if Playwright close rejects',async()=>{
 const c=child();c.finish();assert.deepEqual(await stopElectron({process:()=>c,close:async()=>{throw Error('already gone');}},{platform:'win32',runCommand:async()=>assert.fail('must not target an exited PID')}),{forced:false});
});
test('game-io cleanup uses bounded Windows lock retries on its synthetic temp directory',async()=>{
 let options;assert.equal(await cleanupFixture(directory,{rm:async(target,o)=>{assert.equal(target,directory);options=o;}}),true);
 assert.deepEqual(options,{recursive:true,force:true,maxRetries:8,retryDelay:150});
});
test('game-io locked Chromium cache is a warning, not a masked integrity failure or hanging sync unlink',async()=>{
 for(const code of ['EBUSY','EPERM','ENOTEMPTY','EACCES']){let warning='';assert.equal(await cleanupFixture(directory,{rm:async()=>{throw Object.assign(Error('journal.baj locked'),{code});},warn:message=>{warning=message;}}),false);assert.match(warning,new RegExp(code));}
 await assert.rejects(cleanupFixture(directory,{rm:async()=>{throw Object.assign(Error('bad IO'),{code:'EIO'});}}),/bad IO/);
});
test('game-io refuses cleanup of user directories or unrelated temp paths',async()=>{
 for(const dir of [path.join(os.tmpdir(),'real-launcher-profile'),path.join(os.homedir(),'temka-game-io-Test123')])await assert.rejects(cleanupFixture(dir,{rm:async()=>assert.fail('outside owned fixture')}),/Refusing cleanup/);
});
