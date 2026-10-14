// No JWT decoding-as-verification. Main Auth validates every presented access token.
export interface GatewayEnv { devUrl: string; serviceKey: string; }
const MAIN_URL = 'https://jubsgthkahxxexmibdwn.supabase.co';
const MAIN_PUBLIC_KEY = 'sb_publishable_OMO42E66umWFmfOic4QD3w_T64EWPXS';
const DEV_URL = 'https://zykpirbzgiylkkasrllk.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const actions = new Set(['status','redeem','issue','revoke_tester','builds','download']);
const errorCodes = new Set(['owner_only','tester_slot_taken','invalid_invite','rate_limited','access_denied','build_not_found','unknown_action']);
function json(data:unknown,status=200) {return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});}
async function readBody(req:Request) {
 const reader=req.body?.getReader();if(!reader)throw Error('body');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)throw Error('body');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
function safeBuild(b:any) {return b&&UUID.test(b.id)&&typeof b.object_path==='string'&&b.object_path.length<=240&&/^[A-Za-z0-9_./-]+$/.test(b.object_path)&&!b.object_path.startsWith('/')&&!b.object_path.split('/').includes('..')&&/^[a-f0-9]{64}$/.test(b.sha256)&&Number.isSafeInteger(b.size_bytes)&&b.size_bytes>0&&b.size_bytes<=52428800;}
function publicBuild(b:any) {return {id:b.id,product:b.product,version:b.version,filename:b.object_path.split('/').pop(),sha256:b.sha256,size_bytes:b.size_bytes,notes:b.notes,published:b.published,created_at:b.created_at};}
export function createGateway(env:GatewayEnv,fetcher:typeof fetch=fetch) {
 return async (req:Request):Promise<Response> => {
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
  if(env.devUrl.replace(/\/$/,'')!==DEV_URL||!env.serviceKey)return json({ok:false,error:'gateway_not_configured'},503);
  const authorization=req.headers.get('Authorization')||'';
  if(!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization)||authorization.length>8192)return json({ok:false,error:'sign_in_required'},401);
  let body:any;try{body=await readBody(req);}catch{return json({ok:false,error:'invalid_request'},400);}
  if(!actions.has(body?.action)|| (body.action==='redeem'&&(typeof body.code!=='string'||body.code.length>100)) || (body.action==='download'&&!UUID.test(body.buildId||'')))return json({ok:false,error:'invalid_request'},400);
  try{
   // Only trusted primary-project endpoint; ignores client-supplied UID/email/roles/URL.
   const identity=await fetcher(MAIN_URL+'/auth/v1/user',{headers:{apikey:MAIN_PUBLIC_KEY,Authorization:authorization},redirect:'error',signal:AbortSignal.timeout(10000)});
   if(!identity.ok)return json({ok:false,error:identity.status>=500?'identity_unavailable':'sign_in_required'},identity.status>=500?503:401);
   const user=await identity.json();
   if(!UUID.test(user?.id||'')||typeof user.email!=='string'||typeof user.email_confirmed_at!=='string'||!Number.isFinite(Date.parse(user.email_confirmed_at)))return json({ok:false,error:'email_not_confirmed'},403);
   const result=await fetcher(DEV_URL+'/rest/v1/rpc/dev_main_action',{
    method:'POST',headers:{apikey:env.serviceKey,Authorization:'Bearer '+env.serviceKey,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(15000),
    body:JSON.stringify({p_uid:user.id,p_email:user.email,p_action:body.action,p_code:body.action==='redeem'?body.code:null,p_build_id:body.action==='download'?body.buildId:null})
   });
   if(!result.ok)return json({ok:false,error:'dev_server_unavailable'},503);
   const data=await result.json();
   if(data?.ok!==true)return json({ok:false,error:errorCodes.has(data?.error)?data.error:'dev_server_unavailable'},data?.error==='rate_limited'?429:403);
   if(body.action==='builds'){
    if(!Array.isArray(data.builds)||!data.builds.every(safeBuild))return json({ok:false,error:'invalid_catalogue'},503);
    return json({ok:true,builds:data.builds.map(publicBuild)});
   }
   if(body.action==='download'){
    const b=data.build;if(!safeBuild(b)||b.id!==body.buildId)return json({ok:false,error:'invalid_catalogue'},503);
    // No signed URL handed to the client. Rechecks identity/membership for each file.
    const url=DEV_URL+'/storage/v1/object/temka-dev/'+b.object_path.split('/').map(encodeURIComponent).join('/');
    const file=await fetcher(url,{headers:{apikey:env.serviceKey,Authorization:'Bearer '+env.serviceKey},redirect:'error',signal:AbortSignal.timeout(60000)});
    if(!file.ok)return json({ok:false,error:'file_unavailable'},503);
    const length=file.headers.get('Content-Length');if(length&&Number(length)!==b.size_bytes){await file.body?.cancel();return json({ok:false,error:'file_size_mismatch'},503);}
    return new Response(file.body,{headers:{...cors,'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${b.object_path.split('/').pop()}"`,'X-Content-Type-Options':'nosniff'}});
   }
   // Return only documented fields. No service token or user email in responses/logs.
   if(body.action==='issue')return json({ok:true,code:data.code,expires_at:data.expires_at,id:data.id});
   if(body.action==='revoke_tester')return json({ok:true});
   return json({ok:true,allowed:data.allowed===true,owner:data.owner===true,channel:'dev'});
  }catch{return json({ok:false,error:'dev_connection_failed'},503);}
 };
}

// Supabase supplies these inside the Edge Function. Never copy them into launcher files.
Deno.serve(createGateway({devUrl:Deno.env.get('SUPABASE_URL')||'',serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}));
