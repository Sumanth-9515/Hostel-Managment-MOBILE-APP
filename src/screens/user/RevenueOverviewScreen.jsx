import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import EmptyState from '../../components/EmptyState';
import ProfileImagePopup from '../../components/ProfileImagePopup';
import { rentApi } from '../../api/rentApi';
import { colors } from '../../utils/constants';
import { getMessage, money } from '../../utils/helpers';

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

const currentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (monthYear = currentMonthValue()) => {
  const [year, month] = String(monthYear).split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

const locationLabel = item => {
  const tenant = item?.tenant || {};
  const allocation = tenant.allocationInfo || {};
  const details = item?.buildingDetails || {};
  const building = details.buildingName || allocation.buildingName;
  const floor = details.floorName || (details.floorNumber ? `Floor ${details.floorNumber}` : allocation.floorNumber ? `Floor ${allocation.floorNumber}` : '');
  const room = details.roomNumber || allocation.roomNumber;
  const bed = details.bedNumber || allocation.bedNumber;
  return [building, floor, room ? `Room ${room}` : '', bed ? `Bed ${bed}` : ''].filter(Boolean).join(' / ') || 'Location not assigned';
};

const remainingOf = item => Number(item?.remaining ?? ((item?.record?.rentAmount || 0) - (item?.record?.paidAmount || 0)));

const tenantIdOf = item => String(item?.tenant?._id || item?.tenantId || '');

const mergeTenantPhotos = (summary, rentAll = []) => {
  if (!summary || !Array.isArray(summary.tenants) || !Array.isArray(rentAll) || rentAll.length === 0) return summary;
  const rentTenantMap = new Map();
  rentAll.forEach(item => {
    const id = tenantIdOf(item);
    if (id) rentTenantMap.set(id, item.tenant || {});
  });
  return {
    ...summary,
    tenants: summary.tenants.map(item => {
      const rentTenant = rentTenantMap.get(tenantIdOf(item));
      if (!rentTenant) return item;
      return {
        ...item,
        tenant: {
          ...rentTenant,
          ...item.tenant,
          documents: {
            ...(item.tenant?.documents || {}),
            ...(rentTenant.documents || {}),
          },
        },
      };
    }),
  };
};

const buildRentMessage = (item, selectedMonth) => {
  const tenant = item?.tenant || {};
  const status = item?.record?.status || 'Due';
  const message = `Hello ${tenant.name || 'there'}, your rent status for ${monthLabel(selectedMonth)} is ${status}. Pending amount: ${money(remainingOf(item))}. Location: ${locationLabel(item)}.`;
  return encodeURIComponent(message);
};

const statusConfig = {
  Partial: { icon: 'progress-clock', color: colors.warning, bg: colors.accentSoft, empty: 'No partial payments for this month.' },
  Due: { icon: 'alert-circle-outline', color: colors.danger, bg: colors.dangerSoft, empty: 'No full dues for this month.' },
};

function SummaryBox({ label, value, color, bg }) {
  return (
    <View style={[styles.summaryBox, { backgroundColor: bg }]}>
      <Text style={[styles.summaryLabel, { color }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{value}</Text>
    </View>
  );
}

function CandidateRow({ item, monthYear, onPhotoPress, onOpenDetails }) {
  const tenant = item?.tenant || {};
  const status = item?.record?.status || 'Due';
  const config = statusConfig[status] || statusConfig.Due;
  const phone = tenant.phone?.replace(/\D/g, '');
  const photo = tenant.documents?.passportPhoto;
  const total = Number(item?.record?.rentAmount || 0);
  const paid = Number(item?.record?.paidAmount || 0);
  const remaining = remainingOf(item);

  const openCall = event => {
    event.stopPropagation();
    if (!phone) return Alert.alert('Phone missing', 'No phone number is available for this candidate.');
    Linking.openURL(`tel:${tenant.phone}`).catch(() => Alert.alert('Call', 'Unable to open phone dialer.'));
  };

  const openMessage = event => {
    event.stopPropagation();
    if (!phone) return Alert.alert('Phone missing', 'No phone number is available for this candidate.');
    Linking.openURL(`https://wa.me/91${phone}?text=${buildRentMessage(item, monthYear)}`).catch(() => Alert.alert('WhatsApp', 'Unable to open WhatsApp.'));
  };

  return (
    <Pressable style={styles.candidateRow} onPress={onOpenDetails}>
      <Pressable
        style={[styles.avatar, { backgroundColor: config.bg }]}
        disabled={!photo}
        onPress={event => {
          event.stopPropagation();
          if (photo) onPhotoPress({ imageUrl: photo, name: tenant.name });
        }}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatarImage} />
        ) : (
          <Text style={[styles.avatarText, { color: config.color }]}>{tenant.name?.[0]?.toUpperCase() || 'C'}</Text>
        )}
      </Pressable>
      <View style={styles.candidateMain}>
        <Text style={styles.candidateName} numberOfLines={1}>{tenant.name || 'Candidate'}</Text>
        <Text style={styles.candidateLocation} numberOfLines={2}>{locationLabel(item)}</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountText}>Total {money(total)}</Text>
          <Text style={[styles.amountText, { color: colors.success }]}>Paid {money(paid)}</Text>
          <Text style={[styles.amountText, { color: remaining > 0 ? colors.danger : colors.muted }]}>Due {money(remaining)}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={[styles.iconAction, { backgroundColor: colors.infoSoft }]} onPress={openCall}>
          <Icon name="phone" size={17} color={colors.info} />
        </Pressable>
        <Pressable style={[styles.iconAction, { backgroundColor: colors.successSoft }]} onPress={openMessage}>
          <Icon name="whatsapp" size={17} color={colors.success} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function StatusSection({ status, rows, monthYear, onPhotoPress, onOpenDetails }) {
  const config = statusConfig[status];
  const amount = rows.reduce((sum, item) => sum + remainingOf(item), 0);
  return (
    <AppCard style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIcon, { backgroundColor: config.bg }]}>
            <Icon name={config.icon} size={17} color={config.color} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>{status}</Text>
            <Text style={styles.sectionSub}>{rows.length} candidates</Text>
          </View>
        </View>
        <Text style={[styles.sectionAmount, { color: config.color }]} numberOfLines={1}>{money(amount)}</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>{config.empty}</Text>
      ) : rows.map(item => (
        <CandidateRow
          key={`${item?.tenant?._id || item?.tenantId}-${status}`}
          item={item}
          monthYear={monthYear}
          onPhotoPress={onPhotoPress}
          onOpenDetails={() => {
            const tenantId = item?.tenant?._id || item?.tenantId;
            if (tenantId) onOpenDetails(tenantId);
          }}
        />
      ))}
    </AppCard>
  );
}

