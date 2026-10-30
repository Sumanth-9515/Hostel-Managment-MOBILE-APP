import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getBuildNumber, getInstallerPackageName } from 'react-native-device-info';
import { useToast } from '../components/AppToast';
import { getFreshConnectivitySnapshot } from '../network/connectivity';
import { colors } from '../utils/constants';

const AppUpdateContext = createContext({
  checking: false,
  checkForUpdates: async () => {},
});

const RESUME_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const GOOGLE_PLAY_PACKAGE = 'com.android.vending';

let updaterInstance;
let updateConstants;

const getUpdater = () => {
  if (Platform.OS !== 'android') return null;
  if (!updaterInstance) {
    const updateModule = require('sp-react-native-in-app-updates');
    updaterInstance = new updateModule.default(false);
    updateConstants = updateModule;
  }
  return updaterInstance;
};

const compareVersionCodes = (storeVersion, currentVersion) => {
  const storeCode = Number(storeVersion);
  const currentCode = Number(currentVersion);
  if (storeCode === currentCode) return 0;
  return storeCode > currentCode ? 1 : -1;
};

export function AppUpdateProvider({ children }) {
  const { showToast } = useToast();
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [startingUpdate, setStartingUpdate] = useState(false);
  const checkingRef = useRef(false);
  const modalVisibleRef = useRef(false);
  const dismissedVersionRef = useRef(null);
  const availableVersionRef = useRef(null);
  const updateKindRef = useRef(null);
  const flowInProgressRef = useRef(false);
  const installRequestedRef = useRef(false);
  const lastCheckAtRef = useRef(0);

  useEffect(() => {
    modalVisibleRef.current = updateAvailable;
  }, [updateAvailable]);

  const startSupportedUpdate = useCallback(async ({ resumed = false } = {}) => {
    if (flowInProgressRef.current) return;

    flowInProgressRef.current = true;
    if (!resumed) setStartingUpdate(true);
    try {
      const updater = getUpdater();
      if (!updater) return;
      await updater.startUpdate({
        updateType: updateKindRef.current ?? updateConstants.IAUUpdateKind.FLEXIBLE,
      });
      setUpdateAvailable(false);
    } catch {
      if (!resumed) {
        showToast('Unable to start the update. Please try again.', 'error', {
          key: 'app-update-error',
        });
      }
    } finally {
      flowInProgressRef.current = false;
      if (!resumed) setStartingUpdate(false);
    }
  }, [showToast]);

  const checkForUpdates = useCallback(async ({ manual = true } = {}) => {
    if (Platform.OS !== 'android') {
      if (manual) showToast("You're using the latest version.", 'success', { key: 'app-update-status' });
      return;
    }
    if (checkingRef.current) return;

    checkingRef.current = true;
    setChecking(true);
    if (manual) {
      showToast('Checking Google Play for updates...', 'info', {
        key: 'app-update-status',
        duration: 0,
      });
    }
    try {
      const connectivity = await getFreshConnectivitySnapshot();
      if (!connectivity.isOnline) {
        if (manual) showToast('You are offline. Connect to the internet and try again.', 'warning', { key: 'app-update-status' });
        return;
      }

      const installerPackage = await getInstallerPackageName();
      if (installerPackage !== GOOGLE_PLAY_PACKAGE) {
        if (manual) {
          showToast('Update checks require NILAYAM installed from Google Play.', 'warning', {
            key: 'app-update-status',
            duration: 4500,
          });
        }
        return;
      }

      const updater = getUpdater();
      const result = await updater.checkNeedsUpdate({
        curVersion: String(getBuildNumber()),
        customVersionComparator: compareVersionCodes,
      });
      lastCheckAtRef.current = Date.now();

      const availability = result?.other?.updateAvailability;
      if (availability === updateConstants.IAUAvailabilityStatus.DEVELOPER_TRIGGERED) {
        updateKindRef.current = result?.other?.isFlexibleUpdateAllowed === false
          ? updateConstants.IAUUpdateKind.IMMEDIATE
          : updateConstants.IAUUpdateKind.FLEXIBLE;
        await startSupportedUpdate({ resumed: true });
        return;
      }

      if (
        result?.shouldUpdate &&
        (result?.other?.isFlexibleUpdateAllowed !== false || result?.other?.isImmediateUpdateAllowed)
      ) {
        updateKindRef.current = result?.other?.isFlexibleUpdateAllowed === false
          ? updateConstants.IAUUpdateKind.IMMEDIATE
          : updateConstants.IAUUpdateKind.FLEXIBLE;
        const storeVersion = String(result.storeVersion || result.other?.versionCode || 'available');
        availableVersionRef.current = storeVersion;
        if (manual || dismissedVersionRef.current !== storeVersion) {
          if (manual) {
            showToast('Update found.', 'info', {
              key: 'app-update-status',
              duration: 800,
            });
          }
          if (!modalVisibleRef.current) setUpdateAvailable(true);
        }
        return;
      }

      if (manual) {
        showToast("You're using the latest version.", 'success', { key: 'app-update-status' });
      }
    } catch (error) {
      if (manual) {
        const errorMessage = String(error?.message || error || '');
        const isUnrecognizedPlayInstall = /APP_NOT_OWNED|error code: -10|\[-10\]|certificate/i.test(errorMessage);
        showToast(isUnrecognizedPlayInstall
          ? 'Google Play does not recognize this installation. Reinstall NILAYAM from its Play Store testing or production listing.'
          : 'Could not check for updates. Please try again later.', isUnrecognizedPlayInstall ? 'warning' : 'error', {
          key: 'app-update-status',
          duration: isUnrecognizedPlayInstall ? 5500 : 2500,
        });
      }
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, [showToast, startSupportedUpdate]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    let updater;
    try {
      updater = getUpdater();
    } catch {
      return undefined;
    }
    const handleStatus = event => {
      if (
        event?.status === updateConstants.IAUInstallStatus.DOWNLOADED &&
        !installRequestedRef.current
      ) {
        installRequestedRef.current = true;
        updater.installUpdate();
      }
    };

    updater.addStatusUpdateListener(handleStatus);
    const launchCheck = setTimeout(() => checkForUpdates({ manual: false }), 0);
    const subscription = AppState.addEventListener('change', nextState => {
      if (
        nextState === 'active' &&
        Date.now() - lastCheckAtRef.current >= RESUME_CHECK_INTERVAL_MS
      ) {
        checkForUpdates({ manual: false });
      }
    });

    return () => {
      clearTimeout(launchCheck);
      subscription.remove();
      updater.removeStatusUpdateListener(handleStatus);
    };
  }, [checkForUpdates]);

  const dismissUpdate = () => {
    if (startingUpdate) return;
    dismissedVersionRef.current = availableVersionRef.current;
    setUpdateAvailable(false);
  };

  const value = useMemo(() => ({ checking, checkForUpdates }), [checking, checkForUpdates]);

  return (
    <AppUpdateContext.Provider value={value}>
      {children}
      <Modal
        visible={updateAvailable}
        transparent
        animationType="fade"
        onRequestClose={dismissUpdate}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} disabled={startingUpdate} onPress={dismissUpdate} />
          <View style={styles.card}>
            <View style={styles.iconRing}>
              <View style={styles.iconCenter}>
                <Icon name="cloud-download-outline" size={34} color="#2563eb" />
              </View>
            </View>
            <Text style={styles.title}>Update Available</Text>
            <Text style={styles.message}>
              A newer version of NILAYAM is ready with the latest improvements and fixes.
            </Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                style={[styles.button, styles.laterButton, startingUpdate && styles.disabled]}
                disabled={startingUpdate}
                onPress={dismissUpdate}
              >
                <Text style={styles.laterText}>Later</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.button, styles.updateButton, startingUpdate && styles.disabled]}
                disabled={startingUpdate}
                onPress={() => startSupportedUpdate()}
              >
                {startingUpdate ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon name="download" size={18} color="#fff" />
                )}
                <Text style={styles.updateText}>{startingUpdate ? 'Starting...' : 'Update Now'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppUpdateContext.Provider>
  );
}

export const useAppUpdates = () => useContext(AppUpdateContext);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(15,23,42,0.58)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,
    borderRadius: 24,
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.24,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 20,
  },
  iconRing: {
    width: 78,
    height: 78,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    marginBottom: 18,
    transform: [{ rotate: '-4deg' }],
  },
  iconCenter: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    transform: [{ rotate: '4deg' }],
  },
  title: {
    color: '#0f172a',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  laterButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe3ee',
  },
  updateButton: {
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  laterText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '900',
  },
  updateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  disabled: { opacity: 0.65 },
});
