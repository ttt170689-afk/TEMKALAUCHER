const {_electron:electron}=require('playwright');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
(async()=>{const profile=fs.mkdtempSync(path.join(os.tmpdir(),'temka-live-'));const args=[path.resolve(__dirname,'..'),'--disable-gpu',`--user-data-dir=${profile}`];if(process.platform==='linux')args.push('--no-sandbox');const app=await electron.launch({args,timeout:60000});try{
console.log('LIVE: launched');await app.firstWindow();console.log('LIVE: first window ready');
const source=await Promise.race([app.evaluate(async({net},filename)=>{const {createReleaseSource}=process.mainModule.require(filename);return await createReleaseSource({platform:'win32',fetchImpl:(url,options)=>net.fetch(url,options)})();},path.resolve(__dirname,'../electron/release-source.cjs')),new Promise((_,reject)=>setTimeout(()=>reject(Error('Live probe watchdog 40s')),40000).unref())]);
console.log('PASS REAL ELECTRON net.fetch:',JSON.stringify(source,null,2));
const result=await app.evaluate(async(_electron,source)=>{
 const req=process.mainModule.require('node:module').createRequire(source.moduleFile);
 const {NsisUpdater}=req('electron-updater');const {SemVer}=req('semver');
 const updater=new NsisUpdater();
 updater._testOnlyOptions={platform:'win32'}; // Metadata-only cross-platform test, not production config.
 updater.setFeedURL({provider:'generic',url:source.feedUrl});
 updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.forceDevUpdateConfig=true;
 updater.currentVersion=new SemVer('1.5.3');updater.on('error',()=>{});
 const answer=await updater.checkForUpdates();
 return {available:answer?.isUpdateAvailable,version:answer?.updateInfo?.version,files:answer?.updateInfo?.files,downloadStarted:!!answer?.downloadPromise};
},{...source,moduleFile:path.resolve(__dirname,'../electron/main.cjs')});
if(!result.available||result.version!==source.version||result.downloadStarted)throw Error('Actual NSIS metadata-only check failed: '+JSON.stringify(result));
console.log('PASS REAL NSIS ENGINE, TEST CURRENT=1.5.3, NO INSTALLER DOWNLOAD:',JSON.stringify(result));
}finally{const child=app.process();const timer=setTimeout(()=>child.kill('SIGKILL'),3000);try{await app.close();}finally{clearTimeout(timer);}fs.rmSync(profile,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exit(1)});
