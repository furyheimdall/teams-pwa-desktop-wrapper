const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createDebianControl } = require('./build-metadata');

const buildDir = path.join(__dirname, 'dist');
const requestedArch = process.argv[2] || 'all';
const supportedArchitectures = new Set(['all', 'amd64', 'arm64']);

if (!supportedArchitectures.has(requestedArch)) {
  console.error(`Error: Unsupported architecture "${requestedArch}". Use amd64, arm64, or all.`);
  process.exit(1);
}

// Detect which architectures have been compiled and unpacked in dist/
const targets = [];

// Check for x64 (electron-builder names default x64 folder as 'linux-unpacked', or sometimes 'linux-x64-unpacked')
if (requestedArch === 'all' || requestedArch === 'amd64') {
  if (fs.existsSync(path.join(buildDir, 'linux-unpacked'))) {
    targets.push({ debArch: 'amd64', sourceFolder: 'linux-unpacked' });
  } else if (fs.existsSync(path.join(buildDir, 'linux-x64-unpacked'))) {
    targets.push({ debArch: 'amd64', sourceFolder: 'linux-x64-unpacked' });
  }
}

// Check for arm64
if (
  (requestedArch === 'all' || requestedArch === 'arm64') &&
  fs.existsSync(path.join(buildDir, 'linux-arm64-unpacked'))
) {
  targets.push({ debArch: 'arm64', sourceFolder: 'linux-arm64-unpacked' });
}

if (targets.length === 0) {
  console.error(`Error: No ${requestedArch} unpacked build found in dist/.`);
  process.exit(1);
}

for (const { debArch, sourceFolder } of targets) {
  console.log(`\n======================================================`);
  console.log(`Packaging .deb package for architecture: ${debArch}`);
  console.log(`======================================================`);

  const debDir = path.join(buildDir, `deb-pkg-${debArch}`);

  // Cleanup previous deb-pkg temp folder
  if (fs.existsSync(debDir)) {
    fs.rmSync(debDir, { recursive: true, force: true });
  }

  // Create directory structure
  fs.mkdirSync(path.join(debDir, 'DEBIAN'), { recursive: true });
  fs.mkdirSync(path.join(debDir, 'usr/share/teams-electron'), { recursive: true });
  fs.mkdirSync(path.join(debDir, 'usr/share/applications'), { recursive: true });
  fs.mkdirSync(path.join(debDir, 'usr/share/pixmaps'), { recursive: true });
  fs.mkdirSync(path.join(debDir, 'usr/bin'), { recursive: true });

  // Copy unpacked app files
  const unpackedPath = path.join(buildDir, sourceFolder);
  console.log(`Copying unpacked files from: ${unpackedPath}`);
  fs.cpSync(unpackedPath, path.join(debDir, 'usr/share/teams-electron'), { recursive: true });

  // Copy icon
  fs.copyFileSync(path.join(__dirname, 'icons', 'icon.png'), path.join(debDir, 'usr/share/pixmaps/teams-electron.png'));

  // Create control file
  const controlContent = createDebianControl(debArch);
  fs.writeFileSync(path.join(debDir, 'DEBIAN/control'), controlContent);

  // Create desktop entry
  const desktopContent = `[Desktop Entry]
Name=Teams Desktop
Comment=Microsoft Teams Web Wrapper with Tray Support
Exec=/usr/share/teams-electron/teams-electron %U
Icon=teams-electron
Type=Application
StartupNotify=true
Categories=Office;Network;InstantMessaging;
`;
  fs.writeFileSync(path.join(debDir, 'usr/share/applications/teams-electron.desktop'), desktopContent);

  // Create symlink
  console.log('Creating binary symlink...');
  try {
    fs.symlinkSync('/usr/share/teams-electron/teams-electron', path.join(debDir, 'usr/bin/teams-electron'));
  } catch (e) {
    console.error('Symlink creation warning/error:', e);
  }

  // Set permissions for chrome-sandbox
  console.log('Setting permissions for chrome-sandbox...');
  const sandboxPath = path.join(debDir, 'usr/share/teams-electron/chrome-sandbox');
  if (fs.existsSync(sandboxPath)) {
    fs.chmodSync(sandboxPath, 0o4755);
  }

  // Build deb package using dpkg-deb and fakeroot
  console.log(`Packaging with dpkg-deb and fakeroot for ${debArch}...`);
  const debFile = path.join(buildDir, `teams-electron_1.0.0_${debArch}.deb`);
  execFileSync('fakeroot', ['dpkg-deb', '--build', debDir, debFile], {
    stdio: 'inherit'
  });

  // Cleanup
  console.log('Cleaning up temporary packaging folder...');
  fs.rmSync(debDir, { recursive: true, force: true });

  console.log(`Success! Package created at: ${debFile}`);
}
