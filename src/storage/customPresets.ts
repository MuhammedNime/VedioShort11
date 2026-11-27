import {
  AudioSettings,
  DEFAULT_TEMPLATE,
  PresetId,
  TemplateSettings,
  TimingSettings,
} from '../types/quiz';
import { idbGet, idbSet } from './projectStore';

const CUSTOM_PRESETS_KEY = 'quizpro_custom_presets_v1';
const CUSTOM_PRESETS_IDB_KEY = 'quizpro_custom_styles_vault_v2';
const DEFAULT_STYLE_ID_KEY = 'quizpro_default_custom_style_id_v1';

export interface CustomTemplatePreset {
  id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
  includesMedia?: boolean;
  isFullStudioPreset?: boolean;
  isRecurringBlueprint?: boolean;
  template: Partial<TemplateSettings>;
  timing?: TimingSettings;
  audio?: AudioSettings;
}

export interface SaveStyleOptions {
  includeBrandAndBg?: boolean;
  timing?: TimingSettings;
  audio?: AudioSettings;
  isFullStudioPreset?: boolean;
  isRecurringBlueprint?: boolean;
}

export interface FullStudioPackagePreset {
  id: string;
  name: string;
  emoji: string;
  subtitle: string;
  accentColor: string;
  presetId: PresetId;
  templatePatch: Partial<TemplateSettings>;
  timingPatch: Partial<TimingSettings>;
  audioPatch: Partial<AudioSettings>;
}

