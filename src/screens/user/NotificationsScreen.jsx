import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppHeader from '../../components/AppHeader';
import { useOnboardingNotifications } from '../../components/OnboardingNotifications';
import { colors, screenPad } from '../../utils/constants';

const createdValue = item => item?.createdAt || item?.submittedAt || item?.updatedAt || item?.joiningDate;

const createdTime = item => {
  const value = createdValue(item);
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
};

const dateTime = value => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const money = value => `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const onboardingId = item => {
  const linkedTenantId = typeof item?.tenantId === 'object' ? item.tenantId?._id || item.tenantId?.id : item?.tenantId;
  return linkedTenantId || item?._id || item?.id || `${item?.name || 'tenant'}-${createdValue(item) || ''}`;
};
const paymentId = item => item?._id || item?.id || `${item?.tenantId?._id || 'payment'}-${createdValue(item) || ''}`;

function StatusPill({ status }) {
  const palette = {
    Pending: { backgroundColor: colors.accentSoft, color: colors.warning },
    Approved: { backgroundColor: colors.successSoft, color: colors.success },
    Rejected: { backgroundColor: colors.dangerSoft, color: colors.danger },
  }[status] || { backgroundColor: colors.faint, color: colors.muted };

  return (
    <View style={[styles.statusPill, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.statusText, { color: palette.color }]}>{status || 'Pending'}</Text>
    </View>
  );
}

function NotificationCard({ entry, onPress }) {
  const isPayment = entry.type === 'payment';
  const item = entry.data;
  const tenant = isPayment ? (item.tenantId || {}) : item;
  const name = tenant?.name || tenant?.fullName || tenant?.tenantName || 'Tenant';
  const amount = item.requestAmount ?? item.paymentAmount ?? item.amount;

  return (
    <Pressable onPress={() => onPress(entry)} style={[styles.card, entry.isNew && styles.unreadCard]}>
      <View style={[styles.iconBox, isPayment ? styles.paymentIcon : styles.onboardingIcon]}>
        <Icon
          name={isPayment ? 'cash-clock' : 'account-plus-outline'}
          size={23}
          color={isPayment ? colors.warning : colors.primary}
        />
      </View>

      <View style={styles.cardCopy}>
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {isPayment ? 'Payment request' : 'New tenant onboarding'}
          </Text>
          {entry.isNew ? <View style={styles.unreadDot} /> : null}
        </View>

        <Text style={styles.bodyText}>
          {isPayment
            ? `${name} requested ${money(amount)}${item.monthYear ? ` for ${item.monthYear}` : ''}.`
            : `${name} submitted the onboarding form.`}
        </Text>

        <View style={styles.metaRow}>
          {isPayment ? <StatusPill status={item.status} /> : (
            <View style={styles.onboardingPill}>
              <Text style={styles.onboardingPillText}>Onboarding</Text>
            </View>
          )}
          <Text style={styles.dateText}>{dateTime(createdValue(item))}</Text>
        </View>
      </View>

      <Icon name="chevron-right" size={22} color={colors.muted} />
    </Pressable>
  );
}

export default function NotificationsScreen({ navigation }) {
  const {
    notifications = [],
    paymentRequests = [],
    refresh,
    markAllRead,
  } = useOnboardingNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const entries = useMemo(() => [
    ...notifications.map(item => ({
      key: `onboarding-${onboardingId(item)}`,
      type: 'onboarding',
      data: item,
      isNew: Boolean(item._isNew),
      time: createdTime(item),
    })),
    ...paymentRequests.map(item => ({
      key: `payment-${paymentId(item)}`,
      type: 'payment',
      data: item,
      isNew: Boolean(item._isNew),
      time: createdTime(item),
    })),
  ].sort((a, b) => b.time - a.time), [notifications, paymentRequests]);

  const loadAndRead = useCallback(async ({ pull = false } = {}) => {
    if (pull) setRefreshing(true);
    try {
      await refresh();
      await markAllRead();
    } finally {
      if (pull) setRefreshing(false);
    }
  }, [markAllRead, refresh]);

  useFocusEffect(useCallback(() => {
    loadAndRead();
  }, [loadAndRead]));

  const openEntry = useCallback(entry => {
    if (entry.type === 'payment') {
      navigation.navigate('PaymentRequests', { paymentRequestId: paymentId(entry.data) });
      return;
    }
    const tenantId = onboardingId(entry.data);
    if (tenantId) navigation.navigate('TenantDetails', { tenantId });
  }, [navigation]);

  return (
    <View style={styles.screen}>
      <AppHeader
        title="Notifications"
        subtitle={`${entries.length} ${entries.length === 1 ? 'notification' : 'notifications'}`}
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={entries}
        keyExtractor={item => item.key}
        renderItem={({ item }) => <NotificationCard entry={item} onPress={openEntry} />}
        contentContainerStyle={[styles.content, !entries.length && styles.emptyContent]}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAndRead({ pull: true })}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        )}
        ListHeaderComponent={entries.length ? (
          <View style={styles.feedHeader}>
            <View>
              <Text style={styles.feedTitle}>Recent activity</Text>
              <Text style={styles.feedSub}>Onboarding and payment request updates</Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
        ) : null}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="bell-sleep-outline" size={34} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>Onboarding submissions and payment requests will appear here.</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: screenPad, paddingBottom: 36, gap: 10 },
  emptyContent: { flexGrow: 1 },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  feedTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  feedSub: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: colors.successSoft,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unreadCard: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  iconBox: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  paymentIcon: { backgroundColor: colors.accentSoft },
  onboardingIcon: { backgroundColor: colors.primarySoft },
  cardCopy: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardTitle: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '900' },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  bodyText: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  statusPill: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 9.5, fontWeight: '900' },
  onboardingPill: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.violetSoft },
  onboardingPillText: { color: colors.violet, fontSize: 9.5, fontWeight: '900' },
  dateText: { flex: 1, color: colors.muted, fontSize: 9.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 16 },
  emptyText: { color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 6 },
});
