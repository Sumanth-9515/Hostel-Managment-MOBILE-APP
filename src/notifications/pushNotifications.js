import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import api from '../api/client';
import { navigate } from '../navigation/navRef';

let unsubscribeTokenRefresh = null;
let unsubscribeForeground = null;
let unsubscribeNotificationOpen = null;
let unsubscribeAppState = null;
let listenersReady = false;
let currentToken = null;
let currentUser = null;

const warnPush = (...args) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[push]', ...args);
  }
};

function getMessaging() {
  try {
    return require('@react-native-firebase/messaging').default;
  } catch {
    return null;
  }
}

function getMessagingInstance() {
  const messaging = getMessaging();
  if (!messaging) return null;

  try {
    return messaging();
  } catch {
    return null;
  }
}

async function requestAndroidPermission() {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function requestFirebasePermission(messaging) {
  if (Platform.OS === 'android') return requestAndroidPermission();

  const status = await messaging().requestPermission();
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

async function saveToken(token, user) {
  if (!token || user?.role === 'master') return;
  currentToken = token;
  await api.post('/push-tokens/register', {
    token,
    platform: Platform.OS,
    purpose: 'onboarding-submissions',
    ownerId: user?._id || user?.id,
  });
}

async function getAndSaveToken(messagingInstance, user) {
  await messagingInstance.registerDeviceForRemoteMessages();
  const token = await messagingInstance.getToken();
  await saveToken(token, user);
  return token;
}

// Route a tapped onboarding notification to the Onboarding tab.
function handleNotificationOpen(remoteMessage) {
  const type = String(remoteMessage?.data?.type || '').toLowerCase();
  const title = String(remoteMessage?.notification?.title || remoteMessage?.data?.title || '').toLowerCase();
  const body = String(remoteMessage?.notification?.body || remoteMessage?.data?.body || remoteMessage?.data?.message || '').toLowerCase();
  if (!type || type.includes('onboarding') || title.includes('onboarding') || body.includes('onboarding')) {
    navigate('UserTabs', { screen: 'Onboarding' });
  }
}

// Foreground + tap listeners. Android/iOS show the tray notification by
// themselves when the app is backgrounded/closed (notification payload), so
// here we only need to surface foreground messages and react to taps.
function attachListeners(messagingInstance) {
  if (listenersReady) return;
  listenersReady = true;

  // App in foreground: the OS does NOT show a tray notification, so present
  // a lightweight in-app heads-up (WhatsApp-style banner is also handled by
  // OnboardingNotificationsProvider; this gives an instant alert too).
  unsubscribeForeground = messagingInstance.onMessage(async remoteMessage => {
    const data = remoteMessage?.data || {};
    const title = remoteMessage?.notification?.title || data.title || 'New onboarding submission';
    const body = remoteMessage?.notification?.body || data.body || data.message || 'A tenant submitted the onboarding form.';
    Alert.alert(title, body, [
      { text: 'Dismiss', style: 'cancel' },
      { text: 'View', onPress: () => handleNotificationOpen(remoteMessage) },
    ]);
  });

  // App in background and user taps the notification.
  unsubscribeNotificationOpen = messagingInstance.onNotificationOpenedApp(remoteMessage => {
    if (remoteMessage) handleNotificationOpen(remoteMessage);
  });

  // App was fully quit and launched by tapping the notification.
  messagingInstance
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) handleNotificationOpen(remoteMessage);
    })
    .catch(() => {});
}

export async function registerPushNotifications(user) {
  const messaging = getMessaging();
  const messagingInstance = getMessagingInstance();
  if (!messaging || !messagingInstance || !user || user?.role === 'master') return;
  currentUser = user;

  // Attach tap/foreground listeners FIRST. A notification tap must always be
  // able to open the Onboarding screen even if permission prompts or the
  // backend token registration below fail — those must not strand the listeners.
  attachListeners(messagingInstance);

  try {
    await messagingInstance.setAutoInitEnabled?.(true);
    const allowed = await requestFirebasePermission(messaging);
    if (!allowed) {
      warnPush('notification permission not granted');
      return;
    }

    await getAndSaveToken(messagingInstance, user);

    if (unsubscribeTokenRefresh) unsubscribeTokenRefresh();
    unsubscribeTokenRefresh = messagingInstance.onTokenRefresh(nextToken => {
      saveToken(nextToken, currentUser || user).catch(error => warnPush('token refresh save failed', error?.message || error));
    });

    if (!unsubscribeAppState) {
      unsubscribeAppState = AppState.addEventListener('change', state => {
        if (state === 'active' && currentUser) {
          getAndSaveToken(messagingInstance, currentUser).catch(error => warnPush('token resume save failed', error?.message || error));
        }
      });
    }
  } catch (error) {
    warnPush('setup failed', error?.message || error);
    // Push setup should not block app login or navigation.
  }
}

// Called on logout so the signed-out device stops receiving this owner's pushes.
export async function unregisterPushNotifications() {
  try {
    if (unsubscribeTokenRefresh) unsubscribeTokenRefresh();
    if (unsubscribeForeground) unsubscribeForeground();
    if (unsubscribeNotificationOpen) unsubscribeNotificationOpen();
    if (unsubscribeAppState) unsubscribeAppState.remove();
    unsubscribeTokenRefresh = null;
    unsubscribeForeground = null;
    unsubscribeNotificationOpen = null;
    unsubscribeAppState = null;
    listenersReady = false;
    currentUser = null;

    const messagingInstance = getMessagingInstance();
    const token = currentToken || (messagingInstance ? await messagingInstance.getToken() : null);
    if (token) {
      await api.post('/push-tokens/unregister', { token }).catch(() => {});
    }
    if (messagingInstance) {
      await messagingInstance.deleteToken().catch(() => {});
    }
    currentToken = null;
  } catch {
    // Logout must never be blocked by push cleanup.
  }
}

export function registerBackgroundMessageHandler() {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) return;

  messagingInstance.setBackgroundMessageHandler(async () => {
    // Notification payloads are displayed by Android/iOS while the app is closed.
    // Data-only payloads require a local-notification library to show UI here.
  });
}