export const FULL_STUDIO_PACKAGES: FullStudioPackagePreset[] = [
  {
    id: 'viral-speed-challenge',
    name: 'باقة التحدي السريع الفيروسي',
    emoji: '⚡',
    subtitle: 'نيون + اهتزاز وتكبير للخيارات + إيقاع متسارع + نبضة الوقت ينفد',
    accentColor: '#22d3ee',
    presetId: 'neonCyber',
    templatePatch: {
      optionAppearEffect: 'shakeAndZoom',
      optionAppearEffectIntensity: 1.05,
      optionAppearSfx: 'glitchSnap',
      optionAppearSfxVolume: 0.42,
      timerStyle: 'circle',
      timerUrgentPulse: true,
      timerUrgentThreshold: 3,
      timerUrgentRushBanner: true,
      timerUrgentRushText: 'الوقت ينفد! 🔥',
      timerUrgentDoubleBeat: true,
      revealConfetti: true,
      revealShockwave: true,
      showLiveScoreboard: true,
      showVideoProgressBar: true,
      showIntroHook: true,
      introHookDuration: 1.5,
      introHookSfx: 'impactBoom',
    },
    timingPatch: {
      thinkingDuration: 4.5,
      optionStaggerDelay: 0.35,
      suspenseDuration: 1.2,
      revealHoldDuration: 2.6,
      escalatingSpeed: true,
      escalatingStepSeconds: 0.5,
      escalatingMinSeconds: 2.0,
    },
    audioPatch: {
      questionEnter: { sourceType: 'builtin', builtinId: 'whoosh', volume: 0.78 },
      optionEnter: { sourceType: 'builtin', builtinId: 'softPop', volume: 0.78 },
      countdownTick: { sourceType: 'builtin', builtinId: 'channelTick', volume: 0.72 },
      suspense: { sourceType: 'builtin', builtinId: 'suspenseRiser', volume: 0.75 },
      correctReveal: { sourceType: 'builtin', builtinId: 'arcadeLevelUp', volume: 0.85 },
    },
  },
  {
    id: 'islamic-heritage-calm',
    name: 'باقة التراث والسيرة الراقية',
    emoji: '🕌',
    subtitle: 'أندلسي فاخر + توهج ناعم للخيارات + دليل ومعلومة + توقيت متوازن',
    accentColor: '#eab308',
    presetId: 'islamicAndalusian',
    templatePatch: {
      optionAppearEffect: 'glowFlash',
      optionAppearEffectIntensity: 0.85,
      optionAppearSfx: 'chime',
      optionAppearSfxVolume: 0.32,
      timerStyle: 'channelBox',
      timerUrgentPulse: true,
      timerUrgentThreshold: 2,
      timerUrgentRushBanner: false,
      timerUrgentDoubleBeat: false,
      revealConfetti: false,
      revealShockwave: true,
      showExplanationOnReveal: true,
      explanationStyle: 'card',
      showLiveScoreboard: false,
      showVideoProgressBar: true,
      showIntroHook: true,
      introHookDuration: 1.8,
      introHookSfx: 'mysterySparkle',
    },
    timingPatch: {
      thinkingDuration: 6.0,
      optionStaggerDelay: 0.5,
      suspenseDuration: 1.5,
      revealHoldDuration: 3.6,
      escalatingSpeed: false,
    },
    audioPatch: {
      questionEnter: { sourceType: 'builtin', builtinId: 'mysterySparkle', volume: 0.62 },
      optionEnter: { sourceType: 'builtin', builtinId: 'softPop', volume: 0.65 },
      countdownTick: { sourceType: 'builtin', builtinId: 'tick', volume: 0.55 },
      suspense: { sourceType: 'builtin', builtinId: 'calmPulse', volume: 0.65 },
      correctReveal: { sourceType: 'builtin', builtinId: 'successFanfare', volume: 0.8 },
    },
  },
  {
    id: 'millionaire-arena-show',
    name: 'باقة مسرح المليونير الكبرى',
    emoji: '👑',
    subtitle: 'سلم الجوائز + تكبير ارتدادي + تشويق درامي + موجة صدمة عند الفوز',
    accentColor: '#f59e0b',
    presetId: 'millionaire',
    templatePatch: {
      optionAppearEffect: 'zoomPunch',
      optionAppearEffectIntensity: 1.0,
      optionAppearSfx: 'click',
      optionAppearSfxVolume: 0.48,
      timerStyle: 'hexBadge',
      timerUrgentPulse: true,
      timerUrgentThreshold: 3,
      timerUrgentRushBanner: true,
      timerUrgentRushText: 'أجب الآن! ⏳',
      timerUrgentDoubleBeat: true,
      revealConfetti: true,
      revealShockwave: true,
      showPrizeLadder: true,
      prizeLadderStyle: 'topStrip',
      showIntroHook: true,
      introHookDuration: 1.8,
      introHookSfx: 'impactBoom',
    },
    timingPatch: {
      thinkingDuration: 5.5,
      optionStaggerDelay: 0.48,
      suspenseDuration: 1.8,
      revealHoldDuration: 3.2,
      escalatingSpeed: true,
      escalatingStepSeconds: 0.5,
      escalatingMinSeconds: 2.5,
    },
    audioPatch: {
      questionEnter: { sourceType: 'builtin', builtinId: 'impactBoom', volume: 0.72 },
      optionEnter: { sourceType: 'builtin', builtinId: 'softPop', volume: 0.75 },
      countdownTick: { sourceType: 'builtin', builtinId: 'channelTick', volume: 0.7 },
      suspense: { sourceType: 'builtin', builtinId: 'suspenseRiser', volume: 0.82 },
      correctReveal: { sourceType: 'builtin', builtinId: 'successFanfare', volume: 0.9 },
    },
  },
  {
    id: 'science-cosmic-discovery',
    name: 'باقة العلوم والفضاء الحديثة',
    emoji: '🌌',
    subtitle: 'مجرة الفضاء + نبض مطاطي للخيارات + بطاقة معلومة + مؤثرات نقية',
    accentColor: '#38bdf8',
    presetId: 'cosmicSpace',
    templatePatch: {
      optionAppearEffect: 'bouncePulse',
      optionAppearEffectIntensity: 0.95,
      optionAppearSfx: 'softPop',
      optionAppearSfxVolume: 0.4,
      timerStyle: 'circle',
      timerUrgentPulse: true,
      timerUrgentThreshold: 3,
      timerUrgentRushBanner: true,
      timerUrgentRushText: 'العد التنازلي الأخير! 🚀',
      timerUrgentDoubleBeat: false,
      revealConfetti: true,
      revealShockwave: true,
      showExplanationOnReveal: true,
      explanationStyle: 'pill',
      showVideoProgressBar: true,
    },
    timingPatch: {
      thinkingDuration: 5.0,
      optionStaggerDelay: 0.45,
      suspenseDuration: 1.4,
      revealHoldDuration: 3.2,
      escalatingSpeed: false,
    },
    audioPatch: {
      questionEnter: { sourceType: 'builtin', builtinId: 'whoosh', volume: 0.72 },
      optionEnter: { sourceType: 'builtin', builtinId: 'click', volume: 0.7 },
      countdownTick: { sourceType: 'builtin', builtinId: 'tick', volume: 0.62 },
      suspense: { sourceType: 'builtin', builtinId: 'mysterySparkle', volume: 0.75 },
      correctReveal: { sourceType: 'builtin', builtinId: 'chime', volume: 0.86 },
    },
  },
];

function buildStyleSnapshot(
  template: TemplateSettings,
  options?: SaveStyleOptions
): { snapshot: Partial<TemplateSettings>; includesMedia: boolean } {
  const includeMedia = options?.includeBrandAndBg ?? true;
  const snapshot: Partial<TemplateSettings> = { ...template };

  // Strip intro audio blob if huge? Keep under 2MB or keep as-is in IndexedDB
  if (!includeMedia) {
    delete snapshot.brandLogoDataUrl;
    delete snapshot.brandLogoName;
    delete snapshot.customBgDataUrl;
    delete snapshot.customBgName;
    if (snapshot.backgroundType === 'custom') {
      snapshot.backgroundType = 'preset';
    }
  }

  return {
    snapshot,
    includesMedia: Boolean(
      includeMedia && (snapshot.customBgDataUrl || snapshot.brandLogoDataUrl)
    ),
  };
}

