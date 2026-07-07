import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import AppInput from '../../components/AppInput';
import ScreenSkeleton from '../../components/Skeleton';
import ScreenWrapper from '../../components/ScreenWrapper';
import { authApi } from '../../api/authApi';
import { colors } from '../../utils/constants';
import { dateText, getMessage } from '../../utils/helpers';

export default function ProfileScreen({ navigation, onLogout, onUserUpdate }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', owner: '', email: '', ph: '', address: '', password: '' });
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    authApi.profile()
      .then(user => setForm({ name: user.name || '', owner: user.owner || '', email: user.email || '', ph: user.ph || '', address: user.address || '', password: '', planStatus: user.planStatus, planExpiresAt: user.planExpiresAt, planBeds: user.planBeds }))
      .catch(error => Alert.alert('Profile error', getMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const body = { name: form.name, owner: form.owner, email: form.email, ph: form.ph, address: form.address };
      if (form.password) body.password = form.password;
      const data = await authApi.updateProfile(body);
      if (onUserUpdate) onUserUpdate(data.user);
      Alert.alert('Saved', data.message || 'Profile updated.');
    } catch (error) {
      Alert.alert('Save failed', getMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ScreenSkeleton header cards={2} cardHeight={200} />;

  return (
    <>
      <AppHeader title="My Profile" subtitle="Account and plan" onBack={() => navigation.goBack()} onLogout={onLogout} showOnboardingNotifications />
      <ScreenWrapper>
        <AppCard>
          <Text style={styles.title}>Account</Text>
          <AppInput label="Hostel Name" value={form.name} onChangeText={v => set('name', v)} />
          <AppInput label="Owner" value={form.owner} onChangeText={v => set('owner', v)} />
          <AppInput label="Email" value={form.email} onChangeText={v => set('email', v)} keyboardType="email-address" />
          <AppInput label="Phone" value={form.ph} onChangeText={v => set('ph', v)} keyboardType="phone-pad" />
          <AppInput label="Address" value={form.address} onChangeText={v => set('address', v)} multiline />
          <AppInput label="New Password" value={form.password} onChangeText={v => set('password', v)} secureTextEntry />
          <AppButton title="Save Profile" icon="content-save" loading={saving} onPress={save} />
        </AppCard>
        <AppCard>
          <Text style={styles.title}>Plan</Text>
          <Text style={styles.muted}>Status: {form.planStatus || 'none'}</Text>
          <Text style={styles.muted}>Beds: {form.planBeds ?? '-'}</Text>
          <Text style={styles.muted}>Expires: {dateText(form.planExpiresAt)}</Text>
        </AppCard>
        <AppButton title="Logout" icon="logout" variant="danger" onPress={onLogout} />
      </ScreenWrapper>
    </>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 10 },
  muted: { color: colors.muted, marginTop: 6, fontWeight: '700' },
});
