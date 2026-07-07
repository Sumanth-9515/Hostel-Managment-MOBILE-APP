import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import Loading from '../components/Loading';
import { navRef, flushNavigation } from './navRef';
import { session } from '../storage/session';
import AuthNavigator from './AuthNavigator';
import UserNavigator from './UserNavigator';
import MasterNavigator from './MasterNavigator';
import { registerPushNotifications, unregisterPushNotifications } from '../notifications/pushNotifications';

export default function AppNavigator() {
  const [booting, setBooting] = useState(true);
  const [auth, setAuth] = useState({ token: null, user: null });

  useEffect(() => {
    session.get().then(saved => {
      setAuth(saved);
      setBooting(false);
    });
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
    Alert.alert('Log out?', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: actions.onLogout },
    ]);
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
    </NavigationContainer>
  );
}