function sanitizePresetItem(raw: unknown): CustomTemplatePreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<CustomTemplatePreset>;
  if (typeof item.id !== 'string' || !item.id) return null;
  if (typeof item.name !== 'string' || !item.name.trim()) return null;
  if (!item.template || typeof item.template !== 'object') return null;
  return {
    id: item.id,
    name: item.name.trim(),
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : item.createdAt || Date.now(),
    includesMedia: Boolean(
      item.includesMedia ?? (item.template.customBgDataUrl || item.template.brandLogoDataUrl)
    ),
    isFullStudioPreset: Boolean(item.isFullStudioPreset || item.audio),
    isRecurringBlueprint: Boolean(item.isRecurringBlueprint),
    template: { ...item.template },
    timing: item.timing ? { ...item.timing } : undefined,
    audio: item.audio ? { ...item.audio } : undefined,
  };
}

function mirrorLightListToLocalStorage(list: CustomTemplatePreset[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const serialized = JSON.stringify(list);
    if (serialized.length <= 1_200_000) {
      localStorage.setItem(CUSTOM_PRESETS_KEY, serialized);
      return;
    }
    // Strip heavy base64 images only from localStorage mirror; IndexedDB holds full copy
    const lightList = list.map((p) => {
      const tpl = { ...p.template };
      if (tpl.customBgDataUrl && tpl.customBgDataUrl.length > 120_000) {
        delete tpl.customBgDataUrl;
      }
      if (tpl.brandLogoDataUrl && tpl.brandLogoDataUrl.length > 120_000) {
        delete tpl.brandLogoDataUrl;
      }
      return { ...p, template: tpl };
    });
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(lightList));
  } catch {
    // ignore localStorage quota errors
  }
}

async function persistPresetsVault(list: CustomTemplatePreset[]): Promise<CustomTemplatePreset[]> {
  const capped = list.slice(0, 40);
  try {
    await idbSet(CUSTOM_PRESETS_IDB_KEY, capped);
  } catch {
    // ignore IDB write error
  }
  mirrorLightListToLocalStorage(capped);
  return capped;
}

export function loadCustomPresets(): CustomTemplatePreset[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizePresetItem).filter((x): x is CustomTemplatePreset => x !== null);
  } catch {
    return [];
  }
}

export async function loadCustomPresetsAsync(): Promise<CustomTemplatePreset[]> {
  const localItems = loadCustomPresets();
  try {
    const idbList = await idbGet<unknown[]>(CUSTOM_PRESETS_IDB_KEY);
    if (Array.isArray(idbList) && idbList.length > 0) {
      const clean = idbList
        .map(sanitizePresetItem)
        .filter((x): x is CustomTemplatePreset => x !== null);
      if (clean.length > 0) {
        mirrorLightListToLocalStorage(clean);
        return clean;
      }
    }
    if (localItems.length > 0) {
      await persistPresetsVault(localItems);
    }
  } catch {
    // fallback to localStorage items
  }
  return localItems;
}

export async function saveCustomPresetAsync(
  name: string,
  template: TemplateSettings,
  options?: SaveStyleOptions
): Promise<{ list: CustomTemplatePreset[]; created: CustomTemplatePreset }> {
  const cleanName =
    name.trim() || `ستايلي الخاص ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
  const { snapshot, includesMedia } = buildStyleSnapshot(template, options);

  const created: CustomTemplatePreset = {
    id: `style-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    includesMedia,
    isFullStudioPreset: Boolean(options?.isFullStudioPreset || options?.audio),
    isRecurringBlueprint: Boolean(options?.isRecurringBlueprint),
    template: snapshot,
    timing: options?.timing ? { ...options.timing } : undefined,
    audio: options?.audio ? { ...options.audio } : undefined,
  };

  const existing = await loadCustomPresetsAsync();
  const list = await persistPresetsVault([created, ...existing]);
  return { list, created };
}

export async function updateCustomPresetAsync(
  id: string,
  template: TemplateSettings,
  options?: SaveStyleOptions & { name?: string }
): Promise<CustomTemplatePreset[]> {
  const existing = await loadCustomPresetsAsync();
  const { snapshot, includesMedia } = buildStyleSnapshot(template, options);
  const nextList = existing.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      name: options?.name?.trim() || item.name,
      updatedAt: Date.now(),
      includesMedia,
      isFullStudioPreset: Boolean(
        options?.isFullStudioPreset ?? (options?.audio !== undefined ? true : item.isFullStudioPreset)
      ),
      isRecurringBlueprint: Boolean(options?.isRecurringBlueprint ?? item.isRecurringBlueprint),
      template: snapshot,
      timing: options?.timing !== undefined ? { ...options.timing } : item.timing,
      audio: options?.audio !== undefined ? { ...options.audio } : item.audio,
    };
  });
  return await persistPresetsVault(nextList);
}

