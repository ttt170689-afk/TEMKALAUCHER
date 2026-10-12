'use strict';
const fs = require('node:fs');
const path = require('node:path');
function createFolderPicker({dialog,getWindow,getDefaultPath,io=fs.promises}) {
  let pending=null;
  function choose(currentPath) {
    if (pending) return pending;
    pending=(async()=>{
      try {
        let defaultPath=getDefaultPath();
        if (typeof currentPath==='string' && currentPath.length<=4096 && !currentPath.includes('\0') && path.isAbsolute(currentPath)) {
          try {if((await io.stat(currentPath)).isDirectory()) defaultPath=currentPath;} catch {}
        }
        const result=await dialog.showOpenDialog(getWindow(),{title:'Папка для игр Temka',defaultPath,buttonLabel:'Выбрать папку',properties:['openDirectory','createDirectory']});
        if(result.canceled) return {ok:true,canceled:true};
        const selected=result.filePaths?.[0];
        if(typeof selected!=='string' || !path.isAbsolute(selected) || !(await io.stat(selected)).isDirectory()) throw new Error('Выберите существующую папку.');
        await io.access(selected,fs.constants.W_OK);
        return {ok:true,canceled:false,path:selected};
      } catch {return {ok:false,error:'Не удалось выбрать папку. Проверьте, что она существует и доступна для записи.'};}
    })().finally(()=>{pending=null;});
    return pending;
  }
  return {choose};
}
module.exports={createFolderPicker};
