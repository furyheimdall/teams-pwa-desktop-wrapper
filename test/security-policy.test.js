const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isAllowedAppUrl,
  isSafeExternalUrl,
  isTeamsUrl,
  sanitizeNotification
} = require('../security-policy');

test('allows only exact Teams and Microsoft login origins', () => {
  assert.equal(isAllowedAppUrl('https://teams.microsoft.com/v2/'), true);
  assert.equal(isAllowedAppUrl('https://teams.cloud.microsoft/v2/'), true);
  assert.equal(isAllowedAppUrl('https://login.microsoftonline.com/common/'), true);
  assert.equal(isAllowedAppUrl('https://login.microsoft.com/common/bridge/fido'), true);
  assert.equal(isAllowedAppUrl('https://login.live.com/oauth20_authorize.srf'), true);
  assert.equal(isAllowedAppUrl('https://teams.microsoft.com.attacker.example/'), false);
  assert.equal(isAllowedAppUrl('https://teams.cloud.microsoft.attacker.example/'), false);
  assert.equal(isAllowedAppUrl('https://login.microsoft.com.attacker.example/'), false);
  assert.equal(isAllowedAppUrl('http://teams.microsoft.com/v2/'), false);
  assert.equal(isAllowedAppUrl('not a URL'), false);
});

test('grants Teams permissions only to the exact Teams origins', () => {
  assert.equal(isTeamsUrl('https://teams.microsoft.com/v2/'), true);
  assert.equal(isTeamsUrl('https://teams.cloud.microsoft/v2/'), true);
  assert.equal(isTeamsUrl('https://login.microsoftonline.com/common/'), false);
  assert.equal(isTeamsUrl('https://login.microsoft.com/common/bridge/fido'), false);
  assert.equal(isTeamsUrl('https://teams.microsoft.com.attacker.example/'), false);
  assert.equal(isTeamsUrl('https://teams.cloud.microsoft.attacker.example/'), false);
});

test('opens only HTTP and HTTPS URLs externally', () => {
  assert.equal(isSafeExternalUrl('https://example.com/article'), true);
  assert.equal(isSafeExternalUrl('http://example.com/article'), true);
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
  assert.equal(isSafeExternalUrl('file:///etc/passwd'), false);
  assert.equal(isSafeExternalUrl('custom-protocol://payload'), false);
});

test('sanitizes notification payloads to supported fields', () => {
  assert.deepEqual(
    sanitizeNotification({
      title: 'Meeting',
      body: 'Starts now',
      silent: true,
      icon: 'file:///tmp/untrusted.png'
    }),
    {
      title: 'Meeting',
      body: 'Starts now',
      silent: true
    }
  );

  assert.deepEqual(sanitizeNotification(null), {
    title: 'Microsoft Teams',
    body: '',
    silent: false
  });
});

test('bounds notification text lengths', () => {
  const notification = sanitizeNotification({
    title: 't'.repeat(300),
    body: 'b'.repeat(3000)
  });

  assert.equal(notification.title.length, 200);
  assert.equal(notification.body.length, 2000);
});
