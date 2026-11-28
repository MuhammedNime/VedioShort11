import { isAndroidNativeApp } from '../utils/nativeDownload';

interface NativeBackgroundBridge {
  startBackgroundWork?: (label: string) => boolean;
  updateBackgroundWorkProgress?: (label: string, progressPct: number) => boolean;
  stopBackgroundWork?: (completionTitle: string, completionBody: string) => boolean;
  isIgnoringBatteryOptimizations?: () => boolean;
  requestIgnoreBatteryOptimizations?: () => boolean;
}

interface BackgroundWindow extends Window {
  AndroidNativeBridge?: NativeBackgroundBridge;
  webkitAudioContext?: typeof AudioContext;
}

interface ActiveTaskState {
  label: string;
  progressPct: number;
  updatedAt: number;
}

const activeTasks = new Map<string, ActiveTaskState>();
let screenWakeLock: { release: () => Promise<void> } | null = null;
let keepAliveAudioCtx: AudioContext | null = null;
let keepAliveOsc: OscillatorNode | null = null;
let keepAliveGain: GainNode | null = null;
let listenersBound = false;

// Shared Web Worker for unthrottled background timers (immune to tab rAF / 1s main-thread throttle)
let sharedTimerWorker: Worker | null = null;
let workerReqSeq = 0;
const workerCallbacks = new Map<number, () => void>();

function getNativeBridge(): NativeBackgroundBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as BackgroundWindow).AndroidNativeBridge;
}

function getPrimaryTask(): ActiveTaskState | null {
  let latest: ActiveTaskState | null = null;
  for (const t of activeTasks.values()) {
    if (!latest || t.updatedAt >= latest.updatedAt) {
      latest = t;
    }
  }
  return latest;
}

function ensureTimerWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof Blob === 'undefined') {
    return null;
  }
  if (sharedTimerWorker) return sharedTimerWorker;
  try {
    const workerCode = `
      const timers = new Map();
      self.onmessage = function(e) {
        const msg = e.data || {};
        if (msg.cmd === 'delay') {
          const id = setTimeout(function() {
            timers.delete(msg.id);
            self.postMessage({ id: msg.id });
          }, Math.max(0, msg.ms || 0));
          timers.set(msg.id, id);
        } else if (msg.cmd === 'intervalStart') {
          const id = setInterval(function() {
            self.postMessage({ intervalId: msg.id });
          }, Math.max(8, msg.ms || 33));
          timers.set('int_' + msg.id, id);
        } else if (msg.cmd === 'intervalStop') {
          const id = timers.get('int_' + msg.id);
          if (id) clearInterval(id);
          timers.delete('int_' + msg.id);
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = (ev: MessageEvent<{ id?: number; intervalId?: number }>) => {
      const data = ev.data;
      if (!data) return;
      if (typeof data.id === 'number') {
        const cb = workerCallbacks.get(data.id);
        if (cb) {
          workerCallbacks.delete(data.id);
          cb();
        }
      }
      if (typeof data.intervalId === 'number') {
        const cb = workerCallbacks.get(data.intervalId);
        if (cb) cb();
      }
    };
    sharedTimerWorker = worker;
    return worker;
  } catch {
    return null;
  }
}

/**
 * Sleeps without hitting Chromium's 1000ms background-tab timer throttle when screen is off or minimized.
 */
export function unthrottledSleepMs(ms: number): Promise<void> {
  if (typeof window === 'undefined') {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  if (ms <= 0 && typeof MessageChannel !== 'undefined') {
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => resolve();
      ch.port2.postMessage(null);
    });
  }
  const worker = ensureTimerWorker();
  if (!worker) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
  return new Promise((resolve) => {
    const id = ++workerReqSeq;
    workerCallbacks.set(id, resolve);
    worker.postMessage({ cmd: 'delay', id, ms });
  });
}

/**
 * Starts an unthrottled background interval driven from a dedicated Web Worker.
 */
export function createWorkerTicker(intervalMs: number, onTick: () => void): () => void {
  const worker = ensureTimerWorker();
  if (!worker) {
    const timer = window.setInterval(onTick, Math.max(12, intervalMs));
    return () => window.clearInterval(timer);
  }
  const id = ++workerReqSeq;
  workerCallbacks.set(id, onTick);
  worker.postMessage({ cmd: 'intervalStart', id, ms: Math.max(12, intervalMs) });
  return () => {
    workerCallbacks.delete(id);
    try {
      worker.postMessage({ cmd: 'intervalStop', id });
    } catch {
      // ignore
    }
  };
}

async function acquireScreenWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return;
  if (document.hidden || screenWakeLock) return;
  try {
    const wl = (
      navigator as unknown as {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      }
    ).wakeLock;
    if (wl) {
      screenWakeLock = await wl.request('screen');
    }
  } catch {
    // WakeLock may fail on battery saver or unsupported browser; non-fatal
  }
}

function releaseScreenWakeLock(): void {
  if (!screenWakeLock) return;
  const current = screenWakeLock;
  screenWakeLock = null;
  void current.release().catch(() => undefined);
}

function startSilentAudioKeepAlive(label: string): void {
  if (typeof window === 'undefined' || keepAliveAudioCtx) return;
  try {
    const w = window as unknown as BackgroundWindow;
    const Ctor = window.AudioContext || w.webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 180;
    gain.gain.value = 0.00008; // inaudible keep-alive pulse for mobile Chrome background stability
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }
    keepAliveAudioCtx = ctx;
    keepAliveOsc = osc;
    keepAliveGain = gain;
  } catch {
    // ignore autoplay blocks
  }

  updateMediaSessionMetadata(label);
}

function stopSilentAudioKeepAlive(): void {
  try {
    keepAliveOsc?.stop();
    keepAliveOsc?.disconnect();
    keepAliveGain?.disconnect();
  } catch {
    // ignore
  }
  keepAliveOsc = null;
  keepAliveGain = null;
  if (keepAliveAudioCtx) {
    const ctx = keepAliveAudioCtx;
    keepAliveAudioCtx = null;
    void ctx.close().catch(() => undefined);
  }
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'none';
    } catch {
      // ignore
    }
  }
}

function updateMediaSessionMetadata(label: string): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    if (typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: label || 'جارٍ العمل في الخلفية...',
        artist: 'استوديو كويز برو',
        album: 'إنتاج وتصدير الفيديو بالذكاء الاصطناعي',
      });
    }
    navigator.mediaSession.playbackState = 'playing';
  } catch {
    // ignore
  }
}

function bindGlobalVisibilityWakeListener(): void {
  if (listenersBound || typeof document === 'undefined') return;
  listenersBound = true;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && activeTasks.size > 0) {
      void acquireScreenWakeLock();
      if (keepAliveAudioCtx && keepAliveAudioCtx.state === 'suspended') {
        void keepAliveAudioCtx.resume().catch(() => undefined);
      }
    }
  });
}

export function beginBackgroundTask(taskId: string, label: string, progressPct = -1): void {
  bindGlobalVisibilityWakeListener();
  activeTasks.set(taskId, { label, progressPct, updatedAt: Date.now() });

  const bridge = getNativeBridge();
  if (bridge?.startBackgroundWork) {
    try {
      bridge.startBackgroundWork(label);
    } catch {
      // ignore
    }
  }

  void acquireScreenWakeLock();
  startSilentAudioKeepAlive(label);
}

export function updateBackgroundTaskProgress(
  taskId: string,
  label: string,
  progressPct = -1
): void {
  const existing = activeTasks.get(taskId);
  const cleanPct = Math.max(-1, Math.min(100, Math.round(progressPct)));
  activeTasks.set(taskId, {
    label: label || existing?.label || 'جارٍ التنفيذ في الخلفية...',
    progressPct: cleanPct,
    updatedAt: Date.now(),
  });

  const primary = getPrimaryTask();
  if (!primary) return;

  const bridge = getNativeBridge();
  if (bridge?.updateBackgroundWorkProgress) {
    try {
      bridge.updateBackgroundWorkProgress(primary.label, primary.progressPct);
    } catch {
      // ignore
    }
  }
  updateMediaSessionMetadata(primary.label);
}

export function endBackgroundTask(
  taskId: string,
  completion?: { title: string; body: string }
): void {
  activeTasks.delete(taskId);

  if (activeTasks.size > 0) {
    const nextPrimary = getPrimaryTask();
    if (nextPrimary) {
      const bridge = getNativeBridge();
      try {
        bridge?.updateBackgroundWorkProgress?.(nextPrimary.label, nextPrimary.progressPct);
      } catch {
        // ignore
      }
      updateMediaSessionMetadata(nextPrimary.label);
    }
    return;
  }

  // Last task finished — tear down native service / wake lock / keep-alive audio
  const bridge = getNativeBridge();
  if (bridge?.stopBackgroundWork) {
    try {
      bridge.stopBackgroundWork(completion?.title || '', completion?.body || '');
    } catch {
      // ignore
    }
  } else if (completion && typeof document !== 'undefined' && document.hidden) {
    void notifyBackgroundCompletion(completion.title, completion.body);
  }

  releaseScreenWakeLock();
  stopSilentAudioKeepAlive();
}

export function getActiveBackgroundTaskCount(): number {
  return activeTasks.size;
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBackgroundNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function notifyBackgroundCompletion(title: string, body: string): Promise<void> {
  if (typeof window === 'undefined' || isAndroidNativeApp()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
      ]);
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'quizpro-bg-done',
        });
        return;
      }
    }
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag: 'quizpro-bg-done',
    });
  } catch {
    // ignore notification blocks
  }
}

export function isBatteryOptimizationIgnored(): boolean {
  const bridge = getNativeBridge();
  if (!bridge?.isIgnoringBatteryOptimizations) return true;
  try {
    return Boolean(bridge.isIgnoringBatteryOptimizations());
  } catch {
    return false;
  }
}

export function requestAndroidBatteryExemption(): boolean {
  const bridge = getNativeBridge();
  if (!bridge?.requestIgnoreBatteryOptimizations) return false;
  try {
    return Boolean(bridge.requestIgnoreBatteryOptimizations());
  } catch {
    return false;
  }
}