export default function RevenueOverviewScreen({ navigation, route }) {
  const monthYear = route?.params?.monthYear || currentMonthValue();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [profilePopup, setProfilePopup] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [next, rentAll] = await Promise.all([
        rentApi.monthlySummary({ monthYear, includePaid: false }),
        rentApi.all().catch(() => []),
      ]);
      setData(mergeTenantPhotos(next, rentAll) || null);
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthYear]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const summary = data?.summary || {};
  const grouped = useMemo(() => ({
    Due: (Array.isArray(data?.tenants) ? data.tenants : []).filter(item => (item?.record?.status || 'Due') === 'Due'),
    Partial: (Array.isArray(data?.tenants) ? data.tenants : []).filter(item => (item?.record?.status || 'Due') === 'Partial'),
  }), [data?.tenants]);

  const total = Number(summary.totalRevenue || 0);
  const collected = Number(summary.collectedRevenue || 0);
  const pending = Number(summary.pendingRevenue || 0);

  return (
    <View style={styles.screen}>
      <AppHeader title="Revenue Overview" subtitle={monthLabel(monthYear)} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {error && !loading ? (
          <EmptyState title="Unable to load revenue" message={error} icon="wifi-alert" />
        ) : (
          <>
            <AppCard>
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroLabel}>Monthly Revenue</Text>
                  <Text style={styles.heroTitle}>{monthLabel(monthYear)}</Text>
                </View>
                <View style={styles.percentBadge}>
                  <Text style={styles.percentText}>{pct(collected, total)}%</Text>
                </View>
              </View>
              <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{loading ? 'Loading...' : money(collected)}</Text>
              <Text style={styles.muted}>collected of {money(total)} expected</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.min(100, pct(collected, total))}%` }]} />
              </View>
              <View style={styles.summaryGrid}>
                <SummaryBox label="Total" value={money(total)} color={colors.text} bg={colors.faint} />
                <SummaryBox label="Collected" value={money(collected)} color={colors.success} bg={colors.successSoft} />
                <SummaryBox label="Pending" value={money(pending)} color={colors.danger} bg={colors.dangerSoft} />
              </View>
            </AppCard>

            {['Due', 'Partial'].map(status => (
              <StatusSection
                key={status}
                status={status}
                rows={grouped[status]}
                monthYear={monthYear}
                onPhotoPress={setProfilePopup}
                onOpenDetails={tenantId => navigation.navigate('TenantDetails', { tenantId })}
              />
            ))}
          </>
        )}
        <View style={styles.footerSpacer} />
      </ScrollView>
      <ProfileImagePopup
        visible={!!profilePopup}
        imageUrl={profilePopup?.imageUrl}
        name={profilePopup?.name}
        onClose={() => setProfilePopup(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, paddingBottom: 28 },
  muted: { color: colors.muted, marginTop: 4 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  heroTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 3 },
  percentBadge: { backgroundColor: colors.primarySoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  percentText: { color: colors.primary, fontWeight: '900' },
  heroAmount: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 16 },
  track: { height: 9, borderRadius: 7, backgroundColor: '#eef0f4', overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', borderRadius: 7, backgroundColor: colors.primary },
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  summaryBox: { flex: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 8 },
  summaryLabel: { fontSize: 11, fontWeight: '800' },
  summaryValue: { fontSize: 14, fontWeight: '900', marginTop: 4 },
  sectionCard: { marginTop: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  sectionSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
  sectionAmount: { fontSize: 15, fontWeight: '900', maxWidth: 130, textAlign: 'right' },
  emptyText: { color: colors.muted, fontSize: 12, paddingVertical: 14 },
  candidateRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.faint, paddingTop: 12, marginTop: 12, gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 42, height: 42, borderRadius: 21 },
  avatarText: { fontSize: 16, fontWeight: '900' },
  candidateMain: { flex: 1, minWidth: 0 },
  candidateName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  candidateLocation: { color: colors.muted, fontSize: 11, marginTop: 2, lineHeight: 15 },
  amountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  amountText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 7 },
  iconAction: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  footerSpacer: { height: 82 },
});
