import React, { useEffect, useState } from 'react';
import { Image, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/utils/constants';

declare const process: { env?: { JEST_WORKER_ID?: string } };

const startImage = require('./assets/app-start-image.png');

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (process.env?.JEST_WORKER_ID) {
      setShowSplash(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} translucent={false} />
      {showSplash ? (
        <View style={styles.splash}>
          <Image source={startImage} style={styles.splashImage} resizeMode="contain" />
        </View>
      ) : (
        <AppNavigator />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  splashImage: {
    width: '92%',
    height: '88%',
    maxWidth: 520,
    maxHeight: 920,
  },
});
