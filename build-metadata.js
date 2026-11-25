const { version } = require('./package.json');

const DEBIAN_DEPENDENCIES = Object.freeze([
  'libgtk-3-0',
  'libnotify4',
  'libnss3',
  'libxss1',
  'libxtst6',
  'xdg-utils',
  'libatspi2.0-0',
  'libuuid1',
  'libsecret-1-0'
]);

function createDebianControl(debArch) {
  return `Package: teams-electron
Version: ${version}
Section: utils
Priority: optional
Architecture: ${debArch}
Maintainer: furyheimdall <furyheimdall@gmail.com>
Homepage: https://github.com/furyheimdall/teams-pwa-desktop-wrapper
Depends: ${DEBIAN_DEPENDENCIES.join(', ')}
Recommends: libappindicator3-1
Description: Microsoft Teams Web Wrapper with Background Minimize to Tray
`;
}

module.exports = {
  DEBIAN_DEPENDENCIES,
  createDebianControl
};
