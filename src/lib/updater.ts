import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from './settings';
import { useToast } from './toast';
import { APP_VERSION } from './version';
export interface UpdateInfo {latest:string;current:string;date?:string;notes:string[];source?:string;checkedAt?:string;releaseUrl?:string;comparison?:string;}
export type UpdPhase='idle'|'checking'|'latest'|'available'|'downloading'|'extracting'|'ready'|'error';
type Result={ok:boolean;available?:boolean;current?:string;latest?:string;error?:string;state?:string} & Partial<UpdateInfo>;
type EventState={phase:string;progress?:number;speed?:number;latest?:string;error?:string};
interface Api {update?:{check:()=>Promise<Result>;install:()=>Promise<Result>;relaunch:()=>Promise<{ok?:boolean;error?:string}>;onProgress:(cb:(s:EventState)=>void)=>()=>void};}
const web=()=>(window as unknown as {temka?:Api}).temka;
export function useAutoUpdate(auto=true) {
 const {s}=useSettings();const {push}=useToast();
 const [phase,setPhase]=useState<UpdPhase>('idle');const phaseRef=useRef<UpdPhase>('idle');
 const [info,setInfo]=useState<UpdateInfo>({current:APP_VERSION,latest:'—',notes:[]});
 const [error,setError]=useState('');const [progress,setProgress]=useState(0);const [speed,setSpeed]=useState(0);const [dismissed,setDismissed]=useState(false);
 const job=useRef<Promise<Result>|null>(null);const infoRef=useRef(info);infoRef.current=info;
 const change=useCallback((value:UpdPhase)=>{phaseRef.current=value;setPhase(value);window.dispatchEvent(new CustomEvent('temka-update-state',{detail:{phase:value}}));},[]);
 const fail=useCallback((message:string)=>{setError(message);setDismissed(false);change('error');},[change]);
 const check=useCallback(():Promise<Result>=>{
  if(job.current)return job.current;
  if(['downloading','extracting','ready'].includes(phaseRef.current)){setDismissed(false);return Promise.resolve({ok:true,available:true,state:phaseRef.current,...infoRef.current});}
  setDismissed(false);setError('');change('checking');
  job.current=(async()=>{
   try{
    if(!web()?.update)throw Error('Автообновление доступно в установленном Windows-приложении или Linux AppImage.');
    const r=await web()!.update!.check();
    if(!r.ok)throw Error(r.error||'Не удалось проверить GitHub.');
    if(!/^\d+\.\d+\.\d+$/.test(r.current||'')||!/^\d+\.\d+\.\d+$/.test(r.latest||'')||typeof r.available!=='boolean')throw Error('Ответ обновления неполный. Статус актуальности не подтверждён.');
    const a=r.latest!.split('.').map(Number),b=r.current!.split('.').map(Number);const diff=a.map((v,i)=>v-b[i]).find(v=>v!==0)||0;
    if(r.available!==(diff>0))throw Error('Версии и статус обновления противоречат друг другу. Повтори проверку.');
    setInfo({current:r.current!,latest:r.latest!,source:r.source,checkedAt:r.checkedAt,comparison:r.comparison,releaseUrl:r.releaseUrl,notes:r.notes||[],date:r.date});
    change(r.state==='ready'?'ready':r.state==='downloading'?'downloading':r.available?'available':'latest');return r;
   }catch(e){const message=e instanceof Error?e.message:String(e);fail(message);return {ok:false,error:message};}
  })().finally(()=>{job.current=null;});return job.current;
 },[change,fail]);
 const install=useCallback(async()=>{
  if(!web()?.update||['downloading','ready','checking'].includes(phaseRef.current))return;
  setError('');setProgress(0);setDismissed(false);change('downloading');
  try{const r=await web()!.update!.install();if(!r.ok)throw Error(r.error||'Ошибка загрузки.');}
  catch(e){fail(e instanceof Error?e.message:String(e));}
 },[change,fail]);
 const relaunch=useCallback(async()=>{try{const r=await web()?.update?.relaunch();if(r?.ok===false)fail(r.error||'Не удалось применить обновление.');}catch(e){fail(String(e));}},[fail]);
 const download=useCallback(()=>window.open('https://github.com/ttt170689-afk/TEMKALAUCHER/releases/latest','_blank','noopener'),[]);
 const later=useCallback(()=>setDismissed(true),[]);
 useEffect(()=>web()?.update?.onProgress(st=>{
  if(st.phase==='downloading'){change('downloading');setProgress(st.progress||0);setSpeed(st.speed||0);}
  else if(st.phase==='done'){change('ready');setDismissed(false);setInfo(prev=>({...prev,latest:st.latest||prev.latest}));}
  else if(st.phase==='error')fail(st.error||'Ошибка обновления.');
 }),[change,fail]);
 useEffect(()=>{if(!auto||!s.autoUpdates)return;const id=setTimeout(()=>void check(),1600);return()=>clearTimeout(id);},[auto,s.autoUpdates,check]);
 useEffect(()=>{if(!auto||!s.autoUpdates||!s.periodicCheck)return;const id=setInterval(()=>void check(),300000);return()=>clearInterval(id);},[auto,s.autoUpdates,s.periodicCheck,check]);
 useEffect(()=>{if(phase!=='available'||!s.autoUpdates||!s.autoInstall||dismissed)return;const id=setTimeout(()=>void install(),2500);return()=>clearTimeout(id);},[phase,s.autoUpdates,s.autoInstall,dismissed,install]);
 useEffect(()=>{let manual=false;const on=()=>{if(manual)return;manual=true;void check().then(r=>{if(!r.ok)push('warn','Проверка не удалась',r.error);}).finally(()=>{manual=false;window.dispatchEvent(new CustomEvent('temka-update-state',{detail:{phase:phaseRef.current}}));});};window.addEventListener('temka-check-updates',on);return()=>window.removeEventListener('temka-check-updates',on);},[check,push]);
 return {phase,info,error,progress,speed,dismissed,webMode:!web()?.update,check,install,relaunch,later,download};
}
