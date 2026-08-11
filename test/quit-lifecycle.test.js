const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { createQuitState, registerQuitLifecycle } = require('../quit-lifecycle');

test('marks every app quit path before windows begin closing', () => {
  const app = new EventEmitter();
  const quitState = createQuitState();

  registerQuitLifecycle(app, quitState);
  assert.equal(quitState.isQuitting, false);

  app.emit('before-quit');
  assert.equal(quitState.isQuitting, true);
});
