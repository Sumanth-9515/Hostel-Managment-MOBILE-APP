import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import ScreenSkeleton from '../../components/Skeleton';
import ScreenWrapper from '../../components/ScreenWrapper';
import { masterApi } from '../../api/masterApi';
import { colors } from '../../utils/constants';
import { getMessage, money } from '../../utils/helpers';

function Tile({ label, value }) {
  return (
    <AppCard style={styles.tile}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </AppCard>
  );
}

export default function MasterDashboardScreen({ onLogout }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

  useFocusEffect(useCallback(() => {
    masterApi.stats()
      .then(setStats)
      .catch(error => Alert.alert('Master dashboard', getMessage(error)))
      .finally(() => setLoading(false));
  }, []));

  if (loading) return <ScreenSkeleton header stats={4} cards={2} />;

  return (
    <>
      <AppHeader title="Master Dashboard" subtitle="Platform overview" onLogout={onLogout} />
      <ScreenWrapper>
        <View style={styles.grid}>
          <Tile label="Users" value={stats.totalUsers ?? stats.users ?? 0} />
          <Tile label="Active" value={stats.activeUsers ?? 0} />
          <Tile label="Pending" value={stats.pendingUsers ?? 0} />
          <Tile label="Revenue" value={money(stats.totalRevenue || 0)} />
        </View>
        <AppCard>
          <Text style={styles.title}>System Health</Text>
          <Text style={styles.muted}>Registered hostels, plans and approvals are loaded directly from the backend master APIs.</Text>
        </AppCard>
      </ScreenWrapper>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', minHeight: 110 },
  value: { color: colors.primary, fontSize: 24, fontWeight: '900' },
  label: { color: colors.muted, marginTop: 8, fontWeight: '800' },
  title: { color: colors.text, fontSize: 18, fontWeight: '900' },
  muted: { color: colors.muted, marginTop: 8, lineHeight: 20 },
});
