const { app, BrowserWindow, Tray, Menu, MenuItem, shell, session, desktopCapturer, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  isAllowedAppUrl,
  isSafeExternalUrl,
  isTeamsUrl,
  sanitizeNotification
} = require('./security-policy');
const { normalizePreferences } = require('./preferences');
const { createQuitState, registerQuitLifecycle } = require('./quit-lifecycle');

const SCREEN_PICKER_SOURCES = 'screen-picker:sources';
const SCREEN_PICKER_SELECT = 'screen-picker:select';

app.enableSandbox();
const quitState = createQuitState();
registerQuitLifecycle(app, quitState);

// Simple custom JSON store to persist window state without external dependencies
class ConfigStore {
  constructor(name, defaults) {
    const userDataPath = app.getPath('userData');
    this.path = path.join(userDataPath, name + '.json');
    this.defaults = defaults;
    this.data = this.parseDataFile();
  }

  parseDataFile() {
    try {
      return normalizePreferences(
        JSON.parse(fs.readFileSync(this.path, 'utf8')),
        this.defaults
      );
    } catch (error) {
      return normalizePreferences(null, this.defaults);
    }
  }

  get(key) {
    return this.data[key] !== undefined ? this.data[key] : this.defaults[key];
  }

  set(key, val) {
    this.data[key] = val;
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }
}

let mainWindow = null;
let tray = null;
let screenPickerWindow = null;
let store = null;
let keepActiveInterval = null;
let isKeepActiveEnabled = false;

// Handle single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // App ready initialization
  app.whenReady().then(() => {
    store = new ConfigStore('user-preferences', {
      windowBounds: { width: 1200, height: 800, x: undefined, y: undefined },
      isMaximized: false,
      keepActive: false
    });

    isKeepActiveEnabled = store.get('keepActive');

    const preloadPath = path.join(__dirname, 'preload.js');

    setupPermissions();
    setupDisplayMediaHandler();
    createWindow(preloadPath);
    createTray();

    if (isKeepActiveEnabled) {
      toggleKeepActive(true);
    }
  });
}

function createWindow(preloadPath = path.join(__dirname, 'preload.js')) {
  const windowBounds = store.get('windowBounds');
  const isMaximized = store.get('isMaximized');

  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
    title: 'Microsoft Teams',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: false
    }
  });

  if (isMaximized) {
    mainWindow.maximize();
  }

  // Save window state on close/resize/move
  const saveState = () => {
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      store.set('windowBounds', mainWindow.getBounds());
      store.set('isMaximized', false);
    } else if (mainWindow.isMaximized()) {
      store.set('isMaximized', true);
    }
  };

  mainWindow.on('resize', saveState);
  mainWindow.on('move', saveState);
  mainWindow.on('maximize', () => store.set('isMaximized', true));
  mainWindow.on('unmaximize', () => store.set('isMaximized', false));

  // Set User-Agent to standard Chrome to avoid Teams blocking it
  // This user agent represents a standard stable Chrome on Linux
  const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  mainWindow.webContents.setUserAgent(userAgent);
  configureNavigation(mainWindow.webContents);

  // Load MS Teams
  mainWindow.loadURL('https://teams.microsoft.com/v2/');

  // Intercept Web Notification API → forward to main process.
  // Teams Web v2 closes notifications immediately after showing them.
  // By managing notifications from main process, they persist in GNOME's
  // notification center (popup auto-dismisses, center keeps until dismissed).
  mainWindow.webContents.on('did-finish-load', () => {
    void mainWindow.webContents.executeJavaScript(`
      (function() {
        if (window.__ntfOverridden) return;
        window.__ntfOverridden = true;

        window.Notification = function(title, options) {
          if (!(this instanceof window.Notification)) {
            return new window.Notification(title, options);
          }
          this.title = title;
          this.body = (options && options.body) || '';
          this.tag = (options && options.tag) || '';
          this.icon = (options && options.icon) || '';
          this.onclick = null;
          this.onclose = null;
          this.onshow = null;

          window.__ntfBridge.show(title, options);

          this.close = function() { /* no-op: Teams auto-dismisses too aggressively */ };
        };

        window.Notification.permission = 'granted';

        window.Notification.requestPermission = function(cb) {
          if (typeof cb === 'function') cb('granted');
          return Promise.resolve('granted');
        };
      })();
    `).catch((error) => {
      console.error('Failed to install notification bridge:', error);
    });
  });

  // Handle Close to Tray
  mainWindow.on('close', (event) => {
    if (!quitState.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Right-click context menu (Spellcheck & Copy/Paste)
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();

    // Spellcheck suggestions
    if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(new MenuItem({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion)
        }));
      }
      menu.append(new MenuItem({ type: 'separator' }));
    }

    // Standard edit commands
    menu.append(new MenuItem({ label: 'Cut', role: 'cut', enabled: params.editFlags.canCut }));
    menu.append(new MenuItem({ label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy }));
    menu.append(new MenuItem({ label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste }));

    // Select All
    if (params.editFlags.canSelectAll) {
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: 'Select All', role: 'selectall' }));
    }

    menu.popup();
  });
}

function configureNavigation(webContents) {
  const handleNavigation = (event, url) => {
    if (isAllowedAppUrl(url)) return;

    event.preventDefault();
    openExternalUrl(url);
  };

  webContents.on('will-navigate', handleNavigation);
  webContents.on('will-redirect', handleNavigation);

  webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAppUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
          }
        }
      };
    }

    openExternalUrl(url);
    return { action: 'deny' };
  });

  webContents.on('did-create-window', (childWindow) => {
    configureNavigation(childWindow.webContents);
  });
}

