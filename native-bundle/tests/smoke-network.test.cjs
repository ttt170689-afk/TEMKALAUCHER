const {test}=require('node:test');
const assert=require('node:assert/strict');
const {installSmokeNetwork}=require('../scripts/smoke-network.cjs');
function application(){
 const handlers=new Map();
 const protocol={
  handle:async(scheme,handler)=>{assert(!handlers.has(scheme));handlers.set(scheme,handler);},
  isProtocolHandled:async scheme=>handlers.has(scheme)
 };
 return {handlers,evaluate:async(fn,arg)=>fn({session:{defaultSession:{protocol}}},arg)};
}
test('smoke session fixture retains original URL, authorization, method and JSON body',async()=>{
 const app=application(),seen=[];
 const network=await installSmokeNetwork(app,async route=>{
  const request=route.request();seen.push({url:request.url(),method:request.method(),headers:request.headers(),body:request.postDataJSON()});
  await route.fulfill({body:JSON.stringify({id:'fixture-only'})});
 });
 try{
  assert.deepEqual([...app.handlers.keys()],['https','http']);
  const reply=await app.handlers.get('https')(new Request('https://never-resolves.invalid/rest/v1/rpc/my_profile',{
   method:'POST',headers:{authorization:'Bearer clipboard-smoke-token',apikey:'public-fixture-key','content-type':'application/json'},body:'{"user":"fixture"}'
  }));
  assert.equal(reply.status,200);assert.deepEqual(await reply.json(),{id:'fixture-only'});
  assert.equal(seen[0].url,'https://never-resolves.invalid/rest/v1/rpc/my_profile');assert.equal(seen[0].method,'POST');
  assert.equal(seen[0].headers.authorization,'Bearer clipboard-smoke-token');assert.equal(seen[0].headers.apikey,'public-fixture-key');assert.deepEqual(seen[0].body,{user:'fixture'});
  assert.equal(reply.headers.get('access-control-allow-origin'),'*');network.assertHealthy();
 }finally{await network.close();}
});
test('smoke session fixture preserves binary avatar upload and download',async()=>{
 const app=application(),bytes=Buffer.from([0,255,127,13,10,200]);let upload;
 const network=await installSmokeNetwork(app,async route=>{
  upload=route.request().postDataBuffer();await route.fulfill({contentType:'image/webp',body:upload});
 });
 try{
  const reply=await app.handlers.get('https')(new Request('https://avatar.invalid/avatar.webp',{method:'PUT',body:bytes}));
  assert.deepEqual(upload,bytes);assert.equal(reply.headers.get('content-type'),'image/webp');assert.deepEqual(Buffer.from(await reply.arrayBuffer()),bytes);network.assertHealthy();
 }finally{await network.close();}
});
test('smoke session fixture handles CORS preflight without invoking application endpoints',async()=>{
 const app=application();let calls=0;
 const network=await installSmokeNetwork(app,async()=>{calls++;});
 try{
  const reply=await app.handlers.get('https')(new Request('https://preflight.invalid/auth/v1/user',{method:'OPTIONS'}));
  assert.equal(reply.status,204);assert.equal(await reply.text(),'');assert.equal(calls,0);
  assert(reply.headers.get('access-control-allow-headers').includes('authorization'));network.assertHealthy();
 }finally{await network.close();}
});
for(const mode of ['throw','no response'])test(`broken smoke fixture fails closed: ${mode}`,async()=>{
 const app=application();const network=await installSmokeNetwork(app,async()=>{if(mode==='throw')throw Error('synthetic fixture error');});
 try{
  const reply=await app.handlers.get('http')(new Request('http://never-resolves.invalid/blocked'));
  assert.equal(reply.status,500);assert.deepEqual(await reply.json(),{message:'Smoke fixture failed'});
  assert.equal(network.errors.length,1);assert.throws(()=>network.assertHealthy(),/Smoke fixture transport errors/);
 }finally{await network.close();}
});
test('smoke fixture fails if either protocol was not actually installed',async()=>{
 const app={evaluate:async(fn,arg)=>fn({session:{defaultSession:{protocol:{handle:async()=>{},isProtocolHandled:async()=>false}}}},arg)};
 await assert.rejects(installSmokeNetwork(app,()=>{}),/Smoke protocol isolation not installed/);
});
