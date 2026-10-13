// This explicit build step keeps the native runtime supplied in the source ZIP.
// Publisher 1.0.6/1.0.7 may replace electron/ and updater UI with their old template.
// Validate the entire bundle first, restore only this allowlist, then typecheck/test.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const TARGETS = [
 'electron/main.cjs','electron/preload.cjs','electron/update-controller.cjs',
 'electron/release-source.cjs','electron/folder-picker.cjs',
 'electron/native-contract.json','electron/release-feed-contract.json',
 'src/lib/updater.ts','src/lib/version.ts','src/components/UpdateBanner.tsx',
 'tests/release-source.test.cjs','tests/updater.test.cjs','tests/folder-picker.test.cjs',
 'tests/native-bundle.test.cjs','tests/beta-contract.test.cjs','README.md',
 'scripts/smoke-electron.cjs','tests/ci-smoke.test.cjs',
 'electron/clipboard.cjs','src/lib/clipboard.ts','tests/clipboard.test.cjs',
 'src/lib/playerCard.ts','tests/player-card.test.cjs','CHANGELOG.md','TEST-REPORT.md'
];
const normal = text => text.replace(/\r\n/g,'\n'); // Git may use CRLF on Windows.
export const digest = text => crypto.createHash('sha256').update(normal(text),'utf8').digest('hex');
function noLinks(root,filename){
 let at=root;
 for(const part of path.relative(root,filename).split(path.sep)){
  at=path.join(at,part);
  let stat; try { stat=fs.lstatSync(at); } catch(error) { if(error.code!=='ENOENT')throw error; }
  if(stat?.isSymbolicLink())throw Error(`Native bundle: symbolic links are not allowed: ${path.relative(root,at)}`);
 }
}
export function restoreNative(projectRoot,{verify=true}={}){
 const root=fs.realpathSync(projectRoot);
 const bundle=path.join(root,'native-bundle');
 const manifestPath=path.join(bundle,'manifest.json');noLinks(root,manifestPath);
 if(!fs.existsSync(manifestPath))throw Error('Native bundle missing. Import the complete 1.6.0 source ZIP, including native-bundle/ and build-tools/.');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 if(manifest.protocol!==3||!manifest.files||Object.keys(manifest.files).sort().join('|')!==[...TARGETS].sort().join('|'))throw Error('Native bundle manifest is incomplete or has unexpected paths.');
 const entries=TARGETS.map(relative=>{
  const source=path.join(bundle,relative),destination=path.join(root,relative);noLinks(root,source);noLinks(root,destination);
  if(!fs.existsSync(source))throw Error(`Native bundle file missing: ${relative}`);
  const content=normal(fs.readFileSync(source,'utf8'));
  if(digest(content)!==manifest.files[relative])throw Error(`Native bundle checksum mismatch: ${relative}. Re-extract the complete ZIP; do not bypass validation.`);
  return {relative,destination,content};
 });
 let changed=0;
 for(const {destination,content} of entries){
  if(fs.existsSync(destination)&&digest(fs.readFileSync(destination,'utf8'))===digest(content))continue;
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,content,'utf8');changed++;
 }
 console.log(`[Temka runtime] protocol 3, direct release feed; restored ${changed}/${TARGETS.length} files from source ZIP.`);
 if(verify){
  execFileSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit'],{cwd:root,stdio:'inherit'});
  execFileSync(process.execPath,['--test','tests/release-source.test.cjs','tests/updater.test.cjs','tests/folder-picker.test.cjs','tests/native-bundle.test.cjs','tests/beta-contract.test.cjs','tests/ci-smoke.test.cjs','tests/clipboard.test.cjs','tests/player-card.test.cjs'],{cwd:root,stdio:'inherit'});
  console.log('[Temka runtime] post-restore TypeScript and runtime regression tests passed.');
 }
 return {changed};
}
