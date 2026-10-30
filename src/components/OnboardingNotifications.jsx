import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { paymentRequestApi } from '../api/paymentRequestApi';
import { tenantApi } from '../api/tenantApi';
import { navRef } from '../navigation/navRef';
import { colors } from '../utils/constants';
import { pickArray } from '../utils/helpers';

const NotificationContext = createContext({
  notifications: [],
  paymentRequests: [],
  unreadCount: 0,
  refresh: async () => {},
  markAllRead: async () => {},
});

const LAST_SEEN_KEY = 'hosteliq_notif_last_seen';
const SHOWN_KEY = 'hosteliq_notif_shown_ids';

const getTenantId = tenant => tenant?._id || tenant?.id || tenant?.tenantId || `${tenant?.name || 'tenant'}-${tenant?.createdAt || ''}`;
const getTenantName = tenant => tenant?.name || tenant?.fullName || tenant?.tenantName || 'Tenant';

const getCreatedAt = item => {
  const value = item?.createdAt || item?.submittedAt || item?.updatedAt || item?.joiningDate;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
};

const timeText = value => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'just now';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const notificationBody = (ownerName, tenant) =>
  `Hi ${ownerName}, ${getTenantName(tenant)} submitted the onboarding form at ${timeText(tenant?.createdAt || tenant?.submittedAt)}. Review now.`;

