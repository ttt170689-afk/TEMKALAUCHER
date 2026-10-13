const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {createClipboardWriter}=require('../electron/clipboard.cjs');
const root=path.resolve(__dirname,'..');
function helper(window={},navigator={}){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/clipboard.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,window,navigator});return exports.copyText;
}
test('native clipboard writes exact Unicode handle and beta-code text, verifies OS read-back',async()=>{
 let saved='';const copy=createClipboardWriter({writeText:t=>saved=t,readText:()=>saved});
 for(const text of ['@temka_play_official','@Друг_123','TMK-ABC-123']){assert.equal((await copy(text)).ok,true);assert.equal(saved,text);}
});
test('native clipboard rejects malformed, empty, oversized and NUL payloads without writing',async()=>{
 let writes=0;const copy=createClipboardWriter({writeText:()=>writes++,readText:()=>''});
 for(const text of [undefined,null,{},42,'','a'.repeat(4097),'a\0b'])assert.equal((await copy(text)).ok,false);
 assert.equal(writes,0);
});
test('native clipboard never reports success on write failure or differing read-back',async()=>{
 for(const clipboard of [{writeText(){throw Error('denied');},readText:()=>''},{writeText(){},readText:()=>'unchanged'},{writeText(){},readText(){throw Error('unavailable');}},{async writeText(){throw Error('async denied');},readText:()=>''},{writeText(){},async readText(){throw Error('async denied');}}])assert.equal((await createClipboardWriter(clipboard)('@copy')).ok,false);
});
test('renderer prefers native write capability over denied browser API',async()=>{
 let copied='',webCalls=0;const copy=helper({temka:{copyText:async t=>{copied=t;return {ok:true};}}},{clipboard:{writeText:async()=>{webCalls++;throw Error('denied');}}});
 await copy('@Друг');assert.equal(copied,'@Друг');assert.equal(webCalls,0);
});
test('native errors or malformed acknowledgements cannot become success or browser fallback',async()=>{
 for(const reply of [{ok:false,error:'denied'},undefined,{},true,{ok:'true'}]){
  let calls=0;await assert.rejects(()=>helper({temka:{copyText:async()=>reply}},{clipboard:{writeText:async()=>calls++}})('@copy'));assert.equal(calls,0);
 }
 await assert.rejects(()=>helper({temka:{copyText:async()=>{throw Error('IPC failed');}}})('@copy'),/IPC failed/);
});
test('older native bridge cannot silently use blocked browser clipboard',async()=>{
 await assert.rejects(()=>helper({temka:{}})('@copy'),/Обнови лаунчер/);
});
test('ordinary browser clipboard still works and propagates denial or missing API',async()=>{
 let saved='';await helper({},{clipboard:{writeText:async t=>{saved=t;}}})('@browser');assert.equal(saved,'@browser');
 await assert.rejects(()=>helper()('@browser'),/недоступен/);
 await assert.rejects(()=>helper({},{clipboard:{writeText:async()=>{throw Error('permission denied');}}})('@browser'),/permission denied/);
});
test('renderer rejects invalid clipboard payloads before invoking bridge',async()=>{
 let calls=0;const copy=helper({temka:{copyText:async()=>{calls++;return {ok:true};}}});
 for(const text of [null,{},'','a'.repeat(4097),'a\0b'])await assert.rejects(()=>copy(text));assert.equal(calls,0);
});
test('remaining launcher copy buttons use shared clipboard helper; beta generation moved out',()=>{
 for(const file of ['FriendsPanel.tsx','FriendsView.tsx']){
  const text=fs.readFileSync(path.join(root,'src/components',file),'utf8');assert(text.includes("from '../lib/clipboard'"));assert(text.includes('await copyText('));assert(!text.includes('navigator.clipboard'));
 }
});
test('clipboard IPC is write-only, trusted-main-frame gated; web permissions remain denied',()=>{
 const main=fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8'),preload=fs.readFileSync(path.join(root,'electron/preload.cjs'),'utf8');
 assert(main.includes("handle('clipboard:write-text', createClipboardWriter(clipboard))"));
 assert(main.includes('if (!trusted(event)) throw'));assert(main.includes('event.senderFrame === win.webContents.mainFrame'));
 assert(main.includes('setPermissionCheckHandler(() => false)'));assert(main.includes('callback(false)'));
 assert(preload.includes('ipcRenderer.invoke("clipboard:write-text", text)'));assert(!preload.includes('readText'));assert(!preload.includes('clipboard:read'));
});

test('native acknowledgement waits for asynchronous OS write and read-back',async()=>{
 let saved='',release;const gate=new Promise(r=>release=r);let complete=false;
 const copy=createClipboardWriter({writeText:async t=>{await gate;saved=t;},readText:async()=>saved});
 const result=copy('@async').then(r=>{complete=true;return r;});await Promise.resolve();assert.equal(complete,false);
 release();assert.equal((await result).ok,true);assert.equal(saved,'@async');
});
