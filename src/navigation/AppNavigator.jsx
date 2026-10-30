import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Loading from '../components/Loading';
import { navRef, flushNavigation } from './navRef';
import { session } from '../storage/session';
import { authApi } from '../api/authApi';
import AuthNavigator from './AuthNavigator';
import UserNavigator from './UserNavigator';
import MasterNavigator from './MasterNavigator';
import { registerPushNotifications, unregisterPushNotifications } from '../notifications/pushNotifications';
import { clearUserCaches } from '../utils/cacheRegistry';
import { colors } from '../utils/constants';

function LogoutConfirmModal({ visible, loading, error, onCancel, onConfirm }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!loading) onCancel(); }}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} disabled={loading} onPress={onCancel} />
        <View style={styles.logoutCard}>
          <View style={styles.logoutIconWrap}>
            <Icon name="logout" size={28} color={colors.danger} />
          </View>
          <Text style={styles.logoutTitle}>Log out?</Text>
          <Text style={styles.logoutMessage}>
            You will be signed out of Nilayam on this device. You can log in again anytime.
          </Text>
          {error ? <Text style={styles.logoutError}>{error}</Text> : null}
          <View style={styles.logoutActions}>
            <Pressable style={[styles.logoutButton, styles.cancelButton, loading && styles.disabledButton]} disabled={loading} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.logoutButton, styles.confirmButton, loading && styles.disabledButton]} disabled={loading} onPress={onConfirm}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="logout" size={17} color="#fff" />}
              <Text style={styles.confirmText}>{loading ? 'Logging out...' : 'Log out'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const formatDate = value => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getDisplayName = details => (
  details?.owner ||
  details?.name ||
  details?.userInfo?.owner ||
  details?.userInfo?.name ||
  'User'
);

function AutoLogoutModal({ visible, type, details, countdown }) {
  const isBlocked = type === 'blocked';
  const userInfo = details?.userInfo || details || {};
  const planInfo = details?.planInfo || details || {};
  const title = isBlocked
    ? `Hi ${getDisplayName(userInfo)}, your login has been stopped`
    : `Hi ${getDisplayName(userInfo)}, your plan has expired`;
  const message = isBlocked
    ? 'Your login has been stopped by NILAYAM management. Please contact the support team for more information. You will be logged out in'
    : 'Your current NILAYAM plan session has been completed. We are logging you out in';
  const footer = isBlocked
    ? 'Access will remain unavailable until NILAYAM management restores your login.'
    : 'Please contact the NILAYAM management support team or upgrade your plan to continue using the portal.';
  const rows = isBlocked
    ? [
      ['Owner', userInfo.owner || userInfo.name],
      ['Email', userInfo.email],
      ['Phone', userInfo.ph || userInfo.phone],
      ['Address', userInfo.address],
    ]
    : [
      ['Plan Name', planInfo.planName || userInfo.planName],
      ['Activated At', formatDate(planInfo.planActivatedAt || userInfo.planActivatedAt)],
      ['Expired At', formatDate(planInfo.planExpiresAt || userInfo.planExpiresAt)],
      ['Email', userInfo.email || planInfo.email],
    ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { }}>
      <View style={styles.autoBackdrop}>
        <View style={styles.autoCard}>
          <View style={[styles.autoHeader, isBlocked ? styles.autoHeaderBlocked : styles.autoHeaderExpired]}>
            <View style={styles.autoAlertIcon}>
              <Icon name={isBlocked ? 'account-cancel-outline' : 'clock-alert-outline'} size={30} color="#fff" />
            </View>
            <View style={styles.autoHeaderText}>
              <Text style={styles.autoKicker}>{isBlocked ? 'Login access stopped' : 'Plan session completed'}</Text>
              <Text style={styles.autoTitle}>{title}</Text>
            </View>
          </View>

          <ScrollView style={styles.autoBody} contentContainerStyle={styles.autoBodyContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.autoMessage}>
              {message} <Text style={styles.autoCountdown}>{countdown} sec</Text>. {footer}
            </Text>

            <View style={styles.autoGrid}>
              {rows.map(([label, value]) => (
                <View key={label} style={styles.autoDetailCard}>
                  <Text style={styles.autoDetailLabel}>{label}</Text>
                  <Text style={styles.autoDetailValue} numberOfLines={label === 'Address' ? 3 : 1}>
                    {value || '-'}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.autoNotice, isBlocked ? styles.autoNoticeBlocked : styles.autoNoticeExpired]}>
              <Icon name="information-outline" size={18} color={isBlocked ? '#991b1b' : '#9a3412'} />
              <Text style={[styles.autoNoticeText, isBlocked ? styles.autoNoticeTextBlocked : styles.autoNoticeTextExpired]}>
                {isBlocked
                  ? 'You will be redirected to login automatically. This popup cannot be dismissed.'
                  : 'Your app session will end automatically when the countdown reaches zero.'}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function AppNavigator() {
  const [booting, setBooting] = useState(true);
  const [auth, setAuth] = useState({ token: null, user: null });
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [autoLogout, setAutoLogout] = useState(null);
  const [autoCountdown, setAutoCountdown] = useState(0);
  const autoLogoutRef = useRef(null);
  const authRef = useRef(auth);
  const checkingProfileRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    session.get().then(saved => {
      if (!mounted) return;
      setAuth(saved);
      setBooting(false);
    });
    const unsubscribe = session.subscribe(() => {
      setAuth({ token: null, user: null });
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (auth.token && auth.user?.role !== 'master') {
      registerPushNotifications(auth.user);
      // The user tabs just mounted — replay any push-tap navigation that was
      // waiting for login / the navigator to exist. Small delay lets the tab
      // navigator finish mounting before we navigate into it.
      const timer = setTimeout(flushNavigation, 350);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [auth.token, auth.user]);

  const actions = useMemo(() => ({
    onAuth: async ({ token, user }) => {
      clearUserCaches();
      await session.set(token, user);
      setAuth({ token, user });
    },
    onLogout: async () => {
      await unregisterPushNotifications();
      await session.clear();
      setAuth({ token: null, user: null });
    },
    refreshUser: async user => {
      const token = await session.getToken();
      await session.set(token, user);
      setAuth({ token, user });
    },
  }), []);

  useEffect(() => {
    autoLogoutRef.current = autoLogout;
  }, [autoLogout]);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  const finishAutoLogout = useCallback(async () => {
    await unregisterPushNotifications();
    await session.clear({ notify: true });
    setAuth({ token: null, user: null });
    setAutoLogout(null);
    setAutoCountdown(0);
    setLogoutVisible(false);
  }, []);

  const beginAutoLogout = useCallback((type, details) => {
    if (autoLogoutRef.current) return;
    setLogoutVisible(false);
    const seconds = type === 'blocked' ? 30 : 60;
    const next = { type, details: details || {} };
    autoLogoutRef.current = next;
    setAutoLogout(next);
    setAutoCountdown(seconds);
  }, []);

  const updateProfileSession = useCallback(async profile => {
    const currentAuth = authRef.current;
    if (!profile || !currentAuth.token || currentAuth.user?.role === 'master') return;
    const updatedUser = {
      ...(currentAuth.user || {}),
      id: profile._id || profile.id || currentAuth.user?.id,
      _id: profile._id || currentAuth.user?._id,
      name: profile.name ?? currentAuth.user?.name,
      owner: profile.owner ?? currentAuth.user?.owner,
      email: profile.email ?? currentAuth.user?.email,
      ph: profile.ph ?? currentAuth.user?.ph,
      phone: profile.phone ?? currentAuth.user?.phone,
      address: profile.address ?? currentAuth.user?.address,
      role: profile.role ?? currentAuth.user?.role,
      loginStatus: profile.loginStatus ?? currentAuth.user?.loginStatus,
      planStatus: profile.planStatus ?? currentAuth.user?.planStatus,
      planName: profile.planName ?? currentAuth.user?.planName,
      planActivatedAt: profile.planActivatedAt ?? currentAuth.user?.planActivatedAt,
      planExpiresAt: profile.planExpiresAt ?? currentAuth.user?.planExpiresAt,
      planRenewalAt: profile.planRenewalAt ?? currentAuth.user?.planRenewalAt,
      planBeds: profile.planBeds ?? profile.beds ?? currentAuth.user?.planBeds,
    };
    await session.set(currentAuth.token, updatedUser);
    setAuth({ token: currentAuth.token, user: updatedUser });
  }, []);

  const checkProfileStatus = useCallback(async () => {
    const currentAuth = authRef.current;
    if (!currentAuth.token || currentAuth.user?.role === 'master' || autoLogoutRef.current || checkingProfileRef.current) return;
    checkingProfileRef.current = true;
    try {
      const profile = await authApi.profile();
      await updateProfileSession(profile);
    } catch (error) {
      const status = error?.response?.status;
      const body = error?.response?.data || {};
      if (status === 403 && body?.planExpired) {
        beginAutoLogout('planExpired', body);
      } else if (status === 403 && body?.blocked) {
        beginAutoLogout('blocked', body);
      } else if (status === 401) {
        await finishAutoLogout();
      }
    } finally {
      checkingProfileRef.current = false;
    }
  }, [beginAutoLogout, finishAutoLogout, updateProfileSession]);

  useEffect(() => {
    if (!auth.token || auth.user?.role === 'master') return undefined;
    checkProfileStatus();
    const id = setInterval(checkProfileStatus, 30000);
    return () => clearInterval(id);
  }, [auth.token, auth.user?.role, checkProfileStatus]);

  useEffect(() => {
    if (!auth.token || auth.user?.role === 'master') return undefined;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') checkProfileStatus();
    });
    return () => subscription.remove();
  }, [auth.token, auth.user?.role, checkProfileStatus]);

  useEffect(() => {
    if (!autoLogout) return undefined;
    const id = setInterval(() => {
      setAutoCountdown(current => Math.max(current - 1, 0));
    }, 1000);
    return () => clearInterval(id);
  }, [autoLogout]);

  useEffect(() => {
    if (autoLogout && autoCountdown <= 0) {
      finishAutoLogout();
    }
  }, [autoLogout, autoCountdown, finishAutoLogout]);

  if (booting) return <Loading label="Opening Nilayam..." />;

  const confirmLogout = () => {
    setLogoutError('');
    setLogoutVisible(true);
  };

  const cancelLogout = () => {
    if (logoutLoading) return;
    setLogoutVisible(false);
    setLogoutError('');
  };

  const handleLogoutConfirm = async () => {
    setLogoutLoading(true);
    setLogoutError('');
    try {
      await actions.onLogout();
      setLogoutVisible(false);
    } catch {
      setLogoutError('Logout failed. Please try again.');
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <NavigationContainer ref={navRef} onReady={flushNavigation}>
      {!auth.token ? (
        <AuthNavigator onAuth={actions.onAuth} />
      ) : auth.user?.role === 'master' ? (
        <MasterNavigator onLogout={confirmLogout} />
      ) : (
        <UserNavigator onLogout={confirmLogout} onUserUpdate={actions.refreshUser} user={auth.user} />
      )}
      <LogoutConfirmModal
        visible={logoutVisible}
        loading={logoutLoading}
        error={logoutError}
        onCancel={cancelLogout}
        onConfirm={handleLogoutConfirm}
      />
      <AutoLogoutModal
        visible={!!autoLogout}
        type={autoLogout?.type}
        details={autoLogout?.details}
        countdown={autoCountdown}
      />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  autoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.66)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  autoCard: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '88%',
    borderRadius: 24,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 24,
  },
  autoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  autoHeaderExpired: {
    backgroundColor: '#dc2626',
  },
  autoHeaderBlocked: {
    backgroundColor: '#b91c1c',
  },
  autoAlertIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  autoKicker: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  autoTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
  },
  autoBody: {
    backgroundColor: '#fff',
  },
  autoBodyContent: {
    padding: 20,
  },
  autoMessage: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  autoCountdown: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '900',
  },
  autoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  autoDetailCard: {
    width: '48%',
    minHeight: 68,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  autoDetailLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  autoDetailValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  autoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
  },
  autoNoticeExpired: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  autoNoticeBlocked: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  autoNoticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '800',
  },
  autoNoticeTextExpired: {
    color: '#9a3412',
  },
  autoNoticeTextBlocked: {
    color: '#991b1b',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.54)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logoutCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  logoutIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoutTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  logoutMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  logoutError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
  },
  logoutActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  logoutButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  cancelButton: {
    backgroundColor: colors.faint,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmButton: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.72,
  },
  cancelText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  confirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});
