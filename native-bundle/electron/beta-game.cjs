'use strict';
const fs=require('./game-fs.cjs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {pipeline}=require('node:stream/promises'),{Readable,Transform}=require('node:stream');
const {requireBeta}=require('./beta-access.cjs'),{extract,fileHash,safeName}=require('./game-zip.cjs');
const PACKAGE=Object.freeze({bytes:153178080,sha256:'111591e160f6005e3aa3cb49e43ddfdcbfaaec1b1be7168e108f4c920891eac5',inner:'Fantazia-RP-Portable-1.0.1-win-x64.zip',innerBytes:153173775,innerHash:'b769cd37505bc37403040bb65887d46dac9217eec1093c23445b8e4494fe9abb',exe:'Fantazia RP 3D.exe',url:'https://drive.usercontent.google.com/download?id=1hH7PxjQEu4bSDQDdi6r0gVEpDZ0glFZL&export=download&confirm=t',server:'https://fantazia-rp-3d1.onrender.com/'});
function createBetaGame({getDataPath,getDefaultRoot,fetchImpl=global.fetch,spawnImpl=spawn,platform=process.platform,emit=()=>{},descriptor=PACKAGE,minimumFreeBytes=1024*1024*1024,checkAccess=token=>requireBeta(token,fetchImpl)}){
 let phase='notInstalled',progress=0,job=null,child=null,launching=false,activeFolder='';
 const ledger=()=>path.join(getDataPath(),'fantazia-install-v1.json');
 const rootFile=()=>path.join(getDataPath(),'game-root-v1.json');
 const send=()=>emit({phase,progress});
 async function root(){try{const d=JSON.parse(await fs.promises.readFile(rootFile(),'utf8'));if(typeof d.path==='string'&&path.isAbsolute(d.path))return path.resolve(d.path);}catch{}return path.resolve(getDefaultRoot());}
 async function setRoot(value){if(job||child||launching)throw Error('Дождись установки и закрой игру перед сменой папки.');if(typeof value!=='string'||!path.isAbsolute(value)||(await fs.promises.lstat(value)).isSymbolicLink()||!(await fs.promises.stat(value)).isDirectory())throw Error('Нужна выбранная папка для игр.');await fs.promises.mkdir(getDataPath(),{recursive:true});await fs.promises.writeFile(rootFile(),JSON.stringify({path:path.resolve(value)}),{mode:0o600});}
 function input(o,consent=false){if(platform!=='win32')throw Error('Эта сборка игры доступна только Windows10/11 x64.');if(!o||o.game!=='fantazia'||consent&&o.accepted!==true)throw Error('Подтверди предупреждение о ранней бете.');}
 async function selectedRoot(o){
  if(o.root===undefined||o.root==='')return root();
  if(typeof o.root!=='string'||!path.isAbsolute(o.root)||o.root.length>1024||o.root.includes('\0'))throw Error('Нужен абсолютный путь папки из Настройки → Обзор.');
  const base=path.resolve(o.root);let st;try{st=await fs.promises.lstat(base);}catch{throw Error('Выбранная папка недоступна: '+base+'. Проверь диск и выбери её через Настройки → Обзор. В другую папку установка не перенаправляется.');}
  if(!st.isDirectory()||st.isSymbolicLink())throw Error('Выбери обычную папку для игр, не файл или ссылку.');return base;
 }
 async function record(full=false,base){
  base=base||await root();
  try{const d=JSON.parse(await fs.promises.readFile(ledger(),'utf8'));if(d.archive!==descriptor.sha256||d.root!==base||!d.files||Object.keys(d.files).length<3||Object.keys(d.files).length>256)return null;
   const dir=path.join(d.root,'Fantazia-RP-3D');if((await fs.promises.lstat(dir)).isSymbolicLink())return null;
   for(const [name,meta]of Object.entries(d.files)){safeName(name);if(name.endsWith('/'))return null;const f=path.join(dir,name);let parent=path.dirname(f);while(parent!==d.root){if((await fs.promises.lstat(parent)).isSymbolicLink())return null;parent=path.dirname(parent);}
    const st=await fs.promises.lstat(f);if(!st.isFile()||st.isSymbolicLink()||st.size!==meta.bytes||full&&await fileHash(f)!==meta.sha256)return null;
   }if(!d.files[descriptor.exe]||!d.files['resources/app.asar'])return null;
   if(full){let found=0;const scan=async(folder,depth=0)=>{if(depth>12)throw Error('Слишком глубокая папка игры.');for(const entry of await fs.promises.readdir(folder,{withFileTypes:true})){const f=path.join(folder,entry.name),st=await fs.promises.lstat(f);if(st.isSymbolicLink())throw Error('Ссылка в папке игры.');if(st.isDirectory())await scan(f,depth+1);else{const name=path.relative(dir,f).split(path.sep).join('/');if(!st.isFile()||!Object.prototype.hasOwnProperty.call(d.files,name)||++found>256)throw Error('Лишние файлы игры.');}}};await scan(dir);if(found!==Object.keys(d.files).length)return null;}
   return {dir,files:d.files};
  }catch{return null;}
 }
 async function status(o){input(o);await checkAccess(o.token);if(job)return {phase,progress,folder:activeFolder};const base=await selectedRoot(o),r=await record(false,base);return {phase:child?'running':r?'installed':'notInstalled',progress:0,folder:r?.dir||path.join(base,'Fantazia-RP-3D'),server:descriptor.server};}
 async function install(o){input(o,true);await checkAccess(o.token);if(job)throw Error('Загрузка игры уже выполняется.');if(child||launching)throw Error('Сначала закрой окно игры или дождись запуска.');
  // Set the lock before any asynchronous filesystem operations.
  job=(async()=>{const base=await selectedRoot(o),target=path.join(base,'Fantazia-RP-3D'),stage=path.join(base,'.fantazia-install-'+crypto.randomUUID());let published=false;activeFolder=target;
   try{
    if(await record(true,base)){phase='installed';send();return {phase};}
    try{await fs.promises.lstat(target);throw Error('Папка Fantazia-RP-3D уже существует, но проверенная установка не найдена. Выбери другую папку; чужие файлы не удаляются.');}catch(e){if(e.code!=='ENOENT')throw e;}
    await fs.promises.mkdir(stage,{recursive:true,mode:0o700});if(fs.promises.statfs){const space=await fs.promises.statfs(stage);if(space.bavail*space.bsize<minimumFreeBytes)throw Error('Для загрузки и распаковки нужно не менее1ГБ свободного места.');}
    phase='downloading';progress=0;send();const archive=path.join(stage,'artifact.zip');const url=descriptor.url+'&temka_check='+crypto.randomUUID();const response=await fetchImpl(url,{redirect:'follow',credentials:'omit',signal:AbortSignal.timeout(600000)});
    if(response.status!==200||!response.body){await response.body?.cancel();throw Error('Источник не отдал полный архив игры. Попробуй позже.');}
    const length=response.headers.get('content-length');if(length&&Number(length)!==descriptor.bytes){await response.body.cancel();throw Error('Размер архива игры на сервере изменился.');}
    let got=0,last=0;const digest=crypto.createHash('sha256');const counter=new Transform({transform(b,_enc,cb){got+=b.length;if(got>descriptor.bytes)return cb(Error('Архив больше ожидаемого.'));digest.update(b);progress=Math.floor(got/descriptor.bytes*100);if(Date.now()-last>200){last=Date.now();send();}cb(null,b);}});
    await pipeline(Readable.fromWeb(response.body),counter,fs.createWriteStream(archive,{flags:'wx',mode:0o600}));
    if(got!==descriptor.bytes||digest.digest('hex')!==descriptor.sha256)throw Error('Размер или SHA256 игрового архива не совпал. Установка отменена.');
    phase='extracting';progress=100;send();const outer=path.join(stage,'outer');await extract(archive,outer,{only:['PORTABLE-WINDOWS-RU.txt',descriptor.inner,'SHA256SUMS.txt']});
    const inner=path.join(outer,descriptor.inner);if((await fs.promises.stat(inner)).size!==descriptor.innerBytes||await fileHash(inner)!==descriptor.innerHash)throw Error('Внутренний ZIP игры не прошёл проверку.');
    const unpacked=path.join(stage,'game'),files=await extract(inner,unpacked);if(!files[descriptor.exe]||!files['resources/app.asar']||!files['icudtl.dat']||Object.keys(files).some(n=>n.toLowerCase().endsWith('.exe')&&n!==descriptor.exe))throw Error('Состав файлов Fantazia не подтверждён.');
    const exe=await fs.promises.open(path.join(unpacked,descriptor.exe),'r');try{const b=Buffer.alloc(2);await exe.read(b,0,2,0);if(b.toString()!=='MZ')throw Error('Не найден WindowsEXE игры.');}finally{await exe.close();}
    await checkAccess(o.token);await fs.promises.mkdir(getDataPath(),{recursive:true});await fs.promises.rename(unpacked,target);published=true;
    const temp=ledger()+'.tmp';await fs.promises.writeFile(temp,JSON.stringify({archive:descriptor.sha256,root:base,files}),{mode:0o600});await fs.promises.rename(temp,ledger());phase='installed';progress=100;send();return {phase,folder:target};
   }catch(e){phase='notInstalled';progress=0;send();if(published){/* Preserve files on disk if recording failed; never delete existing game data. */}throw e;}finally{await fs.promises.rm(stage,{recursive:true,force:true}).catch(()=>{});}
  })();try{return await job;}finally{job=null;}
 }
 async function launch(o){input(o,true);await checkAccess(o.token);if(job)throw Error('Дождись установки игры.');if(launching)throw Error('Запуск уже выполняется.');if(child)return {phase:'running'};launching=true;try{const base=await selectedRoot(o),r=await record(true,base);if(!r)throw Error('Проверенная игра не найдена или файлы изменились. Повторная установка не выполняется автоматически.');await checkAccess(o.token);
  return await new Promise((resolve,reject)=>{const proc=spawnImpl(path.join(r.dir,descriptor.exe),[],{cwd:r.dir,shell:false,windowsHide:false,stdio:'ignore'});proc.once('error',()=>{if(child===proc)child=null;reject(Error('Windows не смог запустить игру. Проверь защитное уведомление и файлы, не отключая защиту.'));});proc.once('spawn',()=>{child=proc;phase='running';send();proc.unref?.();resolve({phase:'running',server:descriptor.server});});proc.once('exit',()=>{if(child===proc){child=null;phase='installed';send();}});});}finally{launching=false;}
 }
 return {status,install,launch,setRoot,isBusy:()=>!!job||launching};
}
module.exports={PACKAGE,createBetaGame};
