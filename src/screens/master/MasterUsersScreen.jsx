import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import AppInput from '../../components/AppInput';
import EmptyState from '../../components/EmptyState';
import ScreenSkeleton from '../../components/Skeleton';
import ScreenWrapper from '../../components/ScreenWrapper';
import { masterApi } from '../../api/masterApi';
import { colors } from '../../utils/constants';
import { getMessage } from '../../utils/helpers';

export default function MasterUsersScreen({ onLogout }) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');

  const load = async () => {
    try {
      setUsers(await masterApi.users());
    } catch (error) {
      Alert.alert('Users error', getMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const setStatus = async (user, status) => {
    try {
      await masterApi.loginStatus(user._id, status);
      load();
    } catch (error) {
      Alert.alert('Status failed', getMessage(error));
    }
  };

  const filtered = users.filter(u => `${u.name} ${u.owner} ${u.email}`.toLowerCase().includes(q.toLowerCase()));

  if (loading) return <ScreenSkeleton header rows={6} />;

  return (
    <>
      <AppHeader title="Master Users" subtitle={`${users.length} hostel owners`} onLogout={onLogout} />
      <ScreenWrapper scroll={false}>
        <AppCard><AppInput label="Search users" value={q} onChangeText={setQ} /></AppCard>
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          ListEmptyComponent={<EmptyState title="No users found" />}
          renderItem={({ item }) => (
            <AppCard>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.muted}>{item.owner} / {item.email}</Text>
              <Text style={styles.status}>Login: {item.loginStatus || 'active'} / Plan: {item.planStatus || 'none'}</Text>
              <View style={styles.actions}>
                <AppButton title="Activate" variant="secondary" style={styles.action} onPress={() => setStatus(item, 'active')} />
                <AppButton title="Block" variant="danger" style={styles.action} onPress={() => setStatus(item, 'blocked')} />
              </View>
            </AppCard>
          )}
        />
      </ScreenWrapper>
    </>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  muted: { color: colors.muted, marginTop: 5 },
  status: { color: colors.primary, marginTop: 10, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  action: { flex: 1 },
});
