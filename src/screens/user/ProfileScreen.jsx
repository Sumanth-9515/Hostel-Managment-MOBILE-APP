import React, { useCallback, useState, useRef } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import AppInput from '../../components/AppInput';
import EmptyState from '../../components/EmptyState';
import ScreenWrapper from '../../components/ScreenWrapper';
import { authApi } from '../../api/authApi';
import { colors } from '../../utils/constants';
import { registerCacheReset } from '../../utils/cacheRegistry';
import { dateText, getMessage } from '../../utils/helpers';

const emptyProfileForm = { name: '', owner: '', email: '', ph: '', address: '', password: '', planStatus: '', planExpiresAt: null, planBeds: null };

const profileCache = {
  hasData: false,
  form: emptyProfileForm,
};

registerCacheReset(() => {
  profileCache.hasData = false;
  profileCache.form = emptyProfileForm;
});

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

function DetailRow({ icon, label, value }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Icon name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || '-'}</Text>
      </View>
    </View>
  );
}

function PlanStat({ label, value, accent }) {
  return (
    <View style={[styles.planStat, accent && styles.planStatAccent]}>
      <Text style={styles.planLabel}>{label}</Text>
      <Text style={[styles.planValue, accent && styles.planValueAccent]}>{value || '-'}</Text>
    </View>
  );
}

export default function ProfileScreen({ navigation, onLogout, onUserUpdate }) {
  const [dataLoading, setDataLoading] = useState(!profileCache.hasData);
  const [dataError, setDataError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
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
      setForm(prev => ({ ...prev, password: '' }));
      setEditing(false);
      Alert.alert('Saved', data.message || 'Profile updated.');
    } catch (error) {
      Alert.alert('Save failed', getMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setForm(profileCache.form);
    setEditing(false);
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
              <View style={styles.profileHeader}>
                <View style={styles.avatar}>
                  <Icon name="account-tie-outline" size={28} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.hostelName}>{form.name || 'Hostel Name'}</Text>
                  <Text style={styles.ownerName}>{form.owner || 'Owner'}</Text>
                  <Text style={styles.emailText}>{form.email || 'No email added'}</Text>
                </View>
              </View>
            </AppCard>

            {!editing ? (
              <>
                <AppCard>
                  <View style={styles.sectionHead}>
                    <Text style={styles.title}>Profile Details</Text>
                    <View style={styles.sectionBadge}>
                      <Icon name="shield-account-outline" size={14} color={colors.primary} />
                    </View>
                  </View>
                  <View style={styles.detailsList}>
                    <DetailRow icon="office-building-outline" label="Hostel Name" value={form.name} />
                    <DetailRow icon="account-outline" label="Owner" value={form.owner} />
                    <DetailRow icon="email-outline" label="Email" value={form.email} />
                    <DetailRow icon="phone-outline" label="Phone" value={form.ph} />
                    <DetailRow icon="map-marker-outline" label="Address" value={form.address} />
                  </View>
                  <AppButton title="Edit Profile" icon="pencil-outline" onPress={() => setEditing(true)} />
                </AppCard>
              </>
            ) : (
              <AppCard>
                <Text style={styles.title}>Edit Profile</Text>
                <AppInput label="Hostel Name" value={form.name} onChangeText={v => set('name', v)} />
                <AppInput label="Owner" value={form.owner} onChangeText={v => set('owner', v)} />
                <AppInput label="Email" value={form.email} onChangeText={v => set('email', v)} keyboardType="email-address" />
                <AppInput label="Phone" value={form.ph} onChangeText={v => set('ph', v)} keyboardType="phone-pad" />
                <AppInput label="Address" value={form.address} onChangeText={v => set('address', v)} multiline />
                <AppInput label="New Password" value={form.password} onChangeText={v => set('password', v)} secureTextEntry />
                <View style={styles.editActions}>
                  <AppButton title="Cancel" icon="close" variant="secondary" style={styles.flex} onPress={cancelEdit} />
                  <AppButton title="Save" icon="content-save" loading={saving} style={styles.flex} onPress={save} />
                </View>
              </AppCard>
            )}

            <AppCard>
              <View style={styles.sectionHead}>
                <Text style={styles.title}>Current Plan</Text>
                <Icon name="clipboard-check-outline" size={20} color={colors.violet} />
              </View>
              <View style={styles.planGrid}>
                <PlanStat label="Status" value={form.planStatus || 'none'} accent />
                <PlanStat label="Beds" value={form.planBeds ?? '-'} />
                <PlanStat label="Expiry" value={dateText(form.planExpiresAt)} />
              </View>
            </AppCard>
            <View style={styles.logoutWrap}>
              <AppButton title="Logout" icon="logout" variant="danger" onPress={onLogout} />
            </View>
          </>
        )}
      </ScreenWrapper>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '900' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 58, height: 58, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#dbe3ff' },
  hostelName: { color: colors.text, fontSize: 19, fontWeight: '900' },
  ownerName: { color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: 2 },
  emailText: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 3 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionBadge: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  detailsList: { gap: 8, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 12, backgroundColor: colors.faint, borderWidth: 1, borderColor: colors.border },
  detailIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  detailText: { flex: 1 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  editActions: { flexDirection: 'row', gap: 9, marginTop: 2 },
  planGrid: { flexDirection: 'row', gap: 8 },
  planStat: { flex: 1, minHeight: 62, borderRadius: 12, backgroundColor: colors.faint, borderWidth: 1, borderColor: colors.border, padding: 10, justifyContent: 'center' },
  planStatAccent: { backgroundColor: colors.violetSoft, borderColor: '#ddd6fe' },
  planLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  planValue: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 5 },
  planValueAccent: { color: colors.violet },
  logoutWrap: { marginTop: 2, marginBottom: 18 },
  skeletonBlock: { backgroundColor: '#e4e8ef', borderRadius: 8 },
});
