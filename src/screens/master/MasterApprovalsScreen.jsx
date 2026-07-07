import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import EmptyState from '../../components/EmptyState';
import ScreenSkeleton from '../../components/Skeleton';
import ScreenWrapper from '../../components/ScreenWrapper';
import { masterApi } from '../../api/masterApi';
import { colors } from '../../utils/constants';
import { dateText, getMessage } from '../../utils/helpers';

export default function MasterApprovalsScreen({ onLogout }) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [plans, setPlans] = useState([]);

  const load = async () => {
    try {
      const [p, monitored] = await Promise.all([masterApi.pendingApprovals(), masterApi.usersPlan()]);
      setPending(p);
      setPlans(monitored);
    } catch (error) {
      Alert.alert('Approvals error', getMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const act = async (id, action) => {
    try {
      if (action === 'approve') await masterApi.approve(id);
      else await masterApi.reject(id);
      load();
    } catch (error) {
      Alert.alert('Action failed', getMessage(error));
    }
  };

  if (loading) return <ScreenSkeleton header rows={5} />;

  return (
    <>
      <AppHeader title="Approvals" subtitle={`${pending.length} pending`} onLogout={onLogout} />
      <ScreenWrapper scroll={false}>
        <FlatList
          data={pending}
          keyExtractor={item => item._id}
          ListHeaderComponent={<Text style={styles.heading}>Pending approvals</Text>}
          ListEmptyComponent={<EmptyState title="No pending approvals" />}
          renderItem={({ item }) => (
            <AppCard>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.muted}>{item.email} / {item.planName || item.extensionRequest?.planName || 'No plan'}</Text>
              <View style={styles.actions}>
                <AppButton title="Approve" icon="check" style={styles.action} onPress={() => act(item._id, 'approve')} />
                <AppButton title="Reject" icon="close" variant="danger" style={styles.action} onPress={() => act(item._id, 'reject')} />
              </View>
            </AppCard>
          )}
          ListFooterComponent={(
            <>
              <Text style={styles.heading}>Plan monitor</Text>
              {plans.map(item => (
                <AppCard key={item._id}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.muted}>{item.email}</Text>
                  <Text style={styles.plan}>Status {item.planStatus || 'none'} / Beds {item.planBeds ?? '-'}</Text>
                  <Text style={styles.muted}>Expires {dateText(item.planExpiresAt)}</Text>
                </AppCard>
              ))}
            </>
          )}
        />
      </ScreenWrapper>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 18, fontWeight: '900', marginVertical: 10 },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  muted: { color: colors.muted, marginTop: 6 },
  plan: { color: colors.primary, marginTop: 9, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  action: { flex: 1 },
});
