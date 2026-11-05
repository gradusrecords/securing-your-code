import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { SessionState } from '../auth/sessionState';
import { registerForPush } from './registerPush';

// Show notifications that arrive while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export function usePushRegistration(state: SessionState): void {
  const done = useRef(false);
  useEffect(() => {
    if (state.status === 'ready' && !done.current) {
      done.current = true;
      void registerForPush();
    }
    if (state.status === 'signedOut') done.current = false;
  }, [state.status]);
}
