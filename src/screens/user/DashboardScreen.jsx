import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import EmptyState from '../../components/EmptyState';
import { useSidebar } from '../../components/Sidebar';
import { authApi } from '../../api/authApi';
import { buildingApi } from '../../api/buildingApi';
import { rentApi } from '../../api/rentApi';
import { useRefreshOnReconnect } from '../../network/connectivity';
import { colors } from '../../utils/constants';
import { registerCacheReset } from '../../utils/cacheRegistry';
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

const monthOptions = (count = 12) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { value, label: monthLabel(value) };
  });
};

const dashboardCache = {
  hasData: false,
  profile: null,
  overview: [],
  selectedMonth: currentMonthValue(),
  monthlyRevenue: null,
};

registerCacheReset(() => {
  dashboardCache.hasData = false;
  dashboardCache.profile = null;
  dashboardCache.overview = [];
  dashboardCache.selectedMonth = currentMonthValue();
  dashboardCache.monthlyRevenue = null;
});

function Bar({ value, total, color = colors.primary }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(100, pct(value, total))}%`, backgroundColor: color }]} />
    </View>
  );
}

function Kpi({ icon, label, value, sub, color, amount }) {
  return (
    <View style={[styles.kpi, { borderColor: `${color}20` }]}>
      <View style={[styles.kpiIcon, { borderColor: `${color}24` }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <View style={styles.kpiContent}>
        <Text style={[styles.kpiValue, amount && styles.kpiAmount]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.48}>{value}</Text>
        <Text style={styles.kpiLabel} numberOfLines={2}>{label}</Text>
        {sub ? <Text style={[styles.kpiSub, amount && { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function Action({ icon, label, color, onPress }) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}18` }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function MonthChip({ label, active, onPress }) {
  return (
    <Pressable
      style={[styles.monthChip, active && styles.monthChipActive]}
      onPress={event => {
        event.stopPropagation();
        onPress();
      }}>
      <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function DashboardDataSkeleton() {
  return (
    <View pointerEvents="none">
      <View style={styles.kpiGrid}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[styles.kpi, { borderColor: '#e4e8ef', backgroundColor: colors.surface }]}>
            <View style={[styles.skeletonBlock, { width: 36, height: 36, borderRadius: 11 }]} />
            <View style={styles.kpiContent}>
              <View style={[styles.skeletonBlock, { width: '72%', height: 18 }]} />
              <View style={[styles.skeletonBlock, { width: '84%', height: 11, marginTop: 7 }]} />
              <View style={[styles.skeletonBlock, { width: '62%', height: 9, marginTop: 5 }]} />
            </View>
          </View>
        ))}
      </View>
      {[0, 1].map(i => (
        <View key={i} style={styles.skeletonCard}>
          <View style={[styles.skeletonBlock, { width: '55%', height: 15 }]} />
          <View style={[styles.skeletonBlock, { width: '35%', height: 26, marginTop: 12 }]} />
          <View style={[styles.skeletonBlock, { width: '100%', height: 8, marginTop: 10, borderRadius: 6 }]} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <View style={[styles.skeletonBlock, { flex: 1, height: 48, borderRadius: 12 }]} />
            <View style={[styles.skeletonBlock, { flex: 1, height: 48, borderRadius: 12 }]} />
            <View style={[styles.skeletonBlock, { flex: 1, height: 48, borderRadius: 12 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function DashboardScreen({ navigation, onLogout, user }) {
  const { open } = useSidebar();
  const [dataLoading, setDataLoading] = useState(!dashboardCache.hasData);
  const [dataError, setDataError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(dashboardCache.profile || user);
  const [overview, setOverview] = useState(dashboardCache.overview);
  const [selectedMonth, setSelectedMonth] = useState(dashboardCache.selectedMonth);
  const [monthlyRevenue, setMonthlyRevenue] = useState(dashboardCache.monthlyRevenue);
  const [monthlyRevenueLoading, setMonthlyRevenueLoading] = useState(!dashboardCache.monthlyRevenue);

  const hasLoadedRef = useRef(dashboardCache.hasData);
  const loadRequestRef = useRef(0);
  const revenueRequestRef = useRef(0);
  const helloWave = useRef(new Animated.Value(0)).current;
  const revenueMonthOptions = useMemo(() => monthOptions(), []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(helloWave, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(helloWave, { toValue: -1, duration: 120, useNativeDriver: true }),
        Animated.timing(helloWave, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(helloWave, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.delay(700),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [helloWave]);

  const load = useCallback(async (options = {}) => {
    const requestId = ++loadRequestRef.current;
    if (!options.background) {
      setDataLoading(true);
    }
    setDataError(null);
    try {
      const [p, ov] = await Promise.all([
        authApi.profile().catch(() => user),
        buildingApi.overview().catch(() => []),
      ]);
      if (requestId !== loadRequestRef.current) return;
      const safeOverview = Array.isArray(ov) ? ov : [];
      setProfile(p);
      setOverview(safeOverview);
      dashboardCache.hasData = true;
      dashboardCache.profile = p;
      dashboardCache.overview = safeOverview;
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        setDataError(getMessage(error));
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setDataLoading(false);
        setRefreshing(false);
      }
    }
  }, [user]);

  const loadMonthlyRevenue = useCallback(async monthYear => {
    const requestId = ++revenueRequestRef.current;
    setMonthlyRevenueLoading(true);
    setMonthlyRevenue(null);
    dashboardCache.monthlyRevenue = null;
    try {
      const data = await rentApi.monthlySummary({ monthYear, includePaid: false });
      if (requestId !== revenueRequestRef.current) return;
      setMonthlyRevenue(data || null);
      dashboardCache.monthlyRevenue = data || null;
    } catch (error) {
      if (requestId === revenueRequestRef.current) {
        setMonthlyRevenue(null);
      }
    } finally {
      if (requestId === revenueRequestRef.current) {
        setMonthlyRevenueLoading(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load({ background: hasLoadedRef.current || dashboardCache.hasData })
      .then(() => { hasLoadedRef.current = true; });
  }, [load]));

  useEffect(() => {
    loadMonthlyRevenue(selectedMonth);
  }, [loadMonthlyRevenue, selectedMonth]);

  useRefreshOnReconnect(useCallback(() => {
    load({ background: dashboardCache.hasData });
    loadMonthlyRevenue(selectedMonth);
  }, [load, loadMonthlyRevenue, selectedMonth]));

  const selectMonth = monthYear => {
    setSelectedMonth(monthYear);
    setMonthlyRevenueLoading(true);
    setMonthlyRevenue(null);
    dashboardCache.selectedMonth = monthYear;
    dashboardCache.monthlyRevenue = null;
  };

  const totalBeds = overview.reduce((s, b) => s + (b.totalBeds || 0), 0);
  const occupiedBeds = overview.reduce((s, b) => s + (b.occupiedBeds || 0), 0);
  const availableBeds = totalBeds - occupiedBeds;
  const totalFloors = overview.reduce((s, b) => s + (b.totalFloors || 0), 0);
  const totalRooms = overview.reduce((s, b) => s + (b.totalRooms || 0), 0);
  const totalTenants = overview.reduce((s, b) => s + (b.totalTenants || 0), 0);

  const revenueSummary = monthlyRevenue?.summary || {};
  const totalRevenue = revenueSummary.totalRevenue || 0;
  const collected = revenueSummary.collectedRevenue || 0;
  const pending = revenueSummary.pendingRevenue || 0;
  const paidCount = revenueSummary.counts?.Paid || 0;
  const partialCount = revenueSummary.counts?.Partial || 0;
  const dueCount = revenueSummary.counts?.Due || 0;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const ownerName = profile?.owner || profile?.name || 'Owner';

  const hasData = dashboardCache.hasData;
  const showSkeleton = dataLoading && !hasData;
  const showError = !!dataError && !dataLoading && !hasData;
  const isCurrentMonth = selectedMonth === currentMonthValue();
  const collectedLabel = isCurrentMonth ? 'Collected this month' : 'Collected';
  const pendingLabel = isCurrentMonth ? 'Pending this month' : 'Pending';

  return (
    <View style={styles.screen}>
      <AppHeader title="" subtitle="Hostel Management" onMenu={open} onLogout={onLogout} showOnboardingNotifications />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); loadMonthlyRevenue(selectedMonth); }} />}>

        <View style={styles.greetingRow}>
          <Text style={styles.hello}>{greet},{ownerName}..</Text>
          <Animated.Image
            source={require('../../../assets/hello.gif')}
            style={[
              styles.helloGif,
              {
                transform: [
                  {
                    rotate: helloWave.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: ['-14deg', '0deg', '14deg'],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        <Text style={styles.muted}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>

        {showSkeleton ? <DashboardDataSkeleton /> : showError ? (
          <EmptyState title="Unable to load dashboard" message={dataError} icon="wifi-alert" />
        ) : (
          <>
            {/* KPI strip */}
            <View style={styles.kpiGrid}>
              <Kpi icon="bed" label="Total Beds" value={totalBeds} sub={`${availableBeds} available`} color={colors.info} />
              <Kpi icon="account-group" label="Tenants" value={totalTenants} sub="Active" color={colors.violet} />
              <Kpi amount icon="cash-check" label={collectedLabel} value={monthlyRevenueLoading ? 'Loading...' : money(collected)} color={colors.success} />
              <Kpi amount icon="cash-minus" label={pendingLabel} value={monthlyRevenueLoading ? 'Loading...' : money(pending)} color={colors.danger} />
            </View>

            {/* Monthly revenue */}
            <Pressable onPress={() => navigation.navigate('RevenueOverview', { monthYear: selectedMonth })}>
              <AppCard>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.cardTitle}>Monthly Revenue</Text>
                    <Text style={styles.cardHint}>Tap card for due and partial details</Text>
                  </View>
                  <Text style={styles.tag}>{monthLabel(selectedMonth)}</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.monthFilter}
                  nestedScrollEnabled>
                  {revenueMonthOptions.map(option => (
                    <MonthChip
                      key={option.value}
                      label={option.label}
                      active={option.value === selectedMonth}
                      onPress={() => selectMonth(option.value)}
                    />
                  ))}
                </ScrollView>
                <View style={styles.revRow}>
                  <Text style={styles.revBig}>{monthlyRevenueLoading ? 'Loading...' : money(collected)}</Text>
                  <Text style={styles.revPct}>{monthlyRevenueLoading ? '--' : `${pct(collected, totalRevenue)}%`}</Text>
                </View>
                <Text style={styles.muted}>{monthlyRevenueLoading ? `Fetching ${monthLabel(selectedMonth)} revenue` : `of ${money(totalRevenue)} expected`}</Text>
                <View style={styles.barWrap}><Bar value={monthlyRevenueLoading ? 0 : collected} total={totalRevenue} color={colors.primary} /></View>
                <View style={styles.miniGrid}>
                  <View style={[styles.mini, { backgroundColor: colors.successSoft }]}>
                    <Text style={[styles.miniValue, { color: colors.success }]}>{monthlyRevenueLoading ? '-' : paidCount}</Text>
                    <Text style={styles.miniLabel}>Paid</Text>
                  </View>
                  <View style={[styles.mini, { backgroundColor: colors.accentSoft }]}>
                    <Text style={[styles.miniValue, { color: colors.warning }]}>{monthlyRevenueLoading ? '-' : partialCount}</Text>
                    <Text style={styles.miniLabel}>Partial</Text>
                  </View>
                  <View style={[styles.mini, { backgroundColor: colors.dangerSoft }]}>
                    <Text style={[styles.miniValue, { color: colors.danger }]}>{monthlyRevenueLoading ? '-' : dueCount}</Text>
                    <Text style={styles.miniLabel}>Due</Text>
                  </View>
                </View>
                <View style={styles.viewDetailsRow}>
                  <Text style={styles.viewDetailsText}>View month overview</Text>
                  <Icon name="chevron-right" size={18} color={colors.primary} />
                </View>
              </AppCard>
            </Pressable>

            {/* Occupancy */}
            <AppCard>
              <Text style={styles.cardTitle}>Bed Occupancy</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.muted}>{occupiedBeds} occupied</Text>
                <Text style={styles.muted}>{availableBeds} available</Text>
              </View>
              <View style={styles.barWrap}><Bar value={occupiedBeds} total={totalBeds} color={colors.info} /></View>
              <View style={styles.occGrid}>
                {[['Floors', totalFloors], ['Rooms', totalRooms], ['Beds', totalBeds]].map(([l, v]) => (
                  <View key={l} style={styles.occCell}>
                    <Text style={styles.occValue}>{v}</Text>
                    <Text style={styles.miniLabel}>{l}</Text>
                  </View>
                ))}
              </View>
            </AppCard>
          </>
        )}

        {/* Quick actions */}
        <AppCard>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <Action icon="account-plus" label="Add Tenant" color={colors.primary} onPress={() => navigation.navigate('AddCandidate')} />
            <Action icon="office-building" label="My Hostels" color={colors.info} onPress={() => navigation.navigate('Hostels')} />
            <Action icon="receipt" label="Rent" color={colors.accent} onPress={() => navigation.navigate('Rent')} />
            <Action icon="clipboard-account" label="Onboard" color={colors.violet} onPress={() => navigation.navigate('Onboarding')} />
            <Action icon="account-group" label="Candidates" color={colors.success} onPress={() => navigation.navigate('Candidates')} />
            <Action icon="history" label="Activity" color={colors.warning} onPress={() => navigation.navigate('ActivityLogs')} />
          </View>
        </AppCard>

        {/* Properties */}
        {hasData ? (
          <>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Properties</Text>
            </View>
            {overview.length === 0 ? (
              <AppCard><Text style={styles.muted}>No properties yet. Add a hostel from My Hostels.</Text></AppCard>
            ) : overview.map(b => {
              const occ = pct(b.occupiedBeds, b.totalBeds);
              const color = occ >= 80 ? colors.success : occ >= 50 ? colors.warning : colors.danger;
              return (
                <AppCard key={b.buildingId}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.bName} numberOfLines={1}>{b.buildingName}</Text>
                    <Text style={[styles.occPill, { color, backgroundColor: `${color}18` }]}>{occ}% full</Text>
                  </View>
                  {b.address ? <Text style={styles.muted} numberOfLines={1}>{b.address}</Text> : null}
                  <View style={styles.barWrap}><Bar value={b.occupiedBeds} total={b.totalBeds} color={color} /></View>
                  <View style={styles.bStats}>
                    <Text style={styles.bStat}>{b.totalFloors} floors</Text>
                    <Text style={styles.bStat}>{b.totalRooms} rooms</Text>
                    <Text style={styles.bStat}>{b.totalBeds} beds</Text>
                  </View>
                  <View style={styles.rowBetween}>
                    <View style={styles.tenantCount}>
                      <Icon name="account-outline" size={15} color={colors.muted} />
                      <Text style={styles.mutedNoMargin}>{b.totalTenants} tenants</Text>
                    </View>
                    <Text style={styles.bRevenue}>{money(b.totalRevenue)}/mo</Text>
                  </View>
                </AppCard>
              );
            })}
          </>
        ) : null}
        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, paddingBottom: 24 },
  hello: { color: colors.text, fontSize: 22, fontWeight: '900' },
  helloGif: { width: 26, height: 26 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  muted: { color: colors.muted, marginTop: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, marginBottom: 8 },
  kpi: {
    width: '48.2%', minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 10,
    shadowColor: '#111827', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  kpiIcon: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  kpiContent: { flex: 1, minWidth: 0, justifyContent: 'center', overflow: 'hidden' },
  kpiValue: { color: colors.text, fontSize: 20, fontWeight: '900', includeFontPadding: false },
  kpiAmount: { fontSize: 16 },
  kpiLabel: { color: colors.muted, fontSize: 10.5, fontWeight: '800', marginTop: 4, flexShrink: 1, lineHeight: 13 },
  kpiSub: { alignSelf: 'flex-start', color: colors.muted, fontSize: 9.5, fontWeight: '800', marginTop: 4 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  cardHint: { color: colors.muted, fontSize: 11, marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  tag: { color: colors.muted, fontSize: 11, backgroundColor: colors.faint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontWeight: '700' },
  monthFilter: { gap: 8, paddingTop: 12, paddingBottom: 2 },
  monthChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  monthChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  monthChipText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  monthChipTextActive: { color: colors.primary },
  revRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12 },
  revBig: { color: colors.text, fontSize: 26, fontWeight: '900' },
  revPct: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  barWrap: { marginTop: 10 },
  track: { height: 8, borderRadius: 6, backgroundColor: '#eef0f4', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  miniGrid: { flexDirection: 'row', gap: 8, marginTop: 14 },
  mini: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  miniValue: { fontSize: 18, fontWeight: '900' },
  miniLabel: { color: colors.muted, fontSize: 11, marginTop: 2, fontWeight: '700' },
  viewDetailsRow: { borderTopWidth: 1, borderTopColor: colors.faint, paddingTop: 12, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewDetailsText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  occGrid: { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: colors.faint, paddingTop: 14 },
  occCell: { flex: 1, alignItems: 'center' },
  occValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  action: { width: '30%', alignItems: 'center', gap: 6 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: colors.text, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  bName: { color: colors.text, fontSize: 16, fontWeight: '900', flex: 1, marginRight: 8 },
  occPill: { fontSize: 11, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  bStats: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 10 },
  bStat: { color: colors.primary, backgroundColor: colors.primarySoft, fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  bRevenue: { color: colors.success, fontWeight: '900' },
  tenantCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mutedNoMargin: { color: colors.muted },
  footerSpacer: { height: 90 },
  skeletonBlock: { backgroundColor: '#e4e8ef', borderRadius: 8 },
  skeletonCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 12 },
});
