'use strict';
const semver=require('semver');
const yaml=require('js-yaml');
const WEB='https://github.com/ttt170689-afk/TEMKALAUCHER/releases';
// No GitHub REST API or embedded token. Small release manifests + HEAD only.
function httpError(status){return Error(`GitHub Releases HTTP ${status}. ${status===403||status===429?'Доступ к файлам релиза ограничен; это не подтверждение актуальной версии.':'Не удалось получить файл релиза.'}`);}
async function request(url,{fetchImpl=fetch,head=false,maxBytes=128*1024}={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetchImpl(url,{method:head?'HEAD':'GET',signal:controller.signal,cache:'no-store',headers:{'Accept':'*/*','Cache-Control':'no-cache','User-Agent':'TemkaLauncher-release-check'}});
  if(!response.ok)throw httpError(response.status);
  if(head)return response;
  const reader=response.body.getReader();const chunks=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Error('Слишком большой манифест обновления.');}chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks).toString('utf8');
 }catch(error){if(error.name==='AbortError')throw Error('Файлы GitHub не ответили за 15 секунд. Повтори проверку позже.');throw error;}
 finally{clearTimeout(timer);}
}
async function readText(url,options){return request(url,options);}
function parseManifest(text,platform){
 const info=yaml.load(text,{schema:yaml.JSON_SCHEMA});
 const version=info?.version;
 if(typeof version!=='string'||!/^\d+\.\d+\.\d+$/.test(version)||!semver.valid(version)||semver.prerelease(version))throw Error('Манифест не содержит корректную обычную версию.');
 if(!Array.isArray(info.files)||!info.files.length||info.files.length>8)throw Error('Некорректный список файлов обновления.');
 const v=version.replaceAll('.','\\.');
 const allowed=platform==='linux'?new RegExp(`^TemkaLauncher-${v}-(?:(?:x64|x86_64)\\.AppImage|amd64\\.deb)$`):new RegExp(`^TemkaLauncher-Setup-${v}-x64\\.exe$`);
 const names=new Set();
 for(const file of info.files){
  if(!file||typeof file.url!=='string'||!allowed.test(file.url)||names.has(file.url)||!Number.isSafeInteger(file.size)||file.size<=0||! /^[A-Za-z0-9+/]{86}==$/.test(file.sha512||'')||Buffer.from(file.sha512,'base64').length!==64)throw Error('Некорректное имя, размер или SHA-512 файла обновления.');
  names.add(file.url);
 }
 if(info.path&&!names.has(info.path))throw Error('Путь обновления не совпал со списком файлов.');
 const installer=info.files.find(f=>f.url.endsWith(platform==='linux'?'.AppImage':'.exe'));
 if(!installer)throw Error('Нет установщика для этой платформы.');
 return {version,files:info.files,installer};
}
function sameFiles(a,b){return a.version===b.version&&a.files.length===b.files.length&&a.files.every(f=>b.files.some(g=>f.url===g.url&&f.size===g.size&&f.sha512===g.sha512));}
function createReleaseSource({platform=process.platform,fetchImpl=fetch,now=()=>Date.now()}={}){
 return async()=>{
  const nonce=`${now()}-${Math.random().toString(36).slice(2)}`;
  const name=platform==='linux'?'latest-linux.yml':'latest.yml';
  const latest=parseManifest(await readText(`${WEB}/latest/download/${name}?temka_check=${nonce}`,{fetchImpl}),platform);
  const feedUrl=`${WEB}/download/v${latest.version}/`;
  const pinned=parseManifest(await readText(`${feedUrl}${name}?temka_check=${nonce}`,{fetchImpl}),platform);
  if(!sameFiles(latest,pinned))throw Error('Манифесты latest и конкретного релиза не совпали. Повтори проверку: публикация могла измениться.');
  // HEAD proves the selected asset exists without fetching the installer body.
  const response=await request(feedUrl+pinned.installer.url,{fetchImpl,head:true});
  const size=response.headers.get('content-length');
  if(size!==null&&(!/^\d+$/.test(size)||Number(size)!==pinned.installer.size))throw Error('Размер установщика на сервере не совпал с манифестом.');
  return {version:pinned.version,expectedFile:pinned.installer,expectedFiles:pinned.files,feedUrl,releaseUrl:`${WEB}/tag/v${pinned.version}`,checkedAt:new Date(now()).toISOString(),source:'GitHub Releases · напрямую, без API'};
 };
}
module.exports={createReleaseSource,parseManifest,sameFiles,readText};
