const {test}=require('node:test');const assert=require('node:assert/strict');
const {createFolderPicker}=require('../electron/folder-picker.cjs');
const path=require('node:path');const good=path.resolve('games');
const setup=(result,io={stat:async()=>({isDirectory:()=>true}),access:async()=>{}})=>{
 let calls=0;return {picker:createFolderPicker({dialog:{showOpenDialog:async()=>{calls++;return await result;}},getWindow:()=>({}),getDefaultPath:()=>good,io}),calls:()=>calls};};
test('folder picker returns absolute writable directory',async()=>{const s=setup({canceled:false,filePaths:[good]});assert.deepEqual(await s.picker.choose(good),{ok:true,canceled:false,path:good});});
test('folder picker cancellation does not return a path',async()=>{const s=setup({canceled:true,filePaths:[]});assert.deepEqual(await s.picker.choose(),{ok:true,canceled:true});});
test('folder picker parallel clicks reuse a single native dialog',async()=>{let finish;const s=setup(new Promise(r=>finish=r));const a=s.picker.choose();const b=s.picker.choose();assert.equal(a,b);finish({canceled:true});await a;assert.equal(s.calls(),1);await s.picker.choose();assert.equal(s.calls(),2);});
test('folder picker rejects non-directories, relative paths and write denial',async()=>{
 for(const [selected,io] of [['relative',undefined],[good,{stat:async()=>({isDirectory:()=>false}),access:async()=>{}}],[good,{stat:async()=>({isDirectory:()=>true}),access:async()=>{throw Error('denied')}}]]){const s=setup({canceled:false,filePaths:[selected]},io);assert.equal((await s.picker.choose()).ok,false);}
});
test('folder picker recovers after dialog rejection',async()=>{let fail=true;const s=createFolderPicker({dialog:{showOpenDialog:async()=>{if(fail){fail=false;throw Error('native error');}return {canceled:true};}},getWindow:()=>({}),getDefaultPath:()=>good});assert.equal((await s.choose()).ok,false);assert.equal((await s.choose()).canceled,true);});
