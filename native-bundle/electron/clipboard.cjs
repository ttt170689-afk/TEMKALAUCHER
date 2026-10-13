// Write-only IPC capability. OS read-back stays in main; renderer cannot read clipboard.
function createClipboardWriter(clipboard) {
 return async text => {
  if(typeof text!=='string'||text.length===0||text.length>4096||text.includes('\0'))
   return {ok:false,error:'Некорректный текст для копирования.'};
  try {
   await clipboard.writeText(text);
   if(await clipboard.readText()!==text)return {ok:false,error:'Буфер обмена не подтвердил копирование.'};
   return {ok:true};
  } catch {
   return {ok:false,error:'Не удалось записать текст в системный буфер обмена.'};
  }
 };
}
module.exports={createClipboardWriter};
