// Test-only lifecycle. Never kill by process name or touch a real launcher profile.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const run = promisify(execFile);
const exited = child => child.exitCode !== null || child.signalCode !== null;
async function bounded(promise, ms) {
 let timer;
 try { return await Promise.race([Promise.resolve(promise).then(()=>true,()=>false),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),ms);})]); }
 finally { clearTimeout(timer); }
}
async function waitForExit(child, ms) {
 if(exited(child))return true;
 let listener;
 try { return await bounded(new Promise(resolve=>{listener=()=>resolve();child.once('exit',listener);}),ms); }
 finally { child.removeListener('exit',listener); }
}
async function stopElectron(app,{platform=process.platform,runCommand=run,closeTimeout=8000,exitTimeout=10000}={}) {
 const child=app.process();
 if(!child || !Number.isSafeInteger(child.pid) || child.pid<=0)throw Error('Fixture has no owned Electron PID');
 await bounded(Promise.resolve().then(()=>app.close()),closeTimeout);
 let forced=false;
 if(!exited(child)) {
  forced=true;
  // On Windows kill() only kills the browser parent, leaving cache-locking children.
  if(platform==='win32') {
   try { await runCommand('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:10000}); }
   catch(error) { if(!exited(child))throw error; }
  } else if(!exited(child))child.kill('SIGKILL');
 }
 if(!await waitForExit(child,exitTimeout))throw Error('Owned Electron fixture process did not exit');
 return {forced};
}
async function cleanupFixture(directory,{rm=fs.promises.rm,warn=console.warn}={}) {
 const target=path.resolve(directory);
 if(path.dirname(target)!==path.resolve(os.tmpdir()) || !/^temka-game-io-[a-zA-Z0-9]+$/.test(path.basename(target)))throw Error('Refusing cleanup outside owned game-io temp fixture');
 try { await rm(target,{recursive:true,force:true,maxRetries:8,retryDelay:150});return true; }
 catch(error) {
  // Windows may briefly retain Chromium cache handles after all processes exited.
  // A leftover synthetic OS-temp directory is not a failed game integrity test.
  if(!['EBUSY','EPERM','ENOTEMPTY','EACCES'].includes(error.code))throw error;
  warn(`WARN game-io temporary profile cleanup (${error.code}); left only synthetic fixture at ${target}`);
  return false;
 }
}
module.exports={stopElectron,cleanupFixture};
