import { useEffect, useRef } from 'react';
import {
  configureNetworkNotifier,
  NETWORK_MESSAGES,
  notifyNetworkIssue,
  notifyNetworkRestored,
} from './networkFeedback';
import {
  initializeConnectivity,
  subscribeConnectivity,
} from './connectivity';
import { useToast } from '../components/AppToast';

export default function NetworkStatusMonitor() {
  const { showToast } = useToast();
  const wasOffline = useRef(false);
  const wasSlow = useRef(false);

  useEffect(() => {
    configureNetworkNotifier(showToast);
    initializeConnectivity();

    const unsubscribe = subscribeConnectivity(state => {
      if (!state.isOnline) {
        if (!wasOffline.current) {
          notifyNetworkIssue(NETWORK_MESSAGES.offline, 'warning', {
            status: 'offline',
            force: true,
          });
        }
        wasOffline.current = true;
        wasSlow.current = false;
        return;
      }

      if (wasOffline.current) {
        wasOffline.current = false;
        wasSlow.current = false;
        notifyNetworkRestored();
        return;
      }

      if (state.isSlow) {
        if (!wasSlow.current) {
          wasSlow.current = true;
          notifyNetworkIssue(NETWORK_MESSAGES.slow, 'warning', {
            status: 'slow',
            force: true,
          });
        }
        return;
      }

      if (wasSlow.current) {
        wasSlow.current = false;
        notifyNetworkRestored();
      }
    });

    return () => {
      unsubscribe();
      configureNetworkNotifier(null);
    };
  }, [showToast]);

  return null;
}
