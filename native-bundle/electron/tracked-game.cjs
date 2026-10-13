'use strict';
// Only a reviewed HTTPS game build may be enabled here. No arbitrary renderer URLs.
const CATALOG=Object.freeze({fantazia:null,temkaworld:null});
function createTrackedGames({BrowserWindow,getParent,emit,catalog=CATALOG,uuid=require('node:crypto').randomUUID}){
 let child=null,state=null;
 const send=()=>emit(state?{...state}:null);
 const close=()=>{const old=child;child=null;state=null;if(old&&!old.isDestroyed())old.destroy();send();};
 async function open(game){
  if(!Object.prototype.hasOwnProperty.call(catalog,game)||!catalog[game])throw Error('Игра пока недоступна: Скоро.');
  const url=new URL(catalog[game]);if(url.protocol!=='https:')throw Error('Недопустимый адрес игры.');close();
  const w=new BrowserWindow({width:1280,height:800,parent:getParent(),show:false,title:'Temka — игра',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,partition:'temka-isolated-game'}});child=w;
  w.webContents.session.setPermissionRequestHandler((_wc,_p,cb)=>cb(false));w.webContents.session.setPermissionCheckHandler(()=>false);
  const navigate=(e,target)=>{try{if(new URL(target).origin!==url.origin)e.preventDefault();}catch{e.preventDefault();}};
  w.webContents.on('will-navigate',navigate);w.webContents.on('will-redirect',navigate);w.webContents.on('will-attach-webview',e=>e.preventDefault());w.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  w.on('closed',()=>{if(child===w){child=null;state=null;send();}});
  w.webContents.on('did-navigate',(_e,_url,status)=>{if(status>=400&&child===w)close();});
  w.webContents.on('render-process-gone',()=>{if(child===w)close();});
  try{await w.loadURL(url.href);if(child!==w||w.isDestroyed())throw Error('Игра закрыта до загрузки.');state={game,launchId:uuid()};w.show();send();return {...state};}catch(e){if(child===w)close();throw e;}
 }
 return {open,close,current:()=>state?{...state}:null};
}
module.exports={CATALOG,createTrackedGames};
