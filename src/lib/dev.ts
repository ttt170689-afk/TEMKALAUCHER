import type {CloudClient} from './online';
const ENDPOINT='https://zykpirbzgiylkkasrllk.supabase.co/functions/v1/dev-gateway';
const PUBLIC_KEY='sb_publishable_2opwQbmQYIu6W9XozR0A-Q_DAwRKlLc';
export interface DevAccess {allowed:boolean;owner:boolean;channel:'dev';}
export interface DevBuild {id:string;product:'launcher-pc'|'launcher-android'|'fantazia'|'temkaworld';version:string;filename:string;sha256:string;size_bytes:number;notes:string;published:boolean;created_at:string;}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const messages:Record<string,string>={sign_in_required:'Войди в основной онлайн-аккаунт заново.',email_not_confirmed:'Подтверди почту основного аккаунта.',access_denied:'Нет доступа к Dev. Введи приглашение владельца.',owner_only:'Это действие доступно только владельцу Dev.',tester_slot_taken:'Место тестера уже занято. Владелец должен сначала отозвать прежний доступ.',invalid_invite:'Приглашение недействительно, истекло или уже использовано.',rate_limited:'Слишком много попыток. Подожди 10 минут; проверка доступа не расходует попытки.',gateway_not_configured:'Dev-шлюз ещё не настроен владельцем.',dev_server_unavailable:'Dev-схема или шлюз ещё не подключены. Основной лаунчер работает отдельно.',dev_connection_failed:'Нет связи с Dev-сервером. Доступ не подтверждён.',identity_unavailable:'Сервер основного аккаунта временно недоступен.',build_not_found:'Сборка недоступна или снята с публикации.',file_unavailable:'Файл сборки пока не загружен.',file_size_mismatch:'Размер файла не совпал с каталогом.'};
export function readDevAccess(data:unknown):DevAccess{
 const d=data as DevAccess&{ok:boolean};if(d?.ok!==true||d.channel!=='dev'||typeof d.allowed!=='boolean'||typeof d.owner!=='boolean'||(d.owner&&!d.allowed))throw Error('Сервер не подтвердил Dev-доступ.');
 return {allowed:d.allowed,owner:d.owner,channel:'dev'};
}
export function readDevBuilds(data:unknown):DevBuild[]{
 const d=data as {ok:boolean;builds:DevBuild[]};if(d?.ok!==true||!Array.isArray(d.builds)||d.builds.length>100)throw Error('Некорректный каталог Dev.');
 const ids=new Set<string>();for(const b of d.builds){if(!b||!UUID.test(b.id)||ids.has(b.id)||!['launcher-pc','launcher-android','fantazia','temkaworld'].includes(b.product)||typeof b.version!=='string'||b.version.length>80||typeof b.filename!=='string'||!/^[A-Za-z0-9_.-]+$/.test(b.filename)||b.filename==='.'||b.filename==='..'||!/^[a-f0-9]{64}$/.test(b.sha256)||!Number.isSafeInteger(b.size_bytes)||b.size_bytes<1||b.size_bytes>52428800||typeof b.notes!=='string'||b.notes.length>10000||typeof b.published!=='boolean'||!Number.isFinite(Date.parse(b.created_at)))throw Error('Некорректная сборка Dev.');ids.add(b.id);}
 return d.builds;
}
async function call(client:CloudClient,action:string,extra:Record<string,string>={},binary=false):Promise<Response>{
 return client.withDevSession(async token=>{
  const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),binary?120000:30000);
  try{
   const response=await fetch(ENDPOINT,{method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,...extra}),redirect:'error',signal:controller.signal});
   if(!response.ok){let d:{error?:string}={};try{d=await response.json();}catch{/* no server internals */}throw Error(messages[d.error||'']||(response.status===404?'Dev-шлюз ещё не размещён. Основной аккаунт не нужно создавать повторно.':'Dev-сервер не подтвердил запрос.'));}
   // Consume bodies under the timeout and account-generation check, not afterwards.
   if(binary){
    const reader=response.body?.getReader();if(!reader)throw Error('Пустой файл Dev.');const chunks:Uint8Array[]=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>52428800)throw Error('Dev-файл превышает допустимый размер.');chunks.push(value);}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return new Response(bytes,{headers:response.headers});
   }
   const text=await response.text();return new Response(text,{headers:{'Content-Type':'application/json'}});
  }catch(e){if((e as Error).name==='AbortError')throw Error('Dev-сервер не ответил вовремя. Проверь статус перед повтором действия.');if(e instanceof TypeError)throw Error('Нет связи с Dev-сервером.');throw e;}finally{clearTimeout(timer);}
 });
}
export async function devStatus(client:CloudClient){return readDevAccess(await(await call(client,'status')).json());}
export async function redeemDev(client:CloudClient,code:string){if(code.length>100||!/^TEMKADEV[A-F0-9]{64}$/.test(code.toUpperCase().replace(/[\s-]/g,'')))throw Error('Вставь полный Dev-код TEMKADEV-… от владельца.');return readDevAccess(await(await call(client,'redeem',{code:code.trim()})).json());}
export async function issueDev(client:CloudClient){const d=await(await call(client,'issue')).json();if(d?.ok!==true||!/^TEMKADEV-[A-F0-9]{64}$/.test(d.code)||!Number.isFinite(Date.parse(d.expires_at)))throw Error('Не удалось подтвердить выдачу приглашения. Обнови доступ перед повторной выдачей.');return {code:d.code as string,expires_at:d.expires_at as string};}
export async function revokeDevTester(client:CloudClient){const d=await(await call(client,'revoke_tester')).json();if(d?.ok!==true)throw Error('Отзыв доступа не подтверждён.');}
export async function devBuilds(client:CloudClient){return readDevBuilds(await(await call(client,'builds')).json());}
export async function downloadDev(client:CloudClient,build:DevBuild):Promise<Blob>{
 readDevBuilds({ok:true,builds:[build]});const response=await call(client,'download',{buildId:build.id},true);const bytes=await response.arrayBuffer();
 if(bytes.byteLength!==build.size_bytes)throw Error('Размер файла не совпал. Файл не сохранён.');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==build.sha256)throw Error('Проверка SHA256 не прошла. Файл не сохранён.');return new Blob([bytes],{type:'application/octet-stream'});
}
