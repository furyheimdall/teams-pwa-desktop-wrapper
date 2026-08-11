const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizePreferences } = require('../preferences');

const defaults = {
  windowBounds: { width: 1200, height: 800 },
  isMaximized: false,
  keepActive: false
};

test('falls back when parsed preferences are not an object', () => {
  assert.deepEqual(normalizePreferences(null, defaults), defaults);
  assert.deepEqual(normalizePreferences([], defaults), defaults);
});

test('falls back from malformed window bounds and setting types', () => {
  assert.deepEqual(
    normalizePreferences({
      windowBounds: {
        width: 'wide',
        height: -1,
        x: Number.POSITIVE_INFINITY,
        y: 20
      },
      isMaximized: 'yes',
      keepActive: 1
    }, defaults),
    defaults
  );
});

test('preserves structurally valid preferences', () => {
  const preferences = {
    windowBounds: { width: 1400, height: 900, x: 10, y: 20 },
    isMaximized: true,
    keepActive: true
  };

  assert.deepEqual(normalizePreferences(preferences, defaults), preferences);
});
