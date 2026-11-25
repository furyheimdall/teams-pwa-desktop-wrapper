# Teams PWA Desktop Wrapper

[한국어](README.ko.md) | **English**

[![CI](https://github.com/furyheimdall/teams-pwa-desktop-wrapper/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/furyheimdall/teams-pwa-desktop-wrapper/actions/workflows/ci.yml)
![Linux](https://img.shields.io/badge/platform-Linux-FCC624?logo=linux&logoColor=black)
![Electron](https://img.shields.io/badge/Electron-43.x-47848F?logo=electron&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun&logoColor=white)
![AMD64](https://img.shields.io/badge/architecture-amd64-555555)
![AppImage](https://img.shields.io/badge/package-AppImage-2A2A2A?logo=appimage)
![Debian](https://img.shields.io/badge/package-Debian-A81D33?logo=debian&logoColor=white)

An unofficial Electron wrapper that runs the Microsoft Teams web app (PWA) as
a standalone Linux desktop application.

The project does not reimplement Teams. It adds operating-system integration
that is missing or limited in a normal browser session, including a system
tray, background operation, native notifications, and a screen-sharing source
picker.

> This project is not an official Microsoft Teams client. Microsoft Teams and
> related trademarks belong to their respective owners.

## Features

- **Teams PWA wrapper**:
  Loads `https://teams.microsoft.com/v2/` in an Electron `BrowserWindow`.
  Navigation to `https://teams.cloud.microsoft` stays in the app.
- **System tray**:
  Opens, hides, and fully quits the application from a tray icon and menu.
- **Close-to-Tray**:
  Hides the window instead of terminating the process when the close button is
  pressed, keeping Teams running in the background.
- **Single instance**:
  Prevents duplicate processes and restores the existing window when the
  application is launched again.
- **Persistent window state**:
  Restores the saved window size, position, and maximized state on startup.
- **Native desktop notifications**:
  Forwards Teams web notifications through a preload bridge and IPC to the
  Electron main process. Clicking a notification focuses the Teams window.
- **Screen-sharing picker**:
  Uses `desktopCapturer` to list screens and application windows in a custom
  thumbnail-based selection dialog.
- **Media permission handling**:
  Handles Electron session permission requests needed for calls,
  notifications, and fullscreen operation.
- **Spellcheck and edit menu**:
  Provides spelling suggestions and Cut, Copy, Paste, and Select All commands
  in the context menu.
- **External link routing**:
  Keeps Teams and Microsoft sign-in flows, including the
  `login.microsoft.com` passkey bridge, in the same Electron session.
  Opens other HTTP(S) links in the system browser.
- **Auto-Active**:
  Optionally sends synthetic input events every 30 seconds to discourage Teams
  from switching to Away. The setting persists between launches.

## Architecture

The application follows Electron's process model:

```text
Electron Main Process (main.js)
├─ BrowserWindow ─────────────── Microsoft Teams PWA
├─ Tray / Menu ──────────────── window control and Auto-Active
├─ Session / Permissions ───── camera, microphone, notifications, sharing
├─ desktopCapturer ─────────── screen and window source collection
├─ Native Notification ─────── operating-system notifications
└─ ConfigStore ─────────────── persistent window and user settings
        │
        ├─ preload.js ───────── isolated notification IPC bridge
        └─ picker.html ──────── local screen-sharing source picker
```

### Terminology

- **Electron wrapper**:
  A desktop shell that loads an existing web application and adds native
  operating-system features.
- **Main process**:
  The Node.js process that manages windows, the tray, sessions, permissions,
  and native notifications.
- **Renderer process**:
  A Chromium process that renders either the Teams PWA or the local
  screen-sharing picker.
- **Preload bridge**:
  A restricted integration layer that exposes approved functionality while
  preserving `contextIsolation`.
- **IPC (Inter-Process Communication)**:
  Communication between renderer and main processes, used here for
  notifications and screen-source selection.
- **Close-to-Tray**:
  A desktop pattern that turns a window close request into a hide operation.
- **Session persistence**:
  Local storage of state that should survive application restarts.

## Usage

### Tray controls

- Click the tray icon to toggle the Teams window.
- Select **Open Teams** to show and focus the window.
- Select **Minimize to Tray** to hide it without quitting.
- Select **Quit Teams** to terminate the application.

On Ubuntu GNOME, the Teams icon appears in the top panel when the
AppIndicator extension is enabled. Closing the Teams window leaves the
app running; use **Open Teams** to restore it.
The hidden window is no longer shown as running in the dock.

### Auto-Active

**Auto-Active (Prevent Away)** is off by default. Toggle it in the tray menu
to start or stop sending periodic synthetic mouse and keyboard events to
the Teams page. The choice is saved across restarts.

Its effectiveness can change with Teams web behavior and organizational
policies. Confirm that its use complies with your organization's attendance
and security policies.

### Screen sharing

When Teams requests screen sharing, the wrapper opens a separate picker for
available displays and windows. Filter the list with **All**, **Screens**, or
**Windows**, select a thumbnail, and start sharing.

## Requirements

- A Linux desktop environment
- Node.js 22.12 or later with npm, or [Bun](https://bun.sh/)
- A graphical session for development runs
- `fakeroot` and `dpkg-deb` for `.deb` packaging
- A network connection and Microsoft Teams account

Install the Debian packaging tools on Ubuntu or Debian:

```bash
sudo apt install fakeroot dpkg-dev
```

## Install dependencies

```bash
# Bun
bun install

# Or npm
npm install
```

## Development

```bash
# Bun
bun start

# Or npm
npm start
```

Create an unpacked application directory:

```bash
bun run pack
# Or
npm run pack
```

## AMD64 Linux packaging

The default distribution build creates an AMD64 AppImage and Debian package:

```bash
bun run dist
# Or
npm run dist
```

The `dist` script:

1. Runs `electron-builder --linux AppImage --x64` to create the AMD64 AppImage
   and unpacked application directory.
2. Runs `build-deb.js amd64` against that unpacked directory.
3. Creates Debian metadata, a desktop entry, an icon, and an executable link.
4. Runs `fakeroot dpkg-deb` to create the `.deb` packages.

Default artifacts:

```text
dist/
├─ Teams Desktop-1.0.1.AppImage
└─ teams-electron_1.0.1_amd64.deb
```

To build both AMD64 and arm64 packages explicitly:

```bash
bun run dist:all
# Or
npm run dist:all
```

## Installation

### Debian package

```bash
sudo dpkg -i dist/teams-electron_1.0.1_amd64.deb

# Resolve missing package dependencies if needed
sudo apt-get install -f
```

After installation, launch **Teams Desktop** from the application menu or run:

```bash
teams-electron
```

### AppImage

```bash
chmod +x "dist/Teams Desktop-1.0.1.AppImage"
"./dist/Teams Desktop-1.0.1.AppImage"
```

## Settings and local data

Window position, window size, maximized state, and the Auto-Active setting are
stored in `user-preferences.json` under Electron's user data directory.

Teams authentication and web session data are managed by Electron's default
session storage. The wrapper's preferences file does not separately store
Teams passwords or message contents.

## Project layout

```text
.
├─ main.js          # Electron main process and desktop integration
├─ preload.js       # notification IPC bridge exposed to Teams
├─ picker.html      # screen and window source picker
├─ build-deb.js     # amd64 and arm64 Debian packaging
├─ package.json     # scripts, dependencies, and electron-builder settings
├─ icons/           # application and tray icons
└─ dist/            # generated build artifacts
```

## Continuous integration

GitHub Actions and GitLab CI install the locked Bun dependency graph, check both
README files and JavaScript syntax, build the AMD64 Linux packages, and upload
the AppImage and Debian package as pipeline artifacts.

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for GitHub Actions
and [`.gitlab-ci.yml`](.gitlab-ci.yml) for GitLab CI.

## Security

Report vulnerabilities privately as described in
[`SECURITY.md`](SECURITY.md). Do not include exploit details in a public issue.

## Known limitations

- Changes to the Teams web UI or authentication flow can require updates to
  the User-Agent, link routing, or notification bridge.
- Screen sharing and system-audio loopback support depend on Electron, the
  display server, and the desktop environment.
- The current packaging configuration targets Linux, not Windows or macOS.
- Auto-Active does not guarantee that Teams will remain in an Available state.

## License

This project's source code is available under the [MIT License](LICENSE).

This is an unofficial project and is not affiliated with or endorsed by
Microsoft. Microsoft Teams and related names and marks belong to Microsoft.
