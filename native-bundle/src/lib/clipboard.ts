type CopyResult={ok:boolean;error?:string};
type CopyBridge={copyText?:(text:string)=>Promise<CopyResult>};
// Electron uses a narrow, trusted main-process IPC instead of granting browser permissions.
export async function copyText(text:string):Promise<void>{
 if(typeof text!=='string'||!text.length||text.length>4096||text.includes('\0'))throw Error('Некорректный текст для копирования.');
 const native=(window as unknown as {temka?:CopyBridge}).temka;
 if(native){
  if(typeof native.copyText!=='function')throw Error('Обнови лаунчер для системного копирования.');
  const result=await native.copyText(text);
  if(result?.ok!==true)throw Error(result?.error||'Не удалось скопировать текст.');
  return;
 }
 if(!navigator.clipboard?.writeText)throw Error('Буфер обмена недоступен. Выдели текст и скопируй вручную.');
 await navigator.clipboard.writeText(text);
}
