const test=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function load(relative) {
 const exports={};
 const text=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(text,{exports,require:name=>{assert.equal(name,'../lib/version');return {APP_VERSION:'1.6.1'};}});
 return exports;
}
const creator=load('src/lib/creatorIdentity.ts');
const news=load('src/data/releaseNotes.ts');
test('creator signature matches exact owner name, not prefixes or another player',()=>{
 assert(creator.hasLocalCreatorSignature('temka_play_official'));
 assert(creator.hasLocalCreatorSignature(' TEMKA_PLAY_OFFICIAL '));
 for(const name of [undefined,'','player','temka_play_official_12345','temka_play_official_fake','temka_play'])assert(!creator.hasLocalCreatorSignature(name));
});
test('local signature explicitly confers no online privileges',()=>{
 assert.match(creator.LOCAL_CREATOR_SIGNATURE_NOTE,/не подтверждение онлайн-прав/);
 assert.equal(typeof creator.hasLocalCreatorSignature('temka_play_official'),'boolean');
});
test('current release uses the installed application version',()=>{
 assert.equal(news.RELEASE_NOTES[0].version,'1.6.1');assert.equal(news.RELEASE_NOTES[0].current,true);
 assert(news.RELEASE_NOTES[0].changes.some(c=>c.kind==='removed'));
});
test('news filter returns only matching categories',()=>{
 for(const kind of ['added','fixed','removed']) {
  const rows=news.filterReleaseNotes(news.RELEASE_NOTES,kind,'');
  assert(rows.length>0);assert(rows.every(r=>r.changes.every(c=>c.kind===kind)));
 }
});
test('news search handles case, version and combined filters',()=>{
 assert(news.filterReleaseNotes(news.RELEASE_NOTES,'all','  АВАТАР  ').length>0);
 const rows=news.filterReleaseNotes(news.RELEASE_NOTES,'all','1.5.3');
 assert.equal(rows.length,1);assert.equal(rows[0].version,'1.5.3');
 assert.equal(news.filterReleaseNotes(news.RELEASE_NOTES,'removed','1.5.3').length,0);
});
test('empty search is honest and filtering does not mutate release history',()=>{
 const before=JSON.stringify(news.RELEASE_NOTES);
 assert.equal(news.filterReleaseNotes(news.RELEASE_NOTES,'all','zzzxxyy-missing').length,0);
 news.filterReleaseNotes(news.RELEASE_NOTES,'fixed','новичок');
 assert.equal(JSON.stringify(news.RELEASE_NOTES),before);
});
