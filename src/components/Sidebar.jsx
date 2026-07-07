import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../utils/constants';
import { navRef } from '../navigation/navRef';

const SidebarContext = createContext({ open: () => {}, close: () => {} });
export const useSidebar = () => useContext(SidebarContext);

const WIDTH = Math.min(304, Dimensions.get('window').width * 0.84);
const appIcon = require('../../assets/app-logo-new.png');

const ITEMS = [
  { label: 'Total Candidates', route: 'Candidates', icon: 'account-group', tint: colors.info },
  { label: 'Buildings Overview', route: 'Overview', icon: 'eye', tint: colors.violet },
  { label: 'Activity Logs', route: 'ActivityLogs', icon: 'history', tint: colors.accent },
  { label: 'My Profile', route: 'Profile', icon: 'account-circle', tint: colors.success },
];

export function SidebarProvider({ children, user, onLogout }) {
  const [visible, setVisible] = useState(false);
  const slide = useRef(new Animated.Value(-WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => {
    slide.stopAnimation();
    fade.stopAnimation();
    slide.setValue(-WIDTH);
    fade.setValue(0);
    setVisible(true);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, speed: 18, bounciness: 0, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    });
  }, [slide, fade]);

  const close = useCallback(() => {
    slide.stopAnimation();
    fade.stopAnimation();
    Animated.parallel([
      Animated.timing(slide, { toValue: -WIDTH, duration: 260, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [slide, fade]);

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close, visible]);

  const go = route => {
    close();
    setTimeout(() => navRef.navigate(route), 280);
  };

  const handleLogout = () => {
    close();
    setTimeout(() => onLogout && onLogout(), 280);
  };

  const name = user?.owner || user?.name || 'Owner';
  const initial = (name?.[0] || '?').toUpperCase();

  return (
    <SidebarContext.Provider value={{ open, close }}>
      {children}
      <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'box-none' : 'none'}>
          <Animated.View style={[styles.backdrop, { opacity: fade }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          </Animated.View>
          <Animated.View style={[styles.drawer, { width: WIDTH, transform: [{ translateX: slide }] }]}>
            <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left']}>
              {/* Brand */}
              <View style={styles.brand}>
                <Image source={appIcon} style={styles.logoImage} resizeMode="contain" />
                <View style={styles.flex}>
                  <Text style={styles.brandName}>NILAYAM</Text>
                  <Text style={styles.brandSub}>Hostel Manager</Text>
                </View>
                <Pressable onPress={close} style={styles.closeBtn}>
                  <Icon name="close" size={18} color={colors.muted} />
                </Pressable>
              </View>

              <Text style={styles.sectionLabel}>MENU</Text>
              <View style={styles.items}>
                {ITEMS.map(item => (
                  <Pressable key={item.route} style={styles.item} onPress={() => go(item.route)} android_ripple={{ color: colors.primarySoft }}>
                    <View style={[styles.itemIcon, { backgroundColor: `${item.tint}18` }]}>
                      <Icon name={item.icon} size={20} color={item.tint} />
                    </View>
                    <Text style={styles.itemText}>{item.label}</Text>
                    <Icon name="chevron-right" size={18} color={colors.border} />
                  </Pressable>
                ))}
              </View>

              <View style={styles.flex} />

              {/* Profile card */}
              <Pressable style={styles.profile} onPress={() => go('Profile')}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.profileName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.profileMail} numberOfLines={1}>{user?.email || 'Property Manager'}</Text>
                </View>
                <Icon name="account-edit" size={18} color={colors.muted} />
              </Pressable>

              <Pressable style={styles.logout} onPress={handleLogout}>
                <Icon name="logout" size={18} color={colors.danger} />
                <Text style={styles.logoutText}>Sign out</Text>
              </Pressable>
            </SafeAreaView>
          </Animated.View>
      </View>
    </SidebarContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)' },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.surface,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 6, height: 0 },
    elevation: 16,
  },
  safe: { flex: 1, paddingHorizontal: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  logoImage: { width: 42, height: 42 },
  brandName: { color: colors.text, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  brandSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 8, marginBottom: 6, marginLeft: 6 },
  items: { gap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 12 },
  itemIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: colors.faint, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  profileName: { color: colors.text, fontWeight: '800', fontSize: 13 },
  profileMail: { color: colors.muted, fontSize: 11, marginTop: 1 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', backgroundColor: colors.dangerSoft, marginBottom: 6 },
  logoutText: { color: colors.danger, fontWeight: '800' },
});
