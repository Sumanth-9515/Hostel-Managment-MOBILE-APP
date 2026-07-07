import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text } from 'react-native';
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
import { getMessage, money } from '../../utils/helpers';

const empty = { name: '', price: '', days: '', beds: '' };

export default function MasterPlansScreen({ onLogout }) {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const load = async () => {
    try {
      setPlans(await masterApi.allPlans());
    } catch (error) {
      Alert.alert('Plans error', getMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const save = async () => {
    setSaving(true);
    try {
      await masterApi.createPlan({ name: form.name, price: Number(form.price), days: Number(form.days), beds: Number(form.beds) });
      setForm(empty);
      load();
    } catch (error) {
      Alert.alert('Plan failed', getMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async id => {
    await masterApi.togglePlan(id);
    load();
  };

  if (loading) return <ScreenSkeleton header cards={3} />;

  return (
    <>
      <AppHeader title="Plans" subtitle="Subscription settings" onLogout={onLogout} />
      <ScreenWrapper scroll={false}>
        <FlatList
          data={plans}
          keyExtractor={item => item._id}
          ListHeaderComponent={(
            <AppCard>
              <Text style={styles.title}>New Plan</Text>
              <AppInput label="Name" value={form.name} onChangeText={v => set('name', v)} />
              <AppInput label="Price" value={form.price} onChangeText={v => set('price', v)} keyboardType="numeric" />
              <AppInput label="Days" value={form.days} onChangeText={v => set('days', v)} keyboardType="numeric" />
              <AppInput label="Beds" value={form.beds} onChangeText={v => set('beds', v)} keyboardType="numeric" />
              <AppButton title="Create Plan" icon="plus" loading={saving} onPress={save} />
            </AppCard>
          )}
          ListEmptyComponent={<EmptyState title="No plans found" />}
          renderItem={({ item }) => (
            <AppCard>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.muted}>{money(item.price)} / {item.days} days / {item.beds} beds</Text>
              <Text style={[styles.status, item.isActive === false && styles.off]}>{item.isActive === false ? 'Inactive' : 'Active'}</Text>
              <AppButton title="Toggle Active" icon="toggle-switch" variant="secondary" style={styles.button} onPress={() => toggle(item._id)} />
            </AppCard>
          )}
        />
      </ScreenWrapper>
    </>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 10 },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  muted: { color: colors.muted, marginTop: 6 },
  status: { color: colors.success, marginTop: 9, fontWeight: '900' },
  off: { color: colors.danger },
  button: { marginTop: 12 },
});
