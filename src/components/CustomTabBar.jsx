import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../utils/constants';

const META = {
  Dashboard: { icon: 'view-dashboard-outline', label: 'Dashboard' },
  Rent: { icon: 'currency-inr', label: 'Rent' },
  Onboarding: { icon: 'account-plus-outline', label: 'Onboard' },
  Hostels: { icon: 'office-building-outline', label: 'Hostels' },
  AutoMail: { icon: 'email-outline', label: 'AutoMail' },
};

export default function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  const renderTab = route => {
    const index = state.routes.findIndex(r => r.key === route.key);
    const focused = state.index === index;
    const meta = META[route.name] || { icon: 'circle', label: route.name };
    const center = route.name === 'Onboarding';
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };
    return (
      <Pressable key={route.key} style={[styles.tab, center && styles.centerTab]} onPress={onPress} android_ripple={{ color: colors.primarySoft, borderless: true }}>
        {center ? (
          <View style={[styles.centerHalo, focused && styles.centerHaloFocused]}>
            <View style={styles.centerButton}><Icon name="account-plus-outline" size={29} color="#fff" /></View>
          </View>
        ) : <Icon name={meta.icon} size={23} color={focused ? colors.primary : colors.muted} />}
        <Text style={[styles.label, { color: focused ? colors.primary : colors.muted }]} numberOfLines={1}>
          {meta.label}
        </Text>
        {!center && (focused ? <View style={styles.dot} /> : <View style={styles.dotHidden} />)}
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {state.routes.map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 70,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 70,
    paddingVertical: 7,
  },
  label: { fontSize: 10, fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 1 },
  dotHidden: { width: 5, height: 5, marginTop: 1 },
  centerTab: { transform: [{ translateY: -23 }], overflow: 'visible' },
  centerHalo: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  centerHaloFocused: { shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 10 },
  centerButton: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.surface },
});