async function readShownIds() {
  try {
    const raw = await AsyncStorage.getItem(SHOWN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeShownIds(ids) {
  try {
    await AsyncStorage.setItem(SHOWN_KEY, JSON.stringify(ids.slice(0, 80)));
  } catch {
    // Non-critical cache only.
  }
}

export const useOnboardingNotifications = () => useContext(NotificationContext);

function OnboardingBanner({ banner, ownerName, onDismiss, onOpen }) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-140)).current;
  const dismissedRef = useRef(false);

  const dismiss = useCallback((direction, reason = 'timeout') => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    const distance = (Dimensions.get('window').width + 80) * (direction < 0 ? -1 : 1);
    Animated.timing(translateX, { toValue: distance, duration: 210, useNativeDriver: false })
      .start(({ finished }) => {
        if (finished) onDismiss(reason);
      });
  }, [onDismiss, translateX]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      Math.abs(gesture.dx) > 7 && Math.abs(gesture.dx) > Math.abs(gesture.dy)
    ),
    onPanResponderMove: Animated.event([null, { dx: translateX }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > 72 || Math.abs(gesture.vx) > 0.65) {
        dismiss(Math.abs(gesture.dx) > 10 ? gesture.dx : gesture.vx, 'swipe');
        return;
      }
      Animated.spring(translateX, { toValue: 0, speed: 22, bounciness: 5, useNativeDriver: false }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, speed: 22, bounciness: 5, useNativeDriver: false }).start();
    },
  }), [dismiss, translateX]);

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, speed: 18, bounciness: 4, useNativeDriver: false }).start();
    const id = setTimeout(() => dismiss(1), 5200);
    return () => clearTimeout(id);
  }, [dismiss, translateY]);

  const opacity = translateX.interpolate({
    inputRange: [-180, 0, 180],
    outputRange: [0.25, 1, 0.25],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      accessibilityLiveRegion="polite"
      style={[styles.banner, {
        top: insets.top + 8,
        opacity,
        transform: [{ translateY }, { translateX }],
      }]}
    >
      <Pressable style={styles.bannerPress} onPress={onOpen}>
        <View style={styles.bannerIcon}>
          <Icon name="bell-ring-outline" size={24} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.bannerTitle}>New onboarding submission</Text>
          <Text style={styles.bannerBody} numberOfLines={2}>{notificationBody(ownerName, banner)}</Text>
          <Text style={styles.swipeHint}>Swipe left or right to dismiss</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function OnboardingNotificationsProvider({ children, user }) {
  const [notifications, setNotifications] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [bannerQueue, setBannerQueue] = useState([]);
  const advanceBannerTimerRef = useRef(null);
  const banner = bannerQueue[0] || null;
  const ownerName = user?.owner || user?.name || 'owner';

  const loadNotifications = useCallback(async ({ announce = false } = {}) => {
    let lastSeen = 0;
    try {
      const lastSeenRaw = await AsyncStorage.getItem(LAST_SEEN_KEY);
      lastSeen = lastSeenRaw ? new Date(lastSeenRaw).getTime() : 0;
    } catch {
      // Continue with the in-memory feed when local storage is unavailable.
    }

    try {
      let payload;
      try {
        payload = await tenantApi.notifications();
      } catch {
        payload = await tenantApi.list({ source: 'onboarding-link' });
      }
      const items = pickArray(payload).slice().sort((a, b) => getCreatedAt(b) - getCreatedAt(a));
      const enriched = items.map(item => ({ ...item, _isNew: getCreatedAt(item) > lastSeen }));
      setNotifications(enriched);

      if (announce) {
        const shownIds = await readShownIds();
        const shownSet = new Set(shownIds);
        const freshItems = enriched.filter(item => item._isNew && !shownSet.has(getTenantId(item)));
        if (freshItems.length) {
          setBannerQueue(current => {
            const queuedIds = new Set(current.map(getTenantId));
            return [...current, ...freshItems.filter(item => !queuedIds.has(getTenantId(item)))];
          });
          await writeShownIds([...freshItems.map(getTenantId), ...shownIds]);
        }
      }
    } catch {
      // One unavailable feed must not stop other notification types.
    }

    try {
      const payload = await paymentRequestApi.list();
      const items = pickArray(payload)
        .slice()
        .sort((a, b) => getCreatedAt(b) - getCreatedAt(a))
        .map(item => ({ ...item, _isNew: getCreatedAt(item) > lastSeen }));
      setPaymentRequests(items);
    } catch {
      // Keep the last payment-request feed during temporary API failures.
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const id = setInterval(() => loadNotifications({ announce: true }), 20000);
    return () => {
      clearInterval(id);
      if (advanceBannerTimerRef.current) clearTimeout(advanceBannerTimerRef.current);
    };
  }, [loadNotifications]);

  const markAllRead = useCallback(async () => {
    setNotifications(items => items.map(item => ({ ...item, _isNew: false })));
    setPaymentRequests(items => items.map(item => ({ ...item, _isNew: false })));
    try {
      await AsyncStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
      await tenantApi.markVerified();
    } catch {
      // Local read state is already updated; backend sync can fail silently.
    }
  }, []);

  const dismissBanner = useCallback((reason = 'immediate') => {
    const advance = () => {
      advanceBannerTimerRef.current = null;
      setBannerQueue(current => current.slice(1));
    };
    if (reason === 'swipe') {
      advanceBannerTimerRef.current = setTimeout(advance, 2000);
      return;
    }
    advance();
  }, []);

  const openBanner = useCallback(() => {
    dismissBanner();
    if (navRef.isReady()) navRef.navigate('UserTabs', { screen: 'Onboarding' });
  }, [dismissBanner]);

  const unreadCount = useMemo(
    () => notifications.filter(item => item._isNew).length + paymentRequests.filter(item => item._isNew).length,
    [notifications, paymentRequests],
  );
  const value = useMemo(() => ({
    notifications,
    paymentRequests,
    unreadCount,
    refresh: loadNotifications,
    markAllRead,
  }), [loadNotifications, markAllRead, notifications, paymentRequests, unreadCount]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {banner ? (
        <OnboardingBanner
          key={getTenantId(banner)}
          banner={banner}
          ownerName={ownerName}
          onDismiss={dismissBanner}
          onOpen={openBanner}
        />
      ) : null}
    </NotificationContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: { position: 'absolute', left: 14, right: 14, zIndex: 80, elevation: 20 },
  bannerPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 12,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  bannerTitle: { color: colors.text, fontSize: 15, fontWeight: '900', letterSpacing: -0.15 },
  bannerBody: { color: colors.muted, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  swipeHint: { color: colors.primary, fontSize: 9.5, fontWeight: '700', marginTop: 4 },
});