function openExternalUrl(url) {
  if (!isSafeExternalUrl(url)) return;

  void shell.openExternal(url).catch((error) => {
    console.error('Failed to open external URL:', error);
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'icons', 'icon.png');

  // Create system tray
  tray = new Tray(iconPath);

  updateTrayMenu();
  tray.setToolTip('Microsoft Teams Desktop');

  // Single click toggle window
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Teams',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Minimize to Tray',
      click: () => {
        mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: 'Auto-Active (Prevent Away)',
      type: 'checkbox',
      checked: isKeepActiveEnabled,
      click: (menuItem) => {
        toggleKeepActive(menuItem.checked);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Teams',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function toggleKeepActive(enabled) {
  isKeepActiveEnabled = enabled;
  if (store) {
    store.set('keepActive', isKeepActiveEnabled);
  }

  if (keepActiveInterval) {
    clearInterval(keepActiveInterval);
    keepActiveInterval = null;
  }

  if (isKeepActiveEnabled) {
    triggerKeepActiveActivity();
    keepActiveInterval = setInterval(() => {
      triggerKeepActiveActivity();
    }, 30000);
  }

  updateTrayMenu();
}

function triggerKeepActiveActivity() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  try {
    const randomX = Math.floor(Math.random() * 50) + 100;
    const randomY = Math.floor(Math.random() * 50) + 100;

    // 1. Send native Chromium mouse move events via WebContents
    mainWindow.webContents.sendInputEvent({ type: 'mouseMove', x: randomX, y: randomY });
    mainWindow.webContents.sendInputEvent({ type: 'mouseMove', x: randomX + 1, y: randomY + 1 });

    // 2. Dispatch DOM mousemove and keydown events inside Teams page renderer
    void mainWindow.webContents.executeJavaScript(`
      (function() {
        const evt = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: ${randomX},
          clientY: ${randomY},
          view: window
        });
        document.dispatchEvent(evt);
        window.dispatchEvent(evt);

        const keyEvt = new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Shift',
          code: 'ShiftLeft'
        });
        document.dispatchEvent(keyEvt);
      })();
    `).catch((error) => {
      console.error('Failed to dispatch keep-active event:', error);
    });
  } catch (err) {
    console.error('Failed to trigger keep active activity:', err);
  }
}

function setupPermissions() {
  const allowed = new Set(['media', 'notifications', 'display-capture', 'fullscreen']);

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details?.requestingUrl || webContents.getURL();
    callback(isTeamsUrl(requestingUrl) && allowed.has(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission, origin, details) => {
    const requestingUrl = details?.requestingUrl || details?.securityOrigin || origin;
    return isTeamsUrl(requestingUrl) && allowed.has(permission);
  });
}

function setupDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    if (
      !request.videoRequested ||
      !request.userGesture ||
      !isTeamsUrl(request.securityOrigin)
    ) {
      callback();
      return;
    }

    desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 300, height: 200 } }).then((sources) => {
      createScreenPicker(sources, (selectedSource) => {
        if (selectedSource) {
          callback({ video: selectedSource });
        } else {
          callback(); // Cancel screensharing
        }
      });
    }).catch((error) => {
      console.error('Failed to list screen-sharing sources:', error);
      callback();
    });
  });
}

function createScreenPicker(sources, selectCallback) {
  if (screenPickerWindow) {
    screenPickerWindow.focus();
    selectCallback();
    return;
  }

  let selectionResolved = false;
  screenPickerWindow = new BrowserWindow({
    width: 650,
    height: 550,
    title: 'Select Screen or Window',
    parent: mainWindow,
    modal: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    backgroundColor: '#1f1f1f',
    webPreferences: {
      preload: path.join(__dirname, 'picker-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  screenPickerWindow.loadFile(path.join(__dirname, 'picker.html'));

  screenPickerWindow.once('ready-to-show', () => {
    screenPickerWindow.show();
  });

  screenPickerWindow.webContents.on('did-finish-load', () => {
    const sourcesData = sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL()
    }));
    screenPickerWindow.webContents.send(SCREEN_PICKER_SOURCES, sourcesData);
  });

  const finishSelection = (selectedSource) => {
    if (selectionResolved) return;
    selectionResolved = true;
    ipcMain.removeListener(SCREEN_PICKER_SELECT, handleSelection);
    selectCallback(selectedSource);
  };

  const handleSelection = (event, sourceId) => {
    if (!screenPickerWindow || event.sender !== screenPickerWindow.webContents) {
      return;
    }

    const selected = sources.find(s => s.id === sourceId);
    finishSelection(selected);
    if (screenPickerWindow && !screenPickerWindow.isDestroyed()) {
      screenPickerWindow.close();
    }
  };

  ipcMain.on(SCREEN_PICKER_SELECT, handleSelection);

  screenPickerWindow.on('closed', () => {
    screenPickerWindow = null;
    finishSelection();
  });
}

// Forward notifications from renderer to main process
ipcMain.on('show-notification', (event, payload) => {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    !event.senderFrame ||
    !isTeamsUrl(event.senderFrame.url)
  ) {
    return;
  }

  const n = new Notification(sanitizeNotification(payload));
  n.on('click', () => {
    n.close();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  n.show();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(path.join(__dirname, 'preload.js'));
  }
});
