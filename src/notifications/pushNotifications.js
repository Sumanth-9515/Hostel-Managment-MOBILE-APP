import { Alert, PermissionsAndroid, Platform } from 'react-native';
import api from '../api/client';
import { navigate } from '../navigation/navRef';

let unsubscribeTokenRefresh = null;
let unsubscribeForeground = null;
let unsubscribeNotificationOpen = null;
let listenersReady = false;
let currentToken = null;

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

// Route a tapped onboarding notification to the Onboarding tab.
function handleNotificationOpen(remoteMessage) {
  const type = remoteMessage?.data?.type;
  if (type === 'onboarding-submission') {
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
    const title = remoteMessage?.notification?.title || 'New notification';
    const body = remoteMessage?.notification?.body || '';
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

  // Attach tap/foreground listeners FIRST. A notification tap must always be
  // able to open the Onboarding screen even if permission prompts or the
  // backend token registration below fail — those must not strand the listeners.
  attachListeners(messagingInstance);

  try {
    const allowed = await requestFirebasePermission(messaging);
    if (!allowed) return;

    await messagingInstance.registerDeviceForRemoteMessages();
    const token = await messagingInstance.getToken();
    await saveToken(token, user);

    if (unsubscribeTokenRefresh) unsubscribeTokenRefresh();
    unsubscribeTokenRefresh = messagingInstance.onTokenRefresh(nextToken => {
      saveToken(nextToken, user).catch(() => {});
    });
  } catch {
    // Push setup should not block app login or navigation.
  }
}

// Called on logout so the signed-out device stops receiving this owner's pushes.
export async function unregisterPushNotifications() {
  try {
    if (unsubscribeTokenRefresh) unsubscribeTokenRefresh();
    if (unsubscribeForeground) unsubscribeForeground();
    if (unsubscribeNotificationOpen) unsubscribeNotificationOpen();
    unsubscribeTokenRefresh = null;
    unsubscribeForeground = null;
    unsubscribeNotificationOpen = null;
    listenersReady = false;

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
