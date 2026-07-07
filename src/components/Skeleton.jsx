import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/constants';

const BLOCK = '#e4e8ef';

// One shared shimmer driver per skeleton screen (native-driven opacity pulse —
// cheap, so the placeholder never feels heavy).
function useShimmer() {
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

function Bar({ opacity, w = '100%', h = 13, r = 7, style }) {
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: BLOCK, opacity }, style]} />;
}

function StatBox({ opacity }) {
  return (
    <View style={styles.statBox}>
      <Bar opacity={opacity} w="60%" h={10} />
      <Bar opacity={opacity} w="45%" h={20} style={styles.mt10} />
    </View>
  );
}

function CardBlock({ opacity, height }) {
  return (
    <View style={[styles.card, { minHeight: height }]}>
      <View style={styles.rowGap}>
        <Bar opacity={opacity} w={44} h={44} r={22} />
        <View style={styles.flexGap}>
          <Bar opacity={opacity} w="55%" h={14} />
          <Bar opacity={opacity} w="35%" h={11} style={styles.mt8} />
        </View>
        <Bar opacity={opacity} w={56} h={20} r={8} />
      </View>
      <Bar opacity={opacity} w="40%" h={11} style={styles.mt14} />
      <View style={[styles.rowBetween, styles.mt14]}>
        <Bar opacity={opacity} w="38%" h={22} />
        <Bar opacity={opacity} w="22%" h={14} />
      </View>
    </View>
  );
}

function RowItem({ opacity }) {
  return (
    <View style={styles.listRow}>
      <Bar opacity={opacity} w={40} h={40} r={12} />
      <View style={styles.flexGap}>
        <Bar opacity={opacity} w="50%" h={13} />
        <Bar opacity={opacity} w="70%" h={10} style={styles.mt8} />
      </View>
      <Bar opacity={opacity} w={18} h={18} r={9} />
    </View>
  );
}

// Configurable full-screen skeleton. Pass the closest shape for each screen:
//   header  – render a top app-bar placeholder (default true)
//   stats   – number of stat boxes (2-col grid)
//   cards   – number of large card placeholders
//   rows    – number of compact list-row placeholders
export default function ScreenSkeleton({ header = true, stats = 0, cards = 0, rows = 0, cardHeight = 120 }) {
  const opacity = useShimmer();
  return (
    <View style={styles.screen}>
      {header ? (
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <Bar opacity={opacity} w={40} h={40} r={11} />
            <View style={styles.flexGap}>
              <Bar opacity={opacity} w="50%" h={15} />
              <Bar opacity={opacity} w="32%" h={10} style={styles.mt8} />
            </View>
            <Bar opacity={opacity} w={40} h={40} r={11} />
          </View>
        </SafeAreaView>
      ) : null}

      <View style={styles.body}>
        {stats > 0 ? (
          <View style={styles.statGrid}>
            {Array.from({ length: stats }).map((_, i) => <StatBox key={`s${i}`} opacity={opacity} />)}
          </View>
        ) : null}

        {Array.from({ length: cards }).map((_, i) => <CardBlock key={`c${i}`} opacity={opacity} height={cardHeight} />)}

        {rows > 0 ? (
          <View style={styles.list}>
            {Array.from({ length: rows }).map((_, i) => <RowItem key={`r${i}`} opacity={opacity} />)}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Compact, header-less skeleton for content inside modals (detail sheets).
export function DetailSkeleton() {
  const opacity = useShimmer();
  return (
    <View style={styles.detail}>
      <View style={styles.rowGap}>
        <Bar opacity={opacity} w={56} h={56} r={16} />
        <View style={styles.flexGap}>
          <Bar opacity={opacity} w="60%" h={16} />
          <Bar opacity={opacity} w="40%" h={11} style={styles.mt8} />
        </View>
      </View>
      <Bar opacity={opacity} w="100%" h={56} r={14} style={styles.mt16} />
      <View style={[styles.rowGap, styles.mt14]}>
        <Bar opacity={opacity} w="48%" h={64} r={12} />
        <Bar opacity={opacity} w="48%" h={64} r={12} />
      </View>
      <Bar opacity={opacity} w="45%" h={13} style={styles.mt16} />
      <Bar opacity={opacity} w="100%" h={48} r={12} style={styles.mt10} />
      <Bar opacity={opacity} w="100%" h={48} r={12} style={styles.mt10} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerSafe: { backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  body: { padding: 16 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statBox: { width: '47%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 12 },
  list: { gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12 },
  detail: { padding: 16 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flexGap: { flex: 1 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
});
