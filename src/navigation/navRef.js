import { createNavigationContainerRef } from '@react-navigation/native';

export const navRef = createNavigationContainerRef();

// A navigation requested from a push-notification tap can arrive before the
// navigation tree is mounted (cold start / still behind the splash) or before
// the user is logged in (so the target tab does not exist yet). We remember the
// last requested intent and replay it the moment its destination is reachable.
let pendingNavigation = null;

function rootHasRoute(name) {
  try {
    const state = navRef.getRootState();
    return Array.isArray(state?.routeNames) && state.routeNames.includes(name);
  } catch {
    return false;
  }
}

// Replay a queued navigation if navigation is ready and the target exists.
// Returns true when it actually navigated.
export function flushNavigation() {
  if (!pendingNavigation || !navRef.isReady()) return false;
  const { name, params } = pendingNavigation;
  // Target tree not mounted yet (e.g. still on the auth stack) — keep waiting.
  if (!rootHasRoute(name)) return false;
  pendingNavigation = null;
  navRef.navigate(name, params);
  return true;
}

// Navigate now if possible; otherwise queue the intent and let flushNavigation
// (called on container ready and after login) deliver it.
export function navigate(name, params) {
  pendingNavigation = { name, params };
  flushNavigation();
}
