// Maintainer command: run only after intentionally changing and testing the runtime.
import fs from 'node:fs';import path from 'node:path';
import {TARGETS,digest} from './restore-native.mjs';
const root=process.cwd(),bundle=path.join(root,'native-bundle'),files={};
for(const relative of TARGETS){const content=fs.readFileSync(path.join(root,relative),'utf8').replace(/\r\n/g,'\n');const target=path.join(bundle,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);files[relative]=digest(content);}
fs.writeFileSync(path.join(bundle,'manifest.json'),JSON.stringify({protocol:3,files},null,2)+'\n');
console.log('Updated native bundle:',TARGETS.length,'files');
