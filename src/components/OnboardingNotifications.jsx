import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { tenantApi } from '../api/tenantApi';
import { navRef } from '../navigation/navRef';
import { colors } from '../utils/constants';
import { pickArray } from '../utils/helpers';

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  open: () => {},
});

const LAST_SEEN_KEY = 'hosteliq_notif_last_seen';
const SHOWN_KEY = 'hosteliq_notif_shown_ids';

const getTenantId = tenant => tenant?._id || tenant?.id || tenant?.tenantId || `${tenant?.name || 'tenant'}-${tenant?.createdAt || ''}`;

const getCreatedAt = tenant => {
  const value = tenant?.createdAt || tenant?.submittedAt || tenant?.updatedAt || tenant?.joiningDate;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
};

const getTenantName = tenant => tenant?.name || tenant?.fullName || tenant?.tenantName || 'Tenant';

const timeText = value => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'just now';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const notificationBody = (ownerName, tenant) =>
  `hi ${ownerName}, ${getTenantName(tenant)} submitted the onboarding form at ${timeText(tenant?.createdAt || tenant?.submittedAt)}. Review now.`;

const createdValue = tenant => tenant?.createdAt || tenant?.submittedAt || tenant?.updatedAt || tenant?.joiningDate;

// "25 Jun 2026" — submission date shown on the pill.
const dateLabel = value => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// "₹5,000" — matches the in-app card chip.
const rupees = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// "just now" / "5m ago" / "3h ago" / "1d ago" — footer line under each card.
const relativeTime = value => {
  const time = value ? new Date(value).getTime() : 0;
  if (!time || Number.isNaN(time)) return 'just now';
  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

const hostelName = tenant => tenant?.allocationInfo?.buildingName || tenant?.buildingName || null;

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

export function OnboardingNotificationsProvider({ children, user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [banner, setBanner] = useState(null);
  const slide = useRef(new Animated.Value(-120)).current;
  const ownerName = user?.owner || user?.name || 'owner';

  const loadNotifications = useCallback(async ({ announce = false } = {}) => {
    try {
      let payload;
      try {
        payload = await tenantApi.notifications();
      } catch {
        payload = await tenantApi.list({ source: 'onboarding-link' });
      }

      const items = pickArray(payload)
        .slice()
        .sort((a, b) => getCreatedAt(b) - getCreatedAt(a));

      const lastSeenRaw = await AsyncStorage.getItem(LAST_SEEN_KEY);
      const lastSeen = lastSeenRaw ? new Date(lastSeenRaw).getTime() : 0;
      const enriched = items.map(item => ({ ...item, _isNew: getCreatedAt(item) > lastSeen }));
      setNotifications(enriched);
      setUnreadCount(enriched.filter(item => item._isNew).length);

      if (announce) {
        const shownIds = await readShownIds();
        const latestFresh = enriched.find(item => item._isNew && !shownIds.includes(getTenantId(item)));
        if (latestFresh) {
          setBanner(latestFresh);
          await writeShownIds([getTenantId(latestFresh), ...shownIds]);
        }
      }
    } catch {
      // Notification polling should never disturb the active screen.
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const id = setInterval(() => loadNotifications({ announce: true }), 20000);
    return () => clearInterval(id);
  }, [loadNotifications]);

  useEffect(() => {
    if (!banner) return undefined;
    slide.setValue(-120);
    Animated.spring(slide, { toValue: 0, speed: 16, bounciness: 5, useNativeDriver: true }).start();
    const id = setTimeout(() => {
      Animated.timing(slide, { toValue: -120, duration: 220, useNativeDriver: true }).start(() => setBanner(null));
    }, 5200);
    return () => clearTimeout(id);
  }, [banner, slide]);

  const markAllRead = useCallback(async () => {
    try {
      await AsyncStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
      setUnreadCount(0);
      setNotifications(items => items.map(item => ({ ...item, _isNew: false })));
      await tenantApi.markVerified();
    } catch {
      // Local read state is already updated; backend sync can fail silently.
    }
  }, []);

  const open = useCallback(() => {
    setDropdownOpen(true);
    markAllRead();
  }, [markAllRead]);

  const close = useCallback(() => setDropdownOpen(false), []);

  const goToOnboarding = useCallback(() => {
    close();
    if (navRef.isReady()) {
      navRef.navigate('UserTabs', { screen: 'Onboarding' });
    }
  }, [close]);

  const value = useMemo(() => ({ notifications, unreadCount, open }), [notifications, unreadCount, open]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {banner ? (
        <Animated.View style={[styles.banner, { transform: [{ translateY: slide }] }]}>
          <Pressable style={styles.bannerPress} onPress={goToOnboarding}>
            <View style={styles.bannerIcon}>
              <Icon name="bell-ring-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.bannerTitle}>New Onboarding Submission 📥</Text>
              <Text style={styles.bannerBody} numberOfLines={2}>{notificationBody(ownerName, banner)}</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      <Modal visible={dropdownOpen} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.overlay} onPress={close}>
          <Pressable style={styles.dropdown} onPress={event => event.stopPropagation()}>
            <View style={styles.dropHead}>
              <View>
                <Text style={styles.dropTitle}>Onboarding Notifications</Text>
                <Text style={styles.dropSub}>{notifications.length} submissions</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={close}>
                <Icon name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {notifications.length ? notifications.map(item => {
                const name = getTenantName(item);
                const photo = item?.documents?.passportPhoto;
                const date = dateLabel(createdValue(item));
                const hostel = hostelName(item);
                return (
                  <Pressable key={getTenantId(item)} style={styles.item} onPress={goToOnboarding}>
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarText}>{name?.[0]?.toUpperCase() || '?'}</Text>
                      </View>
                    )}

                    <View style={styles.flex}>
                      <View style={styles.nameRow}>
                        <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
                        {item._isNew ? (
                          <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>NEW</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.contactRow}>
                        <Icon name="cellphone" size={13} color={colors.muted} />
                        <Text style={styles.contactText} numberOfLines={1}>
                          {item?.phone || '—'}{item?.email ? `  ·  ${item.email}` : ''}
                        </Text>
                      </View>

                      <View style={styles.chipRow}>
                        {date ? (
                          <View style={[styles.chip, styles.chipDate]}>
                            <Icon name="calendar-month-outline" size={12} color={colors.violet} />
                            <Text style={[styles.chipText, { color: colors.violet }]}>{date}</Text>
                          </View>
                        ) : null}
                        <View style={[styles.chip, styles.chipMoney]}>
                          <Text style={[styles.chipText, { color: colors.success }]}>{rupees(item?.rentAmount)}</Text>
                        </View>
                        {hostel ? (
                          <View style={[styles.chip, styles.chipHostel]}>
                            <Icon name="home-outline" size={12} color={colors.warning} />
                            <Text style={[styles.chipText, { color: colors.warning }]} numberOfLines={1}>{hostel}</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.viewMore}>👉 View more details</Text>
                      <Text style={styles.footerMeta} numberOfLines={1}>
                        Filled via onboarding form · {relativeTime(createdValue(item))}
                      </Text>
                    </View>

                    {item._isNew ? <View style={styles.unreadDot} /> : null}
                  </Pressable>
                );
              }) : (
                <View style={styles.empty}>
                  <Icon name="bell-sleep-outline" size={28} color={colors.muted} />
                  <Text style={styles.emptyTitle}>No onboarding submissions</Text>
                  <Text style={styles.emptyText}>New tenant forms will appear here for this owner.</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </NotificationContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 80,
    elevation: 20,
  },
  bannerPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  bannerTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  bannerBody: { color: colors.muted, fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.20)',
    alignItems: 'flex-end',
    paddingTop: 68,
    paddingHorizontal: 12,
  },
  dropdown: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '72%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  dropHead: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  dropSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  list: { maxHeight: 480 },
  listContent: { padding: 10, gap: 8 },
  item: {
    flexDirection: 'row',
    gap: 10,
    padding: 11,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.faint },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, color: colors.primary, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemName: { color: colors.text, fontSize: 13.5, fontWeight: '800', flexShrink: 1 },
  newBadge: { backgroundColor: colors.success, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 1.5 },
  newBadgeText: { color: '#fff', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.3 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  contactText: { color: colors.muted, fontSize: 10.5, flexShrink: 1 },
  chipRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3, maxWidth: 130 },
  chipDate: { backgroundColor: colors.violetSoft },
  chipMoney: { backgroundColor: colors.successSoft },
  chipHostel: { backgroundColor: colors.accentSoft },
  chipText: { fontSize: 10, fontWeight: '700' },
  viewMore: { color: colors.primary, fontSize: 11, fontWeight: '800', marginTop: 7 },
  footerMeta: { color: colors.muted, fontSize: 9.5, marginTop: 4 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20 },
  emptyTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 8 },
  emptyText: { color: colors.muted, fontSize: 11, marginTop: 4, textAlign: 'center' },
});
