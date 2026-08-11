const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEBIAN_DEPENDENCIES,
  createDebianControl
} = require('../build-metadata');

test('declares the Electron Linux runtime dependencies', () => {
  const control = createDebianControl('amd64');

  for (const dependency of DEBIAN_DEPENDENCIES) {
    assert.match(control, new RegExp(`Depends:.*${dependency}`));
  }

  assert.match(control, /^Architecture: amd64$/m);
  assert.match(control, /^Recommends: libappindicator3-1$/m);
});