export async function renameCustomPresetAsync(
  id: string,
  newName: string
): Promise<CustomTemplatePreset[]> {
  const clean = newName.trim();
  if (!clean) return await loadCustomPresetsAsync();
  const existing = await loadCustomPresetsAsync();
  const nextList = existing.map((item) =>
    item.id === id ? { ...item, name: clean, updatedAt: Date.now() } : item
  );
  return await persistPresetsVault(nextList);
}

export async function deleteCustomPresetAsync(id: string): Promise<CustomTemplatePreset[]> {
  const existing = await loadCustomPresetsAsync();
  const nextList = existing.filter((p) => p.id !== id);
  if (getDefaultCustomStyleId() === id) {
    setDefaultCustomStyleId(null);
  }
  return await persistPresetsVault(nextList);
}

export function getDefaultCustomStyleId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(DEFAULT_STYLE_ID_KEY) || null;
  } catch {
    return null;
  }
}

export function setDefaultCustomStyleId(id: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (id) {
      localStorage.setItem(DEFAULT_STYLE_ID_KEY, id);
    } else {
      localStorage.removeItem(DEFAULT_STYLE_ID_KEY);
    }
  } catch {
    // ignore
  }
}

export async function getDefaultCustomPreset(): Promise<CustomTemplatePreset | null> {
  const defaultId = getDefaultCustomStyleId();
  if (!defaultId) return null;
  const list = await loadCustomPresetsAsync();
  return list.find((item) => item.id === defaultId) ?? null;
}

export function serializeStylePreset(preset: CustomTemplatePreset): string {
  return JSON.stringify(
    {
      format: 'quizpro-reels-style-v1',
      preset,
    },
    null,
    2
  );
}

export async function importCustomStyleFromJson(
  jsonText: string
): Promise<{ list: CustomTemplatePreset[]; imported: CustomTemplatePreset }> {
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const candidate =
    parsed && typeof parsed === 'object' && 'preset' in parsed ? parsed.preset : parsed;
  const sanitized = sanitizePresetItem(candidate);
  if (!sanitized) {
    throw new Error('ملف الستايل غير صالح أو لا يحتوي على إعدادات تصميم صحيحة.');
  }

  const imported: CustomTemplatePreset = {
    ...sanitized,
    id: `style-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    template: {
      ...DEFAULT_TEMPLATE,
      ...sanitized.template,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const existing = await loadCustomPresetsAsync();
  const list = await persistPresetsVault([imported, ...existing]);
  return { list, imported };
}

export function saveCustomPreset(name: string, template: TemplateSettings): CustomTemplatePreset[] {
  const cleanName = name.trim() || `قالب مخصص ${new Date().toLocaleTimeString('ar-EG')}`;
  const { snapshot, includesMedia } = buildStyleSnapshot(template, { includeBrandAndBg: true });
  const nextItem: CustomTemplatePreset = {
    id: `style-${Date.now()}`,
    name: cleanName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    includesMedia,
    template: snapshot,
  };
  const existing = loadCustomPresets();
  const nextList = [nextItem, ...existing].slice(0, 40);
  void persistPresetsVault(nextList);
  return nextList;
}

export function deleteCustomPreset(id: string): CustomTemplatePreset[] {
  const existing = loadCustomPresets();
  const nextList = existing.filter((p) => p.id !== id);
  if (getDefaultCustomStyleId() === id) {
    setDefaultCustomStyleId(null);
  }
  void persistPresetsVault(nextList);
  return nextList;
}

export async function mergeCustomPresetsVault(
  incomingRaw: unknown[],
  restoredDefaultStyleId?: string | null
): Promise<CustomTemplatePreset[]> {
  const existing = await loadCustomPresetsAsync();
  const sanitizedIncoming = (Array.isArray(incomingRaw) ? incomingRaw : [])
    .map(sanitizePresetItem)
    .filter((x): x is CustomTemplatePreset => x !== null);

  const byId = new Map<string, CustomTemplatePreset>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of sanitizedIncoming) {
    byId.set(item.id, item);
  }

  const merged = Array.from(byId.values()).sort(
    (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
  );
  const saved = await persistPresetsVault(merged);

  if (restoredDefaultStyleId && byId.has(restoredDefaultStyleId)) {
    setDefaultCustomStyleId(restoredDefaultStyleId);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('shorts-studio-presets-updated'));
  }
  return saved;
}
