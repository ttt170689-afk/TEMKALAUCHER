export type GameLaunch={game:string;launchId:string};
export interface TrackedBridge{platform:string;current:()=>Promise<GameLaunch|null>;close:()=>Promise<unknown>;open:(game:string)=>Promise<GameLaunch>;onState:(callback:()=>void)=>Promise<()=>void>;}
export function trackedBridge():TrackedBridge|null{
 const t=(window as unknown as {temka?:{platform:string;game?:{open:(g:string)=>Promise<GameLaunch>;current:()=>Promise<GameLaunch|null>;close:()=>Promise<void>;onState:(cb:()=>void)=>()=>void}}}).temka;
 if(!t?.game)return null;const g=t.game;return {...g,platform:t.platform==='win32'?'windows':'linux',onState:async cb=>g.onState(cb)};
}
// Library buttons remain disabled. Future reviewed games use only this native path.
export async function launchTrackedGame(game:string){const bridge=trackedBridge();if(!bridge)throw Error('Отслеживаемый запуск на этом устройстве недоступен.');return bridge.open(game);}
