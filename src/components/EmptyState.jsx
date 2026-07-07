import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../utils/constants';

export default function EmptyState({ title = 'Nothing here yet', message, icon = 'database-off-outline' }) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={36} color={colors.muted} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 18,
  },
  title: {
    marginTop: 10,
    color: colors.text,
    fontWeight: '900',
    fontSize: 16,
  },
  message: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 20,
  },
});
