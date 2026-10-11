const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const yaml=require('js-yaml');
const version=require('../package.json').version;
const root=process.env.RELEASE_DIR || path.resolve(__dirname,'..','release');
const metadata=yaml.load(fs.readFileSync(path.join(root,'latest-linux.yml'),'utf8'));
assert.equal(metadata.version,version);
assert(metadata.files?.length>0);
let appImageSeen=false;
for(const file of metadata.files){
  assert.equal(path.basename(file.url),file.url);
  const bytes=fs.readFileSync(path.join(root,file.url));
  assert.equal(bytes.length,file.size);
  assert.equal(crypto.createHash('sha512').update(bytes).digest('base64'),file.sha512);
  if(file.url.endsWith('.AppImage')){assert.equal(bytes.subarray(0,4).toString('hex'),'7f454c46');appImageSeen=true;}
}
assert(appImageSeen,'Linux update metadata must include AppImage');
const deb=fs.readFileSync(path.join(root,`TemkaLauncher-${version}-amd64.deb`));
assert.equal(deb.subarray(0,8).toString(),'!<arch>\n');
const config=yaml.load(fs.readFileSync(path.join(root,'linux-unpacked','resources','app-update.yml'),'utf8'));
assert.equal(config.provider,'github');assert.equal(config.owner,'ttt170689-afk');assert.equal(config.repo,'TEMKALAUCHER');
console.log('PASS: Linux AppImage ELF, .deb archive, version, sizes, SHA512 and embedded GitHub update config.');
