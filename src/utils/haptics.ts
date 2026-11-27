export type HapticFeedbackKind =
  | 'light'
  | 'selection'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error';

const HAPTICS_STORAGE_KEY = 'quizpro_haptics_enabled_v1';

interface CapacitorHapticsPlugin {
  impact?: (opts: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void> | void;
  notification?: (opts: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void> | void;
  selectionChanged?: () => Promise<void> | void;
}

interface HapticWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: {
      Haptics?: CapacitorHapticsPlugin;
    };
  };
  AndroidNativeBridge?: {
    vibrate?: (ms: number) => void;
  };
}

const PATTERN_MS: Record<HapticFeedbackKind, number | number[]> = {
  selection: 6,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 32, 18],
  warning: [16, 35, 16],
  error: [22, 40, 22, 40, 22],
};

let lastTriggerMs = 0;

export function isHapticsEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    const raw = localStorage.getItem(HAPTICS_STORAGE_KEY);
    return raw === null ? true : raw === '1' || raw === 'true';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

function isLikelyMobileOrNative(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as HapticWindow;
  if (w.Capacitor?.isNativePlatform?.() || w.AndroidNativeBridge) {
    return true;
  }
  const hasCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const hasTouch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
  return hasCoarsePointer || hasTouch;
}

/**
 * Triggers a subtle, zero-blocking haptic pulse for mobile browsers and native APK WebViews.
 */
export function triggerHaptic(kind: HapticFeedbackKind = 'light'): void {
  if (typeof window === 'undefined' || !isHapticsEnabled()) return;

  const now = Date.now();
  if (now - lastTriggerMs < 22) return;
  lastTriggerMs = now;

  try {
    const w = window as unknown as HapticWindow;
    const capHaptics = w.Capacitor?.Plugins?.Haptics;

    if (capHaptics) {
      if (kind === 'selection' && capHaptics.selectionChanged) {
        void capHaptics.selectionChanged();
        return;
      }
      if ((kind === 'success' || kind === 'warning' || kind === 'error') && capHaptics.notification) {
        void capHaptics.notification({
          type: kind === 'success' ? 'SUCCESS' : kind === 'warning' ? 'WARNING' : 'ERROR',
        });
        return;
      }
      if (capHaptics.impact) {
        const style =
          kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT';
        void capHaptics.impact({ style });
        return;
      }
    }

    if (w.AndroidNativeBridge?.vibrate) {
      const p = PATTERN_MS[kind];
      const ms = Array.isArray(p) ? p[0] : p;
      w.AndroidNativeBridge.vibrate(ms);
      return;
    }

    if (!isLikelyMobileOrNative()) return;

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERN_MS[kind]);
    }
  } catch {
    // Never let vibration API errors interrupt UI actions
  }
}
