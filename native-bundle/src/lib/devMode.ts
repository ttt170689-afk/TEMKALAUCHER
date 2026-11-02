import type {DevAccess} from './dev';
export const DEV_LEASE_MS=30000;
export const DEV_RECHECK_MS=20000;
export type DevGateState={phase:'checking'|'allowed'|'blocked';access:DevAccess|null;message:string};
/** UI lease only, never server authority. Every remote operation still uses MAIN bearer.
 * No persisted allowed bit; identity changes, offline, suspension and errors fail closed. */
export class DevModeGate {
 state:DevGateState={phase:'checking',access:null,message:''};
 private alive=true;private sequence=0;private generation=0;
 private until=0;private identity:string|undefined;private pending:Promise<void>|null=null;
 constructor(private read:()=>Promise<DevAccess>,private currentIdentity:()=>string|undefined,private change:(state:DevGateState)=>void,private now=()=>Date.now()){}
 private publish(state:DevGateState){this.state=state;if(this.alive)this.change(state);}
 invalidate(message='Dev-доступ не подтверждён. Войди снова после проверки.'){
  if(!this.alive)return;this.sequence++;this.generation++;this.pending=null;this.until=0;this.identity=undefined;
  this.publish({phase:'blocked',access:null,message});
 }
 expire(){if(this.until&&(this.now()>=this.until||this.identity!==this.currentIdentity()))this.invalidate('Срок проверки Dev-доступа истёк. Нужна новая проверка сервера.');}
 verify():Promise<void>{
  if(!this.alive)return Promise.resolve();if(this.pending)return this.pending;
  const identity=this.currentIdentity();if(!identity){this.invalidate('Нужен основной онлайн-аккаунт.');return Promise.resolve();}
  const ticket=++this.sequence;this.publish({phase:'checking',access:null,message:''});
  const job=(async()=>{
   try{
    const access=await this.read();if(!this.alive||ticket!==this.sequence)return;
    if(this.currentIdentity()!==identity){this.invalidate('Основной аккаунт изменился. Войди в Dev заново.');return;}
    if(!access.allowed){this.invalidate('Dev-доступ отозван или приглашение ещё не активировано.');return;}
    this.identity=identity;this.until=this.now()+DEV_LEASE_MS;this.publish({phase:'allowed',access,message:''});
   }catch(e){if(this.alive&&ticket===this.sequence)this.invalidate(e instanceof Error?e.message:'Нет связи с Dev-сервером.');}
  })();
  this.pending=job;void job.finally(()=>{if(this.pending===job)this.pending=null;});return job;
 }
 async run<T>(job:()=>Promise<T>):Promise<T>{
  await this.verify();this.expire();if(!this.alive||this.state.phase!=='allowed')throw Error(this.state.message||'Dev-доступ не подтверждён.');
  const generation=this.generation,identity=this.currentIdentity();const value=await job();
  // Re-check AFTER a long request too: do not expose a completed download after revocation.
  await this.verify();this.expire();
  if(!this.alive||generation!==this.generation||identity!==this.currentIdentity()||this.state.phase!=='allowed')throw Error(this.state.message||'Dev-сеанс завершён.');
  return value;
 }
 dispose(){this.alive=false;this.sequence++;this.generation++;this.pending=null;this.until=0;this.state={phase:'blocked',access:null,message:'Dev-сеанс завершён.'};}
}
