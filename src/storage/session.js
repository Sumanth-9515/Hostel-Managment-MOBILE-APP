import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const memoryStore = new Map();
const listeners = new Set();

const hasStorageMethod = method => typeof AsyncStorage?.[method] === 'function';
const secureStorage =
  Platform.OS === 'android' ? NativeModules?.SecureSessionStorage : null;

const hasSecureMethod = method => typeof secureStorage?.[method] === 'function';

const storage = {
  async getItem(key) {
    if (hasSecureMethod('getItem')) {
      return secureStorage.getItem(key);
    }
    if (hasStorageMethod('getItem')) {
      return AsyncStorage.getItem(key);
    }
    return memoryStore.get(key) || null;
  },
  async setItem(key, value) {
    const safeValue = value == null ? '' : String(value);
    if (hasSecureMethod('setItem')) {
      return secureStorage.setItem(key, safeValue);
    }
    if (hasStorageMethod('setItem')) {
      return AsyncStorage.setItem(key, safeValue);
    }
    memoryStore.set(key, safeValue);
  },
  async removeItem(key) {
    if (hasSecureMethod('removeItem')) {
      return secureStorage.removeItem(key);
    }
    if (hasStorageMethod('removeItem')) {
      return AsyncStorage.removeItem(key);
    }
    memoryStore.delete(key);
  },
};

export const session = {
  async getToken() {
    return storage.getItem(TOKEN_KEY);
  },
  async getUser() {
    const raw = await storage.getItem(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  async get() {
    const [token, user] = await Promise.all([this.getToken(), this.getUser()]);
    return { token, user };
  },
  async set(token, user) {
    await Promise.all([
      storage.setItem(TOKEN_KEY, token || ''),
      storage.setItem(USER_KEY, JSON.stringify(user || {})),
    ]);
  },
  async clear({ notify = false } = {}) {
    await Promise.all([
      storage.removeItem(TOKEN_KEY),
      storage.removeItem(USER_KEY),
    ]);
    if (notify) {
      listeners.forEach(listener => listener());
    }
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
