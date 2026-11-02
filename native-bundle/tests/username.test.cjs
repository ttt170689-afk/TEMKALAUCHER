const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const fs = require('node:fs');
const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync('src/lib/username.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;
vm.runInNewContext(code, { exports: exportsObject });
const { USERNAME_MAX_LENGTH, validateUsernameLength } = exportsObject;
test('nickname maximum is 25, not 16', () => assert.equal(USERNAME_MAX_LENGTH, 25));
test('accepts 3, 16, 17 and 25 character names', () => {
  for (const n of [3, 16, 17, 25]) assert.equal(validateUsernameLength('я'.repeat(n)), null);
});
test('rejects names under 3 and over 25', () => {
  for (const n of [0, 1, 2, 26, 100]) assert.match(validateUsernameLength('a'.repeat(n)), /3 до 25/);
});
