import React, { useEffect, useState } from 'react';
import { BellRing, ShieldCheck } from 'lucide-react';
import {
  getNotificationPermissionState,
  isBatteryOptimizationIgnored,
  requestAndroidBatteryExemption,
  requestBackgroundNotificationPermission,
} from '../services/backgroundKeepAlive';
import { isAndroidNativeApp } from '../utils/nativeDownload';
import { triggerHaptic } from '../utils/haptics';

interface BackgroundProtectionControlProps {
  compact?: boolean;
}

/**
 * Shows an actionable 1-tap control ONLY when Android battery optimization
 * or Web notification permission is not yet enabled for background resilience.
 */
export const BackgroundProtectionControl: React.FC<BackgroundProtectionControlProps> = ({
  compact = false,
}) => {
  const isNative = isAndroidNativeApp();
  const [batteryExempt, setBatteryExempt] = useState<boolean>(() =>
    isNative ? isBatteryOptimizationIgnored() : true
  );
  const [notifPerm, setNotifPerm] = useState(() => getNotificationPermissionState());

  useEffect(() => {
    const refresh = () => {
      if (isNative) {
        setBatteryExempt(isBatteryOptimizationIgnored());
      } else {
        setNotifPerm(getNotificationPermissionState());
      }
    };
    const onVis = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isNative]);

  if (isNative) {
    if (batteryExempt) return null;
    return (
      <button
        type="button"
        onClick={() => {
          triggerHaptic('medium');
          requestAndroidBatteryExemption();
        }}
        className={`inline-flex items-center gap-1.5 rounded-xl border border-amber-400/45 bg-amber-500/12 hover:bg-amber-500/20 text-amber-200 font-bold cursor-pointer transition-colors ${
          compact ? 'px-2.5 py-1.5 text-[11px] min-h-[34px]' : 'px-3.5 py-2 text-xs min-h-[40px]'
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-amber-300" />
        <span>استثناء البطارية للعمل عند قفل الشاشة</span>
      </button>
    );
  }

  if (notifPerm !== 'default') return null;

  return (
    <button
      type="button"
      onClick={() => {
        triggerHaptic('light');
        void requestBackgroundNotificationPermission().then(setNotifPerm);
      }}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-[var(--pline)] bg-[var(--surface)] hover:border-[#00B050]/65 text-[var(--ptxt)] font-bold cursor-pointer transition-colors ${
        compact ? 'px-2.5 py-1.5 text-[11px] min-h-[34px]' : 'px-3.5 py-2 text-xs min-h-[40px]'
      }`}
    >
      <BellRing className="w-3.5 h-3.5 shrink-0 text-[#00c85b]" />
      <span>تنبيه عند الاكتمال بالخلفية</span>
    </button>
  );
};
