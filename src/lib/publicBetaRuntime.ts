import type {BetaPlatform} from './publicBeta';
type Result={phase:string;progress?:number;folder?:string};
function bridge(){const b=(window as unknown as {temka?:{platform?:string;betaGame?:{status:(o:unknown)=>Promise<Result>;install:(o:unknown)=>Promise<Result>;launch:(o:unknown)=>Promise<Result>;onProgress:(cb:(s:Result)=>void)=>()=>void}}}).temka;if(!b?.betaGame||b.platform!=='win32')throw Error('Нужен Windows-лаунчер1.9.10 из полного ZIP через Publisher. Браузерный предпросмотр не устанавливает и не запускает EXE.');return b.betaGame;}
export function betaPlatform():BetaPlatform{const t=(window as unknown as {temka?:{platform?:string}}).temka;return t?.platform==='win32'?'windows':'unsupported';}
export async function betaAction(kind:'status'|'install'|'launch'|'settings',token:string,accepted:boolean):Promise<Result>{if(kind==='settings')throw Error('Эта настройка только Android.');return bridge()[kind]({game:'fantazia',token,accepted});}
export function onBetaProgress(cb:(s:Result)=>void){try{return bridge().onProgress(cb);}catch{return ()=>{};}}
export function useBetaBack(_close:()=>void){}
