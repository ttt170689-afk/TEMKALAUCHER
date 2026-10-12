'use strict';
const semver=require('semver');
const yaml=require('js-yaml');
const REPO='ttt170689-afk/TEMKALAUCHER';
const WEB=`https://github.com/${REPO}/releases`;
// Only small public metadata is fetched here. Installers are downloaded by electron-updater.
async function readText(url,{fetchImpl=fetch,maxBytes=512*1024}={}) {
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
 try {
  const response=await fetchImpl(url,{signal:controller.signal,cache:'no-store',headers:{'Accept':'application/vnd.github+json','Cache-Control':'no-cache','User-Agent':'TemkaLauncher-update-check'}});
  if(!response.ok) throw Error(`GitHub HTTP ${response.status}${response.status===403||response.status===429?' (лимит запросов или запрет доступа)':''}`);
  const reader=response.body.getReader();const chunks=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Error('Слишком большой ответ сервера обновлений.');}chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks).toString('utf8');
 } catch(error){if(error.name==='AbortError')throw Error('GitHub не ответил за 15 секунд. Проверь интернет и повтори.');throw error;}
 finally{clearTimeout(timer);}
}
function validateRelease(release,platform) {
 const version=String(release?.tag_name||'').replace(/^v/,'');
 if(!/^v?\d+\.\d+\.\d+$/.test(release?.tag_name||'')||!semver.valid(version)||semver.prerelease(version)||release.draft||release.prerelease||!Array.isArray(release.assets))throw Error('GitHub не вернул корректный обычный релиз.');
 const manifest=platform==='linux'?'latest-linux.yml':'latest.yml';
 const expected=platform==='linux'?new RegExp(`^TemkaLauncher-${version.replaceAll('.','\\.') }-(x64|x86_64)\\.AppImage$`):new RegExp(`^TemkaLauncher-Setup-${version.replaceAll('.','\\.')}-x64\\.exe$`);
 const base=`${WEB}/download/${release.tag_name}/`;
 const asset=release.assets.find(a=>a.name===manifest);
 const installer=release.assets.find(a=>expected.test(a.name));
 if(!asset||!installer||asset.browser_download_url!==base+manifest||installer.browser_download_url!==base+installer.name||!(installer.size>0))throw Error(`Релиз ${version} ещё не готов: нет корректного ${manifest} или установщика для этой платформы.`);
 return {version,base,manifest,installer,assets:release.assets,releaseUrl:`${WEB}/tag/${release.tag_name}`};
}
function validateManifest(text,release) {
 const info=yaml.load(text,{schema:yaml.JSON_SCHEMA});
 if(info?.version!==release.version)throw Error(`Версии не совпали: GitHub ${release.version}, манифест ${info?.version||'неизвестно'}. Обновление не подтверждено.`);
 if(!Array.isArray(info.files)||!info.files.length||info.files.length>8)throw Error('Некорректный список файлов манифеста.');
 const names=new Set();
 for(const file of info.files){
  const asset=release.assets.find(a=>a.name===file.url);
  if(!/^[A-Za-z0-9._-]+$/.test(file.url||'')||names.has(file.url)||!asset||asset.browser_download_url!==release.base+file.url||file.size!==asset.size||!(file.size>0)||!/[A-Za-z0-9+/]{86}==/.test(file.sha512||'')||(file.sha512||'').length!==88||Buffer.from(file.sha512,'base64').length!==64)throw Error('Манифест не содержит согласованного файла с размером и SHA-512.');
  names.add(file.url);
 }
 if(!names.has(release.installer.name)||(info.path&&!names.has(info.path)))throw Error('Не найден файл для текущей платформы.');
 return info;
}
function createReleaseSource({platform=process.platform,fetchImpl=fetch,now=()=>Date.now()}={}) {
 return async()=>{
  const nonce=`${now()}-${Math.random().toString(36).slice(2)}`;
  const text=await readText(`https://api.github.com/repos/${REPO}/releases/latest?temka_check=${nonce}`,{fetchImpl});
  let data;try{data=JSON.parse(text);}catch{throw Error('Некорректный JSON от GitHub.');}
  const release=validateRelease(data,platform);
  const manifest=await readText(`${release.base}${release.manifest}?temka_check=${nonce}`,{fetchImpl,maxBytes:128*1024});
  const checked=validateManifest(manifest,release);
  return {version:release.version,expectedFile:checked.files.find(f=>f.url===release.installer.name),expectedFiles:checked.files,feedUrl:release.base,releaseUrl:release.releaseUrl,checkedAt:new Date(now()).toISOString(),source:'GitHub API + манифест релиза'};
 };
}
module.exports={createReleaseSource,validateRelease,validateManifest,readText};
