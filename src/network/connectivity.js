import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';

const ConnectivityModule =
  Platform.OS === 'android' ? NativeModules?.ConnectivityModule : null;

const DEFAULT_STATE = {
  isConnected: true,
  isInternetReachable: true,
  isOnline: true,
  isSlow: false,
  downstreamKbps: 0,
  type: 'unknown',
};

let currentState = DEFAULT_STATE;
let nativeSubscription = null;
let pollTimer = null;
let initialized = false;
let refreshPromise = null;
const listeners = new Set();
const POLL_MS = 3000;

const normalize = state => {
  const next = {
    ...DEFAULT_STATE,
    ...(state || {}),
  };
  next.isConnected = next.isConnected !== false;
  next.isInternetReachable = next.isInternetReachable !== false;
  next.isOnline = next.isConnected && next.isInternetReachable;
  next.downstreamKbps = Number(next.downstreamKbps || 0);
  next.isSlow = Boolean(next.isSlow) || (next.isOnline && next.downstreamKbps > 0 && next.downstreamKbps < 256);
  return next;
};

const emit = state => {
  currentState = normalize(state);
  listeners.forEach(listener => listener(currentState));
};

export const getConnectivitySnapshot = () => currentState;

export const isOffline = () => !currentState.isOnline;

export const subscribeConnectivity = listener => {
  listeners.add(listener);
  listener(currentState);
  return () => listeners.delete(listener);
};

export const initializeConnectivity = () => {
  if (initialized) return;
  initialized = true;

  if (!ConnectivityModule) return;

  refreshConnectivity();

  const emitter = new NativeEventEmitter(ConnectivityModule);
  nativeSubscription = emitter.addListener('ConnectivityChanged', emit);
  ConnectivityModule.start?.();
  pollTimer = setInterval(refreshConnectivity, POLL_MS);
};

export const stopConnectivity = () => {
  nativeSubscription?.remove?.();
  nativeSubscription = null;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  initialized = false;
};

export const refreshConnectivity = () => {
  if (!ConnectivityModule?.getCurrentState) return Promise.resolve(currentState);
  if (refreshPromise) return refreshPromise;
  refreshPromise = ConnectivityModule.getCurrentState()
    .then(state => {
      emit(state);
      return currentState;
    })
    .catch(() => currentState)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
};

export const getFreshConnectivitySnapshot = async (timeoutMs = 900) => {
  initializeConnectivity();
  return Promise.race([
    refreshConnectivity(),
    new Promise(resolve => setTimeout(() => resolve(currentState), timeoutMs)),
  ]);
};

export const __setConnectivityForTests = state => {
  emit(state);
};

export const useRefreshOnReconnect = refresh => {
  const isFocused = useIsFocused();
  const refreshRef = useRef(refresh);
  const wasOfflineRef = useRef(!currentState.isOnline);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!isFocused) return undefined;
    wasOfflineRef.current = !currentState.isOnline;

    return subscribeConnectivity(state => {
      if (!state.isOnline) {
        wasOfflineRef.current = true;
        return;
      }
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        refreshRef.current?.();
      }
    });
  }, [isFocused]);
};
