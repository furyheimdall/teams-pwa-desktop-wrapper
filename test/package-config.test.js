const test = require('node:test');
const assert = require('node:assert/strict');

const packageConfig = require('../package.json');

test('distribution scripts never publish implicitly in CI', () => {
  assert.match(packageConfig.scripts.dist, /--publish never/);
  assert.match(packageConfig.scripts['dist:all'], /--publish never/);
});
