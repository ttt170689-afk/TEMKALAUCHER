import {isUUID} from './messaging';
import type {ActivitySession} from './messaging';
import type {TrackedBridge,GameLaunch} from './trackedGame';
export interface ActivityAPI{startActivity:(g:string,p:string,n:string)=>Promise<ActivitySession>;touchActivity:(id:string)=>Promise<boolean>;stopActivity:(id:string)=>Promise<unknown>;}
// Serial coordinator. Every heartbeat first checks the actual native game lifecycle.
export function createActivityTracker(api:ActivityAPI,bridge:TrackedBridge){
 let stopped=false,running=false,again=false,session:ActivitySession|null=null,launch:GameLaunch|null=null,rejected:string|null=null;
 const end=async()=>{const old=session;session=null;launch=null;if(old)try{await api.stopActivity(old.id);}catch{/* Server lease expires without heartbeats. */}};
 async function tick(){if(stopped)return;if(running){again=true;return;}running=true;
  try{const current=await bridge.current();if(stopped)return;
   if(!current){rejected=null;await end();return;}
   if(!isUUID(current.launchId)||!['fantazia','temkaworld'].includes(current.game))throw Error('Недостоверный запуск.');
   if(rejected===current.launchId)return;
   if(!session||launch?.launchId!==current.launchId){await end();const started=await api.startActivity(current.game,bridge.platform,current.launchId);if(stopped){try{await api.stopActivity(started.id);}catch{}return;}session=started;launch=current;
    const still=await bridge.current();if(!still||still.launchId!==current.launchId||started.ended_at){rejected=current.launchId;await end();return;}
   }
   if(session&&!await api.touchActivity(session.id)){rejected=current.launchId;await end();}
  }catch{/* Never invent activity or keep sending heartbeats on native/connection errors. */}
  finally{running=false;if(again&&!stopped){again=false;void tick();}}
 }
 return {tick,async stop(){stopped=true;await end();await bridge.close().catch(()=>{});}};
}
