import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

const SUPPORT_CONTACTS = [
  { name: 'Sumanth', phone: '9515174064' },
  { name: 'Siddartha', phone: '9346178913' },
];

const SUPPORT_MESSAGE = 'Hello Nilayam support, I need help with the app.';

export function SidebarProvider({ children, user, onLogout }) {
  const [visible, setVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
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

  const openHelp = () => {
    close();
    setTimeout(() => setHelpOpen(true), 280);
  };

  const callSupport = phone => {
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const whatsappSupport = phone => {
    const digits = String(phone).replace(/\D/g, '');
    const whatsappNumber = digits.length === 10 ? `91${digits}` : digits;
    Linking.openURL(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`).catch(() => {});
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
              <View style={styles.profile}>
                <Pressable style={styles.profileMain} onPress={() => go('Profile')}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.profileName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.profileMail} numberOfLines={1}>{user?.email || 'Property Manager'}</Text>
                  </View>
                  <Icon name="account-edit" size={18} color={colors.muted} />
                </Pressable>
                <View style={styles.profileLinks}>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Open privacy policy"
                    style={styles.privacyLink}
                    onPress={() => go('PrivacyPolicy')}
                  >
                    <Icon name="shield-lock-outline" size={13} color={colors.primary} />
                    <Text style={styles.privacyText}>Privacy Policy</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open help and support"
                    style={styles.privacyLink}
                    onPress={openHelp}
                  >
                    <Icon name="headset" size={13} color={colors.primary} />
                    <Text style={styles.privacyText}>Help</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable style={styles.logout} onPress={handleLogout}>
                <Icon name="logout" size={18} color={colors.danger} />
                <Text style={styles.logoutText}>Sign out</Text>
              </Pressable>
            </SafeAreaView>
          </Animated.View>
      </View>
      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <View style={styles.helpBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setHelpOpen(false)} />
          <View style={styles.helpCard}>
            <View style={styles.helpHead}>
              <View style={styles.helpIcon}>
                <Icon name="headset" size={24} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.helpTitle}>Contact Support</Text>
                <Text style={styles.helpSub}>Need more help?</Text>
              </View>
              <Pressable style={styles.helpClose} onPress={() => setHelpOpen(false)} hitSlop={10}>
                <Icon name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>

            <Text style={styles.helpBody}>Our support team is here to assist you.</Text>

            {SUPPORT_CONTACTS.map(contact => (
              <View key={contact.phone} style={styles.contactRow}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactInitial}>{contact.name[0]}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                </View>
                <Pressable style={styles.roundAction} onPress={() => callSupport(contact.phone)}>
                  <Icon name="phone" size={18} color={colors.success} />
                </Pressable>
                <Pressable style={styles.roundAction} onPress={() => whatsappSupport(contact.phone)}>
                  <Icon name="whatsapp" size={18} color={colors.success} />
                </Pressable>
              </View>
            ))}

            <View style={styles.reportBox}>
              <Icon name="bug-outline" size={20} color={colors.warning} />
              <View style={styles.flex}>
                <Text style={styles.reportTitle}>Report a Problem</Text>
                <Text style={styles.reportText}>
                  Facing an issue? Report a technical problem or unexpected error to our support team.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  profile: { padding: 10, borderRadius: 12, backgroundColor: colors.faint, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  profileMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  profileName: { color: colors.text, fontWeight: '800', fontSize: 13 },
  profileMail: { color: colors.muted, fontSize: 11, marginTop: 1 },
  profileLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginTop: 8 },
  privacyLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3 },
  privacyText: { color: colors.primary, fontSize: 11, fontWeight: '900', textDecorationLine: 'underline' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', backgroundColor: colors.dangerSoft, marginBottom: 6 },
  logoutText: { color: colors.danger, fontWeight: '800' },
  helpBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.52)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  helpCard: { width: '100%', maxWidth: 380, borderRadius: 20, backgroundColor: colors.surface, padding: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 18 },
  helpHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  helpIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  helpTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  helpSub: { color: colors.muted, fontSize: 13, fontWeight: '800', marginTop: 1 },
  helpClose: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.faint },
  helpBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: colors.faint, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  contactAvatar: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSoft },
  contactInitial: { color: colors.success, fontSize: 15, fontWeight: '900' },
  contactName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  contactPhone: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 1 },
  roundAction: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  reportBox: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: '#fde68a', marginTop: 12 },
  reportTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  reportText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
});
