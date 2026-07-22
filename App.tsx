import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/utils/constants';

declare const process: { env?: { JEST_WORKER_ID?: string } };

const startVideo = require('./assets/Nilyam-appstart-video.mp4');
const splashBackground = '#f8f9f8';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const splashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishSplash = () => {
    if (splashTimerRef.current) clearTimeout(splashTimerRef.current);
    setShowSplash(false);
  };

  useEffect(() => {
    if (process.env?.JEST_WORKER_ID) {
      setShowSplash(false);
      return undefined;
    }
    splashTimerRef.current = setTimeout(finishSplash, 60000);
    return () => {
      if (splashTimerRef.current) clearTimeout(splashTimerRef.current);
    };
  }, []);

  const handleVideoLoad = ({ duration }: { duration?: number }) => {
    if (!duration) return;
    if (splashTimerRef.current) clearTimeout(splashTimerRef.current);
    splashTimerRef.current = setTimeout(finishSplash, (duration * 1000) + 1000);
  };

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={showSplash ? 'transparent' : colors.surface}
        translucent={showSplash}
      />
      {showSplash ? (
        <View style={styles.splash}>
          <Video
            source={startVideo}
            style={styles.splashVideo}
            resizeMode="cover"
            muted
            paused={false}
            rate={1}
            volume={0}
            repeat={false}
            controls={false}
            progressUpdateInterval={100}
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="ignore"
            shutterColor="#FFFFFF"
            viewType={0}
            onLoad={handleVideoLoad}
            onEnd={finishSplash}
            onError={finishSplash}
          />
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
    backgroundColor: splashBackground,
  },
  splashVideo: {
    width: '100%',
    height: '100%',
  },
});
