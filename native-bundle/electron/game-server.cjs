'use strict';
// Configure the ORIGINAL game's external profile, never patch its verified ASAR.
const fs=require('./game-fs.cjs'),path=require('node:path');
const GAME_SERVER='https://fantazia-rp-3d1.onrender.com/';
// Product/app names of the original desktop client. Never scan arbitrary profiles.
const PROFILE_NAMES=['Fantazia RP 3D','FantaziaRP3D','fantazia-rp-desktop','Fantazia RP3D'];
async function stat(file){try{return await fs.promises.lstat(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function prepareGameServer(appData){
 if(typeof appData!=='string'||!path.isAbsolute(appData))throw Error('Не удалось определить папку профиля игры.');
 const base=path.resolve(appData),profiles=[];
 for(const name of PROFILE_NAMES){
  const dir=path.join(base,name),s=await stat(dir);
  if(!s)continue;
  if(!s.isDirectory()||s.isSymbolicLink())throw Error('Профиль Fantazia должен быть обычной папкой, не ссылкой: '+dir);
  profiles.push(dir);
 }
 if(!profiles.length)profiles.push(path.join(base,PROFILE_NAMES[0]));
 // Validate every existing config before writing anything. Preserve its exact bytes,
 // selected server, cookies and login. No migration or account/session copy.
 for(const dir of profiles){const s=await stat(path.join(dir,'server.json'));if(s&&(!s.isFile()||s.isSymbolicLink()))throw Error('Настройка сервера игры не должна быть ссылкой или папкой.');}
 let seeded=0;
 for(const dir of profiles){
  await fs.promises.mkdir(dir,{recursive:true,mode:0o700});
  let file;
  try{file=await fs.promises.open(path.join(dir,'server.json'),'wx',0o600);}
  catch(error){if(error.code==='EEXIST')continue;throw error;}
  try{await file.writeFile(JSON.stringify({version:1,url:GAME_SERVER})+'\n','utf8');seeded++;}
  finally{await file.close();}
 }
 // Pin a single existing/new profile so Electron reads precisely the seeded config.
 // Multiple legacy profiles: seed only missing configs, leave game's default choice
 // unchanged rather than guessing which account/cookie profile the user wanted.
 return {server:GAME_SERVER,seeded,profiles,args:profiles.length===1?['--user-data-dir='+profiles[0]]:[]};
}
module.exports={GAME_SERVER,PROFILE_NAMES,prepareGameServer};
