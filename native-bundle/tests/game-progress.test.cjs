const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function games(){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/data/games.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports});return exports.GAMES;}
test('Fantazia uses author-provided 80 percent after module initialization',()=>{assert.equal(games().find(g=>g.id==='fantazia').progress,80);});
test('TemkaWorld uses author-provided 10 percent after module initialization',()=>{assert.equal(games().find(g=>g.id==='temkaworld').progress,10);});
test('progress is not overwritten by the roadmap completion ratio',()=>{for(const g of games()){const ratio=Math.round(g.roadmap.filter(m=>m.state==='done').length/g.roadmap.length*100);assert.notEqual(g.progress,ratio);assert.equal(g.statusLabel,g.id==='fantazia'?'Закрытая Beta0.1':'В разработке');}});
test('both card and details use the same progress for label and bar',()=>{const ui=fs.readFileSync(path.join(root,'src/components/LibraryView.tsx'),'utf8');for(const fragment of ['{game.progress}%','width: `${game.progress}%`','{shownGame.progress}%','width: `${shownGame.progress}%`'])assert(ui.includes(fragment),fragment);});
