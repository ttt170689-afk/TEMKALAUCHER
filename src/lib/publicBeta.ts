export const PUBLIC_BETA={gameId:'fantazia',title:'Fantazia RP 3D',version:'Beta 0.1',releaseUrl:'https://github.com/ttt170689-afk/fantazia-rp-3d1/releases/tag/v1.0',tag:'v1.0',checkedAt:'2026-11-02',assets:{
 windows:{delivery:'native',label:'Windows10/11 x64 · Portable1.0.1',filename:'Fantazia-RP-Portable-1.0.1-win-x64.zip',bytes:153178080,sha256:'111591e160f6005e3aa3cb49e43ddfdcbfaaec1b1be7168e108f4c920891eac5',url:'https://drive.usercontent.google.com/download?id=1hH7PxjQEu4bSDQDdi6r0gVEpDZ0glFZL&export=download&confirm=t'},
 android:{delivery:'bundled',label:'Android · TEST 1.0.2',filename:'Fantazia-RP-TEST-1.0.2-android.apk',bytes:2177542,sha256:'8b849f3f2edddedfbb9813e0022b1c2377f5139c5962ea5f1323d5b3eb40f330',packageName:'org.fantazia.rp3d.preview',versionName:'1.0.2-test',versionCode:10002,serverUrl:'https://fantazia-rp-3d1.onrender.com/',sourceUrl:'https://github.com/ttt170689-afk/fantazia-rp-3d1/actions/runs/41464800821/artifacts/13151186186'}
}} as const;
export type BetaPlatform='windows'|'android'|'unsupported';
export function betaAsset(platform:BetaPlatform){return platform==='windows'||platform==='android'?PUBLIC_BETA.assets[platform]:null;}
export function consentedBetaAsset(gameId:string,platform:BetaPlatform,accepted:boolean){
 if(gameId!==PUBLIC_BETA.gameId)throw Error('Для этой игры бета ещё не подключена.');
 if(accepted!==true)throw Error('Сначала подтверди предупреждение о бета-версии.');
 const asset=betaAsset(platform);if(!asset)throw Error('Сборки для этой платформы пока нет.');return asset;
}
export function consentedBetaUrl(_gameId:string,_platform:BetaPlatform,_accepted:boolean):string{throw Error('Получение файлов только через нативный лаунчер после проверки ключа.');}
export function isBetaDownloadUrl(url:string){return url===PUBLIC_BETA.assets.windows.url;}
export function betaSize(bytes:number){return bytes<1048576?(bytes/1024).toFixed(0)+' КиБ':(bytes/1048576).toFixed(1)+' МиБ';}
