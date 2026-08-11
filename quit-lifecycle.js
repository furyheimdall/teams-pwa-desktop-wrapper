function createQuitState() {
  return { isQuitting: false };
}

function registerQuitLifecycle(app, quitState) {
  app.on('before-quit', () => {
    quitState.isQuitting = true;
  });
}

module.exports = {
  createQuitState,
  registerQuitLifecycle
};
