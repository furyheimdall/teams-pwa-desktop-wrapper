function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneWindowBounds(bounds) {
  const cloned = {
    width: bounds.width,
    height: bounds.height
  };

  if (Number.isFinite(bounds.x)) cloned.x = bounds.x;
  if (Number.isFinite(bounds.y)) cloned.y = bounds.y;
  return cloned;
}

function normalizeWindowBounds(value, fallback) {
  if (!isRecord(value)) return cloneWindowBounds(fallback);

  const hasValidSize =
    Number.isFinite(value.width) &&
    value.width >= 400 &&
    Number.isFinite(value.height) &&
    value.height >= 300;
  const hasValidPosition =
    (value.x === undefined || Number.isFinite(value.x)) &&
    (value.y === undefined || Number.isFinite(value.y));

  if (!hasValidSize || !hasValidPosition) {
    return cloneWindowBounds(fallback);
  }

  const normalized = {
    width: value.width,
    height: value.height
  };

  if (Number.isFinite(value.x)) normalized.x = value.x;
  if (Number.isFinite(value.y)) normalized.y = value.y;
  return normalized;
}

function normalizePreferences(value, defaults) {
  if (!isRecord(value)) {
    return {
      windowBounds: cloneWindowBounds(defaults.windowBounds),
      isMaximized: defaults.isMaximized,
      keepActive: defaults.keepActive
    };
  }

  return {
    windowBounds: normalizeWindowBounds(value.windowBounds, defaults.windowBounds),
    isMaximized: typeof value.isMaximized === 'boolean'
      ? value.isMaximized
      : defaults.isMaximized,
    keepActive: typeof value.keepActive === 'boolean'
      ? value.keepActive
      : defaults.keepActive
  };
}

module.exports = {
  normalizePreferences
};
