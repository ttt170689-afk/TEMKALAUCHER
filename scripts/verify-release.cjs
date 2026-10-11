const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');
const version = require('../package.json').version;
const root = path.resolve(__dirname, '..', 'release');
const metadata = yaml.load(fs.readFileSync(path.join(root, 'latest.yml'), 'utf8'));
assert.equal(metadata.version, version);
assert(metadata.files.length > 0);
for (const file of metadata.files) {
  assert.equal(path.basename(file.url), file.url);
  const bytes = fs.readFileSync(path.join(root, file.url));
  assert.equal(bytes.subarray(0, 2).toString(), 'MZ');
  assert.equal(bytes.length, file.size);
  assert.equal(crypto.createHash('sha512').update(bytes).digest('base64'), file.sha512);
  assert(fs.statSync(path.join(root, file.url + '.blockmap')).size > 0);
}
const config = yaml.load(fs.readFileSync(path.join(root, 'win-unpacked', 'resources', 'app-update.yml'), 'utf8'));
assert.equal(config.provider, 'github');
assert.equal(config.owner, 'ttt170689-afk');
assert.equal(config.repo, 'TEMKALAUCHER');
console.log('PASS: EXE header, version, size, SHA512, blockmap, embedded GitHub update config.');
