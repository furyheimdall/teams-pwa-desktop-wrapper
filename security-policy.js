const APP_ORIGINS = new Set([
  'https://teams.microsoft.com',
  'https://login.microsoftonline.com',
  'https://login.live.com'
]);

const TEAMS_ORIGIN = 'https://teams.microsoft.com';

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isAllowedAppUrl(value) {
  const url = parseUrl(value);
  return url !== null && url.protocol === 'https:' && APP_ORIGINS.has(url.origin);
}

function isTeamsUrl(value) {
  const url = parseUrl(value);
  return url !== null && url.protocol === 'https:' && url.origin === TEAMS_ORIGIN;
}

function isSafeExternalUrl(value) {
  const url = parseUrl(value);
  return url !== null && (url.protocol === 'https:' || url.protocol === 'http:');
}

function sanitizeNotification(payload) {
  const value = payload && typeof payload === 'object' ? payload : {};
  const title = typeof value.title === 'string' && value.title.length > 0
    ? value.title.slice(0, 200)
    : 'Microsoft Teams';
  const body = typeof value.body === 'string' ? value.body.slice(0, 2000) : '';

  return {
    title,
    body,
    silent: value.silent === true
  };
}

module.exports = {
  isAllowedAppUrl,
  isSafeExternalUrl,
  isTeamsUrl,
  sanitizeNotification
};
