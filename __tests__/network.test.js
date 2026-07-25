import {
  __setConnectivityForTests,
  getConnectivitySnapshot,
  isOffline,
  subscribeConnectivity,
} from '../src/network/connectivity';
import {
  NETWORK_MESSAGES,
  __resetNetworkNotifierForTests,
  configureNetworkNotifier,
  notifyNetworkIssue,
} from '../src/network/networkFeedback';
import {
  createNetworkError,
  isRetryableNetworkError,
  isSafeBaseUrl,
} from '../src/api/client';
import { isTemporaryNetworkFailure } from '../src/api/apiHelpers';
import { getMessage } from '../src/utils/helpers';

describe('network connectivity state', () => {
  afterEach(() => {
    __setConnectivityForTests({
      isConnected: true,
      isInternetReachable: true,
      isOnline: true,
    });
  });

  it('marks validated internet as online and captive/no-internet as offline', () => {
    __setConnectivityForTests({ isConnected: true, isInternetReachable: false });
    expect(isOffline()).toBe(true);
    expect(getConnectivitySnapshot().isOnline).toBe(false);

    __setConnectivityForTests({ isConnected: true, isInternetReachable: true });
    expect(isOffline()).toBe(false);
  });

  it('notifies subscribers immediately and on changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeConnectivity(listener);
    __setConnectivityForTests({ isConnected: false, isInternetReachable: false });
    unsubscribe();

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ isOnline: true }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ isOnline: false }));
  });
});

describe('network feedback', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(10000);
  });

  afterEach(() => {
    Date.now.mockRestore();
    __resetNetworkNotifierForTests();
  });

  it('throttles repeated messages', () => {
    const showToast = jest.fn();
    configureNetworkNotifier(showToast);

    notifyNetworkIssue(NETWORK_MESSAGES.offline, 'warning', { status: 'offline' });
    notifyNetworkIssue(NETWORK_MESSAGES.offline, 'warning', { status: 'offline' });

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      NETWORK_MESSAGES.offline,
      'warning',
      expect.objectContaining({ key: 'network-status' }),
    );
  });
});

describe('network request helpers', () => {
  it('allows HTTPS and local HTTP only', () => {
    expect(isSafeBaseUrl('https://example.com/api')).toBe(true);
    expect(isSafeBaseUrl('http://localhost:3000/api')).toBe(true);
    expect(isSafeBaseUrl('http://10.0.2.2:3000/api')).toBe(true);
    expect(isSafeBaseUrl('http://example.com/api')).toBe(false);
  });

  it('classifies timeout and offline errors clearly', () => {
    const offline = createNetworkError(
      'No internet connection. Please check your network.',
      'ERR_OFFLINE',
    );
    const timeout = { code: 'ECONNABORTED', message: 'timeout of 20000ms exceeded' };

    expect(getMessage(offline)).toBe('No internet connection. Please check your network.');
    expect(getMessage(timeout)).toBe('Slow internet connection. Please check your connectivity.');
    expect(isRetryableNetworkError(timeout)).toBe(true);
    expect(isTemporaryNetworkFailure(timeout)).toBe(true);
  });
});
