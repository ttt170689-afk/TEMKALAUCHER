import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {getCloudClient,ONLINE_CHANGED,onlineEnabled} from './online';
import type {OnlineProfile,Friendship} from './online';
import {onlineError} from './friendContract';
type Mode='checking'|'disabled'|'signedOut'|'unverified'|'verified'|'error';
interface State{mode:Mode;profile:OnlineProfile|null;friends:Friendship[];error:string;friendsError:string;loading:boolean;updated:number|null;}
const empty:State={mode:'checking',profile:null,friends:[],error:'',friendsError:'',loading:false,updated:null};
interface AccountContext extends State {client:ReturnType<typeof getCloudClient>;refresh:()=>Promise<void>;action:(job:()=>Promise<unknown>,message?:string)=>Promise<boolean>;busy:boolean;actionError:string;notice:string;clearMessage:()=>void;}
const Context=createContext<AccountContext|null>(null);
export function OnlineAccountProvider({localId,children}:{localId:string;children:ReactNode}){
 const client=useMemo(()=>getCloudClient(localId),[localId]);
 const [state,setState]=useState<State>(empty),[busy,setBusy]=useState(false),[actionError,setActionError]=useState(''),[notice,setNotice]=useState('');
 const alive=useRef(true),epoch=useRef(0),inFlight=useRef<Promise<void>|null>(null),queued=useRef(false),actionLock=useRef(false);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),8000);return()=>clearTimeout(timer);},[notice]);
 const refresh=useCallback(():Promise<void>=>{
  if(inFlight.current){queued.current=true;return inFlight.current;}
  const request=async()=>{
   do{
    queued.current=false;const ticket=epoch.current,me=client.session?.user.id;
    const valid=()=>alive.current&&ticket===epoch.current&&client.session?.user.id===me;
    if(!onlineEnabled||!me){if(alive.current)setState({...empty,mode:onlineEnabled?'signedOut':'disabled'});continue;}
    setState(s=>({...s,loading:true,error:''}));
    try{
     if(!await client.emailVerified()){if(valid())setState({...empty,mode:'unverified'});continue;}
     if(!valid())continue;
     const profile=await client.ownProfile();if(!valid())continue;
     // Identity is independent of friendship failures: a list error must not turn into another OTP form.
     setState(s=>({...s,mode:'verified',profile,error:'',friendsError:''}));
     try{const friends=await client.friends();if(valid())setState(s=>({...s,friends,updated:Date.now(),friendsError:''}));}
     catch(error){if(valid())setState(s=>({...s,friends:[],friendsError:onlineError(error)}));}
    }catch(error){if(valid())setState({...empty,mode:'error',error:onlineError(error)});}
    finally{if(valid())setState(s=>({...s,loading:false}));}
   }while(queued.current&&alive.current);
  };
  inFlight.current=request().finally(()=>{inFlight.current=null;});return inFlight.current;
 },[client]);
 useEffect(()=>{
  alive.current=true;void refresh();
  const change=(event:Event)=>{if((event as CustomEvent).detail?.localId!==localId)return;epoch.current++;setActionError('');setNotice('');setState({...empty,mode:client.session?'checking':'signedOut'});void refresh();};
  const visible=()=>{if(!document.hidden)void refresh();};
  const timer=window.setInterval(()=>{if(!document.hidden&&!actionLock.current)void refresh();},30000);
  window.addEventListener(ONLINE_CHANGED,change);window.addEventListener('focus',visible);window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);
  return()=>{alive.current=false;epoch.current++;clearInterval(timer);window.removeEventListener(ONLINE_CHANGED,change);window.removeEventListener('focus',visible);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);};
 },[localId,refresh,client]);
 async function action(job:()=>Promise<unknown>,message=''){
  if(actionLock.current)return false;actionLock.current=true;setBusy(true);setActionError('');setNotice('');const me=client.session?.user.id;
  try{await job();if(!alive.current||client.session?.user.id!==me)return false;await refresh();if(alive.current&&client.session?.user.id===me)setNotice(message);return true;}
  catch(error){if(alive.current&&client.session?.user.id===me){await refresh();if(alive.current&&client.session?.user.id===me)setActionError(onlineError(error));}return false;}
  finally{actionLock.current=false;if(alive.current)setBusy(false);}
 }
 return <Context.Provider value={{...state,client,refresh,action,busy,actionError,notice,clearMessage:()=>{setActionError('');setNotice('');}}}>{children}</Context.Provider>;
}
export function useOnlineAccount(){const value=useContext(Context);if(!value)throw Error('Online account provider is missing');return value;}
