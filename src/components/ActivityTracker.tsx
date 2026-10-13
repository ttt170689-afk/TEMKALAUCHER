import {useEffect} from 'react';
import {useOnlineAccount} from '../lib/onlineAccount';
import {trackedBridge} from '../lib/trackedGame';
import {createActivityTracker} from '../lib/activityTracker';
export default function ActivityTracker(){const {client,mode}=useOnlineAccount(),me=client.session?.user.id;
 useEffect(()=>{const bridge=trackedBridge();if(!bridge||mode!=='verified'||!me)return;const tracker=createActivityTracker(client,bridge);let disposed=false,unsubscribe:(()=>void)|undefined;void bridge.onState(()=>void tracker.tick()).then(fn=>{if(disposed)fn();else unsubscribe=fn;});const timer=setInterval(()=>void tracker.tick(),25000);void tracker.tick();const unload=()=>void tracker.stop();window.addEventListener('pagehide',unload);return()=>{disposed=true;unsubscribe?.();clearInterval(timer);window.removeEventListener('pagehide',unload);void tracker.stop();};},[client,me,mode]);return null;}
