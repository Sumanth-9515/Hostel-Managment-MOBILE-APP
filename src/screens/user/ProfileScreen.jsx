import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import AppInput from '../../components/AppInput';
import EmptyState from '../../components/EmptyState';
import ScreenWrapper from '../../components/ScreenWrapper';
import { authApi } from '../../api/authApi';
import { colors } from '../../utils/constants';
import { dateText, getMessage } from '../../utils/helpers';

const profileCache = {
  hasData: false,
  form: { name: '', owner: '', email: '', ph: '', address: '', password: '', planStatus: '', planExpiresAt: null, planBeds: null },
};

function ProfileDataSkeleton() {
  return (
    <View pointerEvents="none">
      <AppCard>
        <View style={[styles.skeletonBlock, { width: 80, height: 18, marginBottom: 16 }]} />
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{ marginBottom: 14 }}>
            <View style={[styles.skeletonBlock, { width: 90, height: 10, marginBottom: 6 }]} />
            <View style={[styles.skeletonBlock, { width: '100%', height: 42, borderRadius: 10 }]} />
          </View>
        ))}
      </AppCard>
    </View>
  );
}

export default function ProfileScreen({ navigation, onLogout, onUserUpdate }) {
  const [dataLoading, setDataLoading] = useState(!profileCache.hasData);
  const [dataError, setDataError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(profileCache.form);
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const hasLoadedRef = useRef(profileCache.hasData);
  const loadRequestRef = useRef(0);

  const load = useCallback(async (options = {}) => {
    const requestId = ++loadRequestRef.current;
    if (!options.background) {
      setDataLoading(true);
    }
    setDataError(null);
    try {
      const user = await authApi.profile();
      if (requestId !== loadRequestRef.current) return;
      const nextForm = {
        name: user.name || '',
        owner: user.owner || '',
        email: user.email || '',
        ph: user.ph || '',
        address: user.address || '',
        password: '',
        planStatus: user.planStatus,
        planExpiresAt: user.planExpiresAt,
        planBeds: user.planBeds
      };
      setForm(nextForm);
      profileCache.hasData = true;
      profileCache.form = nextForm;
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        setDataError(getMessage(error));
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setDataLoading(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load({ background: hasLoadedRef.current || profileCache.hasData })
      .then(() => { hasLoadedRef.current = true; });
  }, [load]));

  const save = async () => {
    setSaving(true);
    try {
      const body = { name: form.name, owner: form.owner, email: form.email, ph: form.ph, address: form.address };
      if (form.password) body.password = form.password;
      const data = await authApi.updateProfile(body);
      if (onUserUpdate) onUserUpdate(data.user);
      profileCache.form = { ...form, password: '' };
      Alert.alert('Saved', data.message || 'Profile updated.');
    } catch (error) {
      Alert.alert('Save failed', getMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const hasData = profileCache.hasData;
  const showSkeleton = dataLoading && !hasData;
  const showError = !!dataError && !dataLoading && !hasData;

  return (
    <>
      <AppHeader title="My Profile" subtitle="Account and plan" onBack={() => navigation.goBack()} onLogout={onLogout} showOnboardingNotifications />
      <ScreenWrapper>
        {showSkeleton ? (
          <ProfileDataSkeleton />
        ) : showError ? (
          <EmptyState title="Unable to load profile" message={dataError} icon="wifi-alert" />
        ) : (
          <>
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
          </>
        )}
      </ScreenWrapper>
    </>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 10 },
  muted: { color: colors.muted, marginTop: 6, fontWeight: '700' },
  skeletonBlock: { backgroundColor: '#e4e8ef', borderRadius: 8 },
});
