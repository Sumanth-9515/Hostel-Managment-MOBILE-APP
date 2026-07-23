import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../utils/constants';

const ToastContext = createContext({ showToast: () => {} });

const TOAST_TOP = 38;
const TOAST_WIDTH = Math.round(Dimensions.get('window').width * 0.9);

const tones = {
  success: { icon: 'check-circle', fg: colors.success, bg: colors.successSoft, border: '#86efac' },
  error: { icon: 'alert-circle', fg: colors.danger, bg: colors.dangerSoft, border: '#fca5a5' },
  info: { icon: 'information', fg: colors.info, bg: colors.infoSoft, border: '#93c5fd' },
  warning: { icon: 'alert', fg: colors.warning, bg: colors.accentSoft, border: '#fcd34d' },
};

function ToastItem({ item, onClose }) {
  const progress = useRef(new Animated.Value(0)).current;
  const tone = tones[item.type] || tones.info;

  React.useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-14, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.sideBar, { backgroundColor: tone.fg }]} />
      <Icon name={tone.icon} size={22} color={tone.fg} />
      <Text style={[styles.message, { color: tone.fg }]} numberOfLines={2}>
        {item.message}
      </Text>
      <Pressable style={styles.close} onPress={() => onClose(item.id)}>
        <Icon name="close" size={18} color={tone.fg} />
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef({});

  const removeToast = useCallback(id => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setItems(current => current.filter(item => item.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems(current => [...current, { id, message, type }]);
    timers.current[id] = setTimeout(() => removeToast(id), 2500);
  }, [removeToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.host}>
        {items.map(item => (
          <ToastItem key={item.id} item={item} onClose={removeToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: TOAST_TOP,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
    gap: 8,
  },
  toast: {
    width: TOAST_WIDTH,
    minHeight: 52,
    maxHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 10,
    shadowColor: '#111827',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  sideBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  close: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
