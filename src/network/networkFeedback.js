import { Alert } from 'react-native';

let toastHandler = null;
let lastStatus = '';
let lastShownAt = 0;
let dismissedStatus = '';
let dismissedAt = 0;

export const NETWORK_TOAST_KEY = 'network-status';
export const NETWORK_MESSAGES = {
  offline: 'No internet connection. Please check your network.',
  slow: 'Slow internet connection. Please check your connectivity.',
  restored: 'Internet connection restored. Refresh the page to continue.',
};

const DEFAULT_THROTTLE_MS = 8000;
const DISMISSED_SUPPRESS_MS = 15000;

export const configureNetworkNotifier = handler => {
  toastHandler = typeof handler === 'function' ? handler : null;
};

export const notifyNetworkIssue = (message, type = 'warning', options = {}) => {
  const now = Date.now();
  const status = options.status || message;
  const throttleMs = Number(options.throttleMs ?? DEFAULT_THROTTLE_MS);
  if (!options.force && status === dismissedStatus && now - dismissedAt < DISMISSED_SUPPRESS_MS) return;
  if (!options.force && status === lastStatus && now - lastShownAt < throttleMs) return;

  if (status !== dismissedStatus) {
    dismissedStatus = '';
    dismissedAt = 0;
  }
  lastStatus = status;
  lastShownAt = now;

  if (toastHandler) {
    toastHandler(message, type, {
      key: options.key || NETWORK_TOAST_KEY,
      duration: options.duration ?? 3500,
      onClose: () => {
        dismissedStatus = status;
        dismissedAt = Date.now();
      },
    });
    return;
  }

  Alert.alert(type === 'error' ? 'Network error' : 'Network status', message);
};

export const notifyNetworkRestored = () => {
  notifyNetworkIssue(NETWORK_MESSAGES.restored, 'success', {
    status: 'restored',
    force: true,
    duration: 2500,
  });
};

export const __resetNetworkNotifierForTests = () => {
  toastHandler = null;
  lastStatus = '';
  lastShownAt = 0;
  dismissedStatus = '';
  dismissedAt = 0;
};
