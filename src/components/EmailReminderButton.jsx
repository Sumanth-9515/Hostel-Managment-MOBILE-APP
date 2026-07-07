import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { rentApi } from '../api/rentApi';
import { colors } from '../utils/constants';

// Inline email-reminder button. No alerts:
//  idle -> sending (spinner) -> sent (✓ for 4s) -> idle, or error (for 4s).
// `compact` renders a 42x42 icon button (rent cards); otherwise a labelled pill.
export default function EmailReminderButton({
  tenantId,
  compact = false,
  hasPreviousPending = false,
  advanceOnly = false,
  style,
}) {
  const [state, setState] = useState('idle');
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const send = event => {
    event?.stopPropagation?.();
    if (state === 'sending' || state === 'sent' || !tenantId) return;
    setState('sending');
    rentApi
      .sendReminder(tenantId)
      .then(() => {
        setState('sent');
        timerRef.current = setTimeout(() => setState('idle'), 4000);
      })
      .catch(() => {
        setState('error');
        timerRef.current = setTimeout(() => setState('idle'), 4000);
      });
  };

  const tone = advanceOnly || !hasPreviousPending
    ? { fg: colors.violet, bg: colors.violetSoft }
    : { fg: colors.danger, bg: colors.dangerSoft };

  if (compact) {
    const bg = state === 'sent' ? colors.successSoft : state === 'error' ? colors.dangerSoft : tone.bg;
    return (
      <Pressable
        onPress={send}
        disabled={state === 'sending' || state === 'sent'}
        style={[styles.iconBtn, { backgroundColor: bg }, style]}>
        {state === 'sending' ? (
          <ActivityIndicator size="small" color={colors.violet} />
        ) : state === 'sent' ? (
          <Icon name="check-circle" size={18} color={colors.success} />
        ) : state === 'error' ? (
          <Icon name="alert-circle-outline" size={18} color={colors.danger} />
        ) : (
          <Icon name="email-fast" size={18} color={tone.fg} />
        )}
      </Pressable>
    );
  }

  const labelTone = state === 'sent'
    ? { fg: colors.success, bg: colors.successSoft }
    : state === 'error'
    ? { fg: colors.danger, bg: colors.dangerSoft }
    : tone;

  const label = state === 'sending' ? 'Sending…'
    : state === 'sent' ? 'Sent'
    : state === 'error' ? 'Retry'
    : advanceOnly ? 'Adv'
    : hasPreviousPending ? 'Warn'
    : 'Email';

  return (
    <Pressable
      onPress={send}
      disabled={state === 'sending' || state === 'sent'}
      style={[styles.pill, { backgroundColor: labelTone.bg }, style]}>
      <View style={styles.pillRow}>
        {state === 'sending' ? (
          <ActivityIndicator size="small" color={labelTone.fg} />
        ) : (
          <Icon
            name={state === 'sent' ? 'check-circle' : state === 'error' ? 'alert-circle-outline' : 'email-fast'}
            size={15}
            color={labelTone.fg}
          />
        )}
        <Text style={[styles.pillText, { color: labelTone.fg }]} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillText: { fontSize: 12, fontWeight: '800' },
});
