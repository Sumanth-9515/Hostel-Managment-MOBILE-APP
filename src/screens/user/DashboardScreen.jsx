import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import ScreenSkeleton from '../../components/Skeleton';
import { useSidebar } from '../../components/Sidebar';
import { authApi } from '../../api/authApi';
import { buildingApi } from '../../api/buildingApi';
import { rentApi } from '../../api/rentApi';
import { colors } from '../../utils/constants';
import { getMessage, money } from '../../utils/helpers';

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

function Bar({ value, total, color = colors.primary }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(100, pct(value, total))}%`, backgroundColor: color }]} />
    </View>
  );
}

function Kpi({ icon, label, value, sub, color }) {
  return (
    <View style={[styles.kpi, { borderTopColor: color }]}>
      <View style={[styles.kpiIcon, { backgroundColor: `${color}18` }]}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
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

export default function DashboardScreen({ navigation, onLogout, user }) {
  const { open } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(user);
  const [overview, setOverview] = useState([]);
  const [rent, setRent] = useState([]);

  const load = useCallback(async () => {
    try {
      const [p, ov, rentAll] = await Promise.all([
        authApi.profile().catch(() => user),
        buildingApi.overview().catch(() => []),
        rentApi.all().catch(() => []),
      ]);
      setProfile(p);
      setOverview(Array.isArray(ov) ? ov : []);
      setRent(Array.isArray(rentAll) ? rentAll : []);
    } catch (error) {
      Alert.alert('Dashboard error', getMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ScreenSkeleton header stats={6} cards={2} />;

  const totalBeds = overview.reduce((s, b) => s + (b.totalBeds || 0), 0);
  const occupiedBeds = overview.reduce((s, b) => s + (b.occupiedBeds || 0), 0);
  const availableBeds = totalBeds - occupiedBeds;
  const totalFloors = overview.reduce((s, b) => s + (b.totalFloors || 0), 0);
  const totalRooms = overview.reduce((s, b) => s + (b.totalRooms || 0), 0);
  const totalTenants = overview.reduce((s, b) => s + (b.totalTenants || 0), 0);

  const totalRevenue = rent.reduce((s, t) => s + (t.record?.rentAmount || 0), 0);
  const collected = rent.reduce((s, t) => s + (t.record?.paidAmount || 0), 0);
  const pending = rent.reduce((s, t) => s + (t.remaining || 0), 0);
  const paidCount = rent.filter(t => t.record?.status === 'Paid').length;
  const partialCount = rent.filter(t => t.record?.status === 'Partial').length;
  const dueCount = rent.filter(t => t.record?.status === 'Due').length;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const ownerName = profile?.owner || profile?.name || 'Owner';

  return (
    <View style={styles.screen}>
      <AppHeader title="Dashboard" subtitle="Hostel snapshot" onMenu={open} onLogout={onLogout} showOnboardingNotifications />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

        <View style={styles.greetingRow}>
          <Text style={styles.hello}>{greet}, {ownerName}</Text>
          <Icon name="hand-wave-outline" size={22} color={colors.accent} />
        </View>
        <Text style={styles.muted}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>

        {/* KPI strip */}
        <View style={styles.kpiGrid}>
          <Kpi icon="bed" label="Total Beds" value={totalBeds} sub={`${availableBeds} available`} color={colors.info} />
          <Kpi icon="account-group" label="Tenants" value={totalTenants} color={colors.violet} />
          <Kpi icon="cash-check" label="Collected" value={money(collected)} sub={`${pct(collected, totalRevenue)}% of target`} color={colors.success} />
          <Kpi icon="cash-minus" label="Pending" value={money(pending)} sub="Outstanding" color={colors.danger} />
        </View>

        {/* Monthly revenue */}
        <AppCard>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Monthly Revenue</Text>
            <Text style={styles.tag}>{new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</Text>
          </View>
          <View style={styles.revRow}>
            <Text style={styles.revBig}>{money(collected)}</Text>
            <Text style={styles.revPct}>{pct(collected, totalRevenue)}%</Text>
          </View>
          <Text style={styles.muted}>of {money(totalRevenue)} expected</Text>
          <View style={styles.barWrap}><Bar value={collected} total={totalRevenue} color={colors.primary} /></View>
          <View style={styles.miniGrid}>
            <View style={[styles.mini, { backgroundColor: colors.successSoft }]}>
              <Text style={[styles.miniValue, { color: colors.success }]}>{paidCount}</Text>
              <Text style={styles.miniLabel}>Paid</Text>
            </View>
            <View style={[styles.mini, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.miniValue, { color: colors.warning }]}>{partialCount}</Text>
              <Text style={styles.miniLabel}>Partial</Text>
            </View>
            <View style={[styles.mini, { backgroundColor: colors.dangerSoft }]}>
              <Text style={[styles.miniValue, { color: colors.danger }]}>{dueCount}</Text>
              <Text style={styles.miniLabel}>Due</Text>
            </View>
          </View>
        </AppCard>

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
        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, paddingBottom: 24 },
  hello: { color: colors.text, fontSize: 22, fontWeight: '900' },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  muted: { color: colors.muted, marginTop: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18, marginBottom: 8 },
  kpi: { width: '48%', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, borderTopWidth: 3, padding: 14, minHeight: 116 },
  kpiIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  kpiLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  kpiSub: { color: colors.muted, fontSize: 10, marginTop: 2 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  tag: { color: colors.muted, fontSize: 11, backgroundColor: colors.faint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontWeight: '700' },
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
});
