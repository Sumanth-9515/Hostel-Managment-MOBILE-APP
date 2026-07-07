import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../utils/constants';
import { useOnboardingNotifications } from './OnboardingNotifications';

const appIcon = require('../../assets/app-logo-new.png');

export default function AppHeader({ title, subtitle, onMenu, onBack, onLogout, rightIcon, onRightPress, showOnboardingNotifications }) {
  const { unreadCount, open } = useOnboardingNotifications();
  const navigation = useNavigation();

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.iconBtn}>
            <Icon name="arrow-left" size={22} color={colors.text} />
          </Pressable>
        ) : onMenu ? (
          <Pressable onPress={onMenu} style={styles.iconBtn}>
            <Icon name="menu" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <Image source={appIcon} style={styles.headerLogo} resizeMode="contain" />
        )}

        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>{title || 'Nilayam'}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>

        {onRightPress ? (
          <Pressable onPress={onRightPress} style={styles.iconBtn}>
            <Icon name={rightIcon || 'plus'} size={22} color={colors.primary} />
          </Pressable>
        ) : null}
        {showOnboardingNotifications ? (
          <>
            <Pressable onPress={() => navigation.navigate('OwnerSearch')} style={styles.iconBtn}>
              <Icon name="magnify" size={22} color={colors.primary} />
            </Pressable>
            <Pressable onPress={open} style={styles.iconBtn}>
              <Icon name="bell-outline" size={21} color={colors.primary} />
              {unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </>
        ) : null}
        {onLogout ? (
          <Pressable onPress={onLogout} style={styles.iconBtn}>
            <Icon name="logout" size={20} color={colors.danger} />
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.surface,
  },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: { width: 34, height: 34 },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
});
