import axios from 'axios';
import { API_URL } from '../utils/constants';
import { session } from '../storage/session';
import { getConnectivitySnapshot, getFreshConnectivitySnapshot } from '../network/connectivity';
import { NETWORK_MESSAGES, notifyNetworkIssue } from '../network/networkFeedback';

export const REQUEST_TIMEOUT = 20000;
export const SLOW_REQUEST_MS = 10000;
export const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
const pendingMutations = new Map();
const pendingReads = new Map();

export const isSafeBaseUrl = url => {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '10.0.2.2'].includes(parsed.hostname))
    );
  } catch {
    return false;
  }
};

if (!isSafeBaseUrl(API_URL)) {
  throw new Error('API_URL must use HTTPS outside local development.');
}

const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT,
});

export const createNetworkError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  error.isNetworkManaged = true;
  return error;
};

const getRequestMethod = config => String(config?.method || 'get').toLowerCase();

const createRequestKey = config => {
  const method = getRequestMethod(config);
  const url = config?.url || '';
  const params = config?.params ? JSON.stringify(config.params) : '';
  const data = config?.data ? String(config.data) : '';
  return `${method}:${url}:${params}:${data}`;
};

const startSlowRequestTimer = config => {
  const timeoutMs = Number(config?.slowRequestMs || SLOW_REQUEST_MS);
  if (!timeoutMs || timeoutMs < 1) return null;
  return setTimeout(() => {
    notifyNetworkIssue(NETWORK_MESSAGES.slow, 'warning', { status: 'slow' });
  }, timeoutMs);
};

const clearRequestMetadata = config => {
  if (config?.metadata?.slowTimer) {
    clearTimeout(config.metadata.slowTimer);
  }
  if (config?.metadata?.dedupeKey) {
    pendingMutations.delete(config.metadata.dedupeKey);
  }
  if (config?.metadata?.readKey) {
    const controller = pendingReads.get(config.metadata.readKey);
    if (controller === config.metadata.abortController) {
      pendingReads.delete(config.metadata.readKey);
    }
  }
};

export const isRetryableNetworkError = error => {
  if (error?.response) return false;
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'econaborted' ||
    code === 'err_network' ||
    code === 'etimedout' ||
    message.includes('network') ||
    message.includes('timeout')
  );
};

api.interceptors.request.use(async config => {
  const connectivity = config?.skipConnectivityCheck === true
    ? getConnectivitySnapshot()
    : await getFreshConnectivitySnapshot();
  if (!connectivity.isOnline && config?.skipConnectivityCheck !== true) {
    notifyNetworkIssue(NETWORK_MESSAGES.offline, 'warning', { status: 'offline' });
    throw createNetworkError(
      NETWORK_MESSAGES.offline,
      'ERR_OFFLINE',
    );
  }

  const method = getRequestMethod(config);
  const metadata = { ...(config.metadata || {}) };
  if (!RETRYABLE_METHODS.has(method) && config?.allowDuplicate !== true) {
    const dedupeKey = createRequestKey(config);
    if (pendingMutations.has(dedupeKey)) {
      throw createNetworkError('Request already in progress.', 'ERR_DUPLICATE_REQUEST');
    }
    pendingMutations.set(dedupeKey, true);
    metadata.dedupeKey = dedupeKey;
  }

  if (
    RETRYABLE_METHODS.has(method) &&
    config?.cancelPrevious !== false &&
    !config.signal &&
    typeof AbortController !== 'undefined'
  ) {
    const readKey = createRequestKey(config);
    pendingReads.get(readKey)?.abort?.();
    const controller = new AbortController();
    pendingReads.set(readKey, controller);
    metadata.readKey = readKey;
    metadata.abortController = controller;
    config.signal = controller.signal;
  }

  metadata.slowTimer = startSlowRequestTimer(config);
  config.metadata = metadata;
  config.timeout = config.timeout || REQUEST_TIMEOUT;

  const token = await session.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => {
    clearRequestMetadata(response.config);
    return response;
  },
  async error => {
    clearRequestMetadata(error?.config);

    const config = error?.config || {};
    if (error?.code === 'ERR_CANCELED' || axios.isCancel?.(error)) {
      return Promise.reject(error);
    }

    const method = getRequestMethod(config);
    const retryCount = Number(config.metadata?.retryCount || 0);
    const shouldRetry =
      config.retry !== false &&
      RETRYABLE_METHODS.has(method) &&
      retryCount < Number(config.retries ?? 1) &&
      isRetryableNetworkError(error);

    if (shouldRetry) {
      config.metadata = {
        ...(config.metadata || {}),
        retryCount: retryCount + 1,
      };
      return api(config);
    }

    if (isRetryableNetworkError(error)) {
      const connectivity = getConnectivitySnapshot();
      if (!connectivity.isOnline) {
        notifyNetworkIssue(NETWORK_MESSAGES.offline, 'warning', { status: 'offline' });
      } else {
        notifyNetworkIssue(NETWORK_MESSAGES.slow, 'warning', { status: 'slow' });
      }
    }

    return Promise.reject(error);
  },
);

export default api;
