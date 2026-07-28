import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Loading from '../components/Loading';
import { navRef, flushNavigation } from './navRef';
import { session } from '../storage/session';
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

export default function AppNavigator() {
  const [booting, setBooting] = useState(true);
  const [auth, setAuth] = useState({ token: null, user: null });
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState('');

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
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
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
