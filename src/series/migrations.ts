import {
  BrandPreset,
  CURRENT_SERIES_SCHEMA_VERSION,
  Episode,
  EpisodeStatus,
  FactCheckStatus,
  Scene,
  SceneAnimation,
  SceneMood,
  SceneVisualType,
  Series,
  SeriesAudience,
  SeriesFormat,
  SeriesLanguage,
  SeriesStatus,
  SeriesStylePreset,
  ThumbnailConcept,
} from '../types/series';
import type { PresetId, SlideTransitionStyle } from '../types/quiz';

export const DEFAULT_BRAND_PRESET: BrandPreset = {
  id: 'brand-quizpro-emerald',
  name: 'الهوية الذهبية الزمردية',
  presetId: 'quizProSignature',
  logo: {
    position: 'topRight',
    size: 108,
  },
  primaryColors: {
    bg: '#0c0c0c',
    accent: '#00B050',
    surface: '#17130c',
    text: '#f4ead2',
  },
  secondaryColors: {
    border: '#d4a73a',
    correct: '#00B050',
    wrong: '#DC2626',
  },
  typography: {
    fontFamily: 'Cairo',
    headingWeight: 800,
  },
  narrator: {
    voice: 'Kore',
    tone: 'احترافي مشوق',
  },
  music: {
    builtinId: 'calmPulse',
    volume: 0.25,
  },
  intro: {
    enabled: true,
    text: 'هل تعلم؟',
    duration: 2.2,
    style: 'card',
  },
  outro: {
    enabled: true,
    text: 'تابع السلسلة للحلقات القادمة',
    ctaText: 'اشترك وشاركنا رأيك في التعليقات',
  },
  subtitleStyle: {
    enabled: true,
    style: 'pillKaraoke',
    yPct: 82,
  },
  lowerThirdStyle: {
    showChannelName: true,
    channelName: 'استوديو كويز برو',
    handleText: '@QuizProReels',
    accentColor: '#d4a73a',
  },
};

export const BUILTIN_BRAND_PRESETS: BrandPreset[] = [
  DEFAULT_BRAND_PRESET,
  {
    ...DEFAULT_BRAND_PRESET,
    id: 'brand-sand-classic',
    name: 'القالب الرملي الأصيل',
    presetId: 'channelSand',
    primaryColors: {
      bg: '#1c150c',
      accent: '#d4a73a',
      surface: '#EDD6A2',
      text: '#1f160a',
    },
    secondaryColors: {
      border: '#ffffff',
      correct: '#00B050',
      wrong: '#DC2626',
    },
    lowerThirdStyle: {
      showChannelName: true,
      channelName: 'سلسلة المعرفة',
      handleText: '@KnowledgeSeries',
      accentColor: '#d4a73a',
    },
  },
  {
    ...DEFAULT_BRAND_PRESET,
    id: 'brand-navy-cinema',
    name: 'الكحلي الوثائقي',
    presetId: 'channelNavy',
    primaryColors: {
      bg: '#0b1230',
      accent: '#38bdf8',
      surface: '#1f2a4d',
      text: '#ffffff',
    },
    secondaryColors: {
      border: '#d4a73a',
      correct: '#00B050',
      wrong: '#EF4444',
    },
    narrator: {
      voice: 'Charon',
      tone: 'وثائقي رصين',
    },
  },
  {
    ...DEFAULT_BRAND_PRESET,
    id: 'brand-emerald-studio',
    name: 'الزمردي الحديث',
    presetId: 'channelEmerald',
    primaryColors: {
      bg: '#071b14',
      accent: '#00B050',
      surface: '#f3efd9',
      text: '#12342b',
    },
    secondaryColors: {
      border: '#c9a24a',
      correct: '#00B050',
      wrong: '#DC2626',
    },
  },
];

const VALID_STATUSES = new Set<SeriesStatus>([
  'queued',
  'generating',
  'reviewing',
  'ready',
  'exporting',
  'failed',
]);

const VALID_FORMATS = new Set<SeriesFormat>(['9:16', '16:9', '1:1']);
const VALID_STYLES = new Set<SeriesStylePreset>([
  'educational',
  'documentary',
  'storytelling',
  'quizChallenge',
  'fastFacts',
  'mythBuster',
]);
const VALID_LANGUAGES = new Set<SeriesLanguage>(['ar', 'en', 'bilingual']);
const VALID_AUDIENCES = new Set<SeriesAudience>([
  'general',
  'youth',
  'kids',
  'professionals',
  'students',
]);
const VALID_VISUAL_TYPES = new Set<SceneVisualType>(['svg', 'aiImage', 'gradient', 'quizCard']);
const VALID_ANIMATIONS = new Set<SceneAnimation>([
  'zoomIn',
  'panLeft',
  'panRight',
  'pulse',
  'fadeIn',
  'pop',
]);
const VALID_MOODS = new Set<SceneMood>(['energetic', 'curious', 'dramatic', 'calm', 'triumphant']);
const VALID_TRANSITIONS = new Set<SlideTransitionStyle>([
  'none',
  'fade',
  'slideLeft',
  'slideRight',
  'zoomFade',
  'wipeGold',
]);
const VALID_FACT_STATUSES = new Set<FactCheckStatus>(['verified', 'needs_review', 'flagged']);
const VALID_VOICES = new Set(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr']);

function safeString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback;
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampFloat(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function migrateBrandPresetSchema(raw: unknown): BrandPreset {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const logoSrc = (src.logo && typeof src.logo === 'object' ? src.logo : {}) as Record<string, unknown>;
  const primarySrc = (
    src.primaryColors && typeof src.primaryColors === 'object' ? src.primaryColors : {}
  ) as Record<string, unknown>;
  const secSrc = (
    src.secondaryColors && typeof src.secondaryColors === 'object' ? src.secondaryColors : {}
  ) as Record<string, unknown>;
  const typoSrc = (
    src.typography && typeof src.typography === 'object' ? src.typography : {}
  ) as Record<string, unknown>;
  const narSrc = (
    src.narrator && typeof src.narrator === 'object' ? src.narrator : {}
  ) as Record<string, unknown>;
  const musicSrc = (src.music && typeof src.music === 'object' ? src.music : {}) as Record<string, unknown>;
  const introSrc = (src.intro && typeof src.intro === 'object' ? src.intro : {}) as Record<string, unknown>;
  const outroSrc = (src.outro && typeof src.outro === 'object' ? src.outro : {}) as Record<string, unknown>;
  const subSrc = (
    src.subtitleStyle && typeof src.subtitleStyle === 'object' ? src.subtitleStyle : {}
  ) as Record<string, unknown>;
  const ltSrc = (
    src.lowerThirdStyle && typeof src.lowerThirdStyle === 'object' ? src.lowerThirdStyle : {}
  ) as Record<string, unknown>;

  const voiceRaw = safeString(narSrc.voice, DEFAULT_BRAND_PRESET.narrator.voice);
  const voice = VALID_VOICES.has(voiceRaw)
    ? (voiceRaw as BrandPreset['narrator']['voice'])
    : DEFAULT_BRAND_PRESET.narrator.voice;

  const fontRaw = safeString(typoSrc.fontFamily, DEFAULT_BRAND_PRESET.typography.fontFamily);
  const fontFamily =
    fontRaw === 'Tajawal' || fontRaw === 'Amiri' || fontRaw === 'Cairo'
      ? fontRaw
      : DEFAULT_BRAND_PRESET.typography.fontFamily;

  return {
    id: safeString(src.id, DEFAULT_BRAND_PRESET.id),
    name: safeString(src.name, DEFAULT_BRAND_PRESET.name),
    presetId: safeString(src.presetId, DEFAULT_BRAND_PRESET.presetId) as PresetId,
    logo: {
      dataUrl: typeof logoSrc.dataUrl === 'string' ? logoSrc.dataUrl : undefined,
      name: typeof logoSrc.name === 'string' ? logoSrc.name : undefined,
      position:
        logoSrc.position === 'topLeft' ||
        logoSrc.position === 'bottomRight' ||
        logoSrc.position === 'bottomLeft' ||
        logoSrc.position === 'custom'
          ? logoSrc.position
          : 'topRight',
      size: clampInt(logoSrc.size, 48, 240, DEFAULT_BRAND_PRESET.logo.size),
    },
    primaryColors: {
      bg: safeString(primarySrc.bg, DEFAULT_BRAND_PRESET.primaryColors.bg),
      accent: safeString(primarySrc.accent, DEFAULT_BRAND_PRESET.primaryColors.accent),
      surface: safeString(primarySrc.surface, DEFAULT_BRAND_PRESET.primaryColors.surface),
      text: safeString(primarySrc.text, DEFAULT_BRAND_PRESET.primaryColors.text),
    },
    secondaryColors: {
      border: safeString(secSrc.border, DEFAULT_BRAND_PRESET.secondaryColors.border),
      correct: safeString(secSrc.correct, DEFAULT_BRAND_PRESET.secondaryColors.correct),
      wrong: safeString(secSrc.wrong, DEFAULT_BRAND_PRESET.secondaryColors.wrong),
    },
    typography: {
      fontFamily,
      headingWeight: clampInt(typoSrc.headingWeight, 600, 900, 800),
    },
    narrator: {
      voice,
      tone: safeString(narSrc.tone, DEFAULT_BRAND_PRESET.narrator.tone),
    },
    music: {
      builtinId: safeString(musicSrc.builtinId, DEFAULT_BRAND_PRESET.music.builtinId),
      volume: clampFloat(musicSrc.volume, 0, 1, DEFAULT_BRAND_PRESET.music.volume),
    },
    intro: {
      enabled: typeof introSrc.enabled === 'boolean' ? introSrc.enabled : true,
      text: safeString(introSrc.text, DEFAULT_BRAND_PRESET.intro.text),
      duration: clampFloat(introSrc.duration, 0.8, 6, 2.2),
      style: introSrc.style === 'channelBumper' ? 'channelBumper' : 'card',
    },
    outro: {
      enabled: typeof outroSrc.enabled === 'boolean' ? outroSrc.enabled : true,
      text: safeString(outroSrc.text, DEFAULT_BRAND_PRESET.outro.text),
      ctaText: safeString(outroSrc.ctaText, DEFAULT_BRAND_PRESET.outro.ctaText),
    },
    subtitleStyle: {
      enabled: typeof subSrc.enabled === 'boolean' ? subSrc.enabled : true,
      style:
        subSrc.style === 'boldYellow' || subSrc.style === 'cleanGlass'
          ? subSrc.style
          : 'pillKaraoke',
      yPct: clampInt(subSrc.yPct, 55, 92, 82),
    },
    lowerThirdStyle: {
      showChannelName:
        typeof ltSrc.showChannelName === 'boolean' ? ltSrc.showChannelName : true,
      channelName: safeString(
        ltSrc.channelName,
        DEFAULT_BRAND_PRESET.lowerThirdStyle.channelName
      ),
      handleText: safeString(ltSrc.handleText, DEFAULT_BRAND_PRESET.lowerThirdStyle.handleText),
      accentColor: safeString(ltSrc.accentColor, DEFAULT_BRAND_PRESET.lowerThirdStyle.accentColor),
    },
  };
}

export function migrateSceneSchema(raw: unknown, fallbackIndex = 0): Scene {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const visualTypeRaw = safeString(src.visualType, 'svg') as SceneVisualType;
  const animRaw = safeString(src.animation, 'zoomIn') as SceneAnimation;
  const moodRaw = safeString(src.mood, 'curious') as SceneMood;
  const transitionRaw = safeString(src.transition, 'fade') as SlideTransitionStyle;

  const onScreenTextRaw = Array.isArray(src.onScreenText)
    ? src.onScreenText.map((t) => String(t ?? '').trim()).filter(Boolean)
    : typeof src.onScreenText === 'string'
      ? src.onScreenText
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

  const fcSrc =
    src.factCheck && typeof src.factCheck === 'object'
      ? (src.factCheck as Record<string, unknown>)
      : undefined;
  const fcStatusRaw = fcSrc ? safeString(fcSrc.status, 'verified') : 'verified';

  let quizOptions: [string, string, string, string] | undefined;
  if (Array.isArray(src.quizOptions) && src.quizOptions.length >= 2) {
    quizOptions = [
      String(src.quizOptions[0] ?? ''),
      String(src.quizOptions[1] ?? ''),
      String(src.quizOptions[2] ?? ''),
      String(src.quizOptions[3] ?? ''),
    ];
  }

  return {
    id: safeString(src.id, `scene-${fallbackIndex + 1}-${Date.now()}`),
    index: clampInt(src.index, 0, 200, fallbackIndex),
    narration: safeString(src.narration, '').trim(),
    onScreenText: onScreenTextRaw.slice(0, 6),
    visualPrompt: safeString(src.visualPrompt, '').trim(),
    visualAssetUrl: typeof src.visualAssetUrl === 'string' ? src.visualAssetUrl : undefined,
    visualType: VALID_VISUAL_TYPES.has(visualTypeRaw) ? visualTypeRaw : 'svg',
    duration: clampFloat(src.duration, 2, 180, 8),
    transition: VALID_TRANSITIONS.has(transitionRaw) ? transitionRaw : 'fade',
    animation: VALID_ANIMATIONS.has(animRaw) ? animRaw : 'zoomIn',
    mood: VALID_MOODS.has(moodRaw) ? moodRaw : 'curious',
    factCheck: fcSrc
      ? {
          status: VALID_FACT_STATUSES.has(fcStatusRaw as FactCheckStatus)
            ? (fcStatusRaw as FactCheckStatus)
            : 'verified',
          confidence: clampFloat(fcSrc.confidence, 0, 1, 0.85),
          flagReason: typeof fcSrc.flagReason === 'string' ? fcSrc.flagReason : undefined,
        }
      : { status: 'verified', confidence: 0.9 },
    quizQuestion: typeof src.quizQuestion === 'string' ? src.quizQuestion : undefined,
    quizOptions,
    quizCorrectIndex:
      typeof src.quizCorrectIndex === 'number'
        ? (clampInt(src.quizCorrectIndex, 0, 3, 0) as 0 | 1 | 2 | 3)
        : undefined,
    quizExplanation: typeof src.quizExplanation === 'string' ? src.quizExplanation : undefined,
  };
}

function migrateThumbnailConcept(raw: unknown, fallbackTitle: string, idx = 0): ThumbnailConcept {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(src.id, `thumb-${idx + 1}`),
    title: safeString(src.title, `مفهوم الغلاف ${idx + 1}`),
    visualPrompt: safeString(src.visualPrompt, `تصميم غلاف احترافي يعبر عن: ${fallbackTitle}`),
    visibleText: safeString(src.visibleText, fallbackTitle.slice(0, 28)),
    accentColor: safeString(src.accentColor, '#d4a73a'),
    previewImageUrl: typeof src.previewImageUrl === 'string' ? src.previewImageUrl : undefined,
  };
}

export function migrateEpisodeSchema(
  raw: unknown,
  seriesId = 'series-legacy',
  fallbackIndex = 0,
  defaultFormat: SeriesFormat = '9:16'
): Episode {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const title = safeString(src.title, `الحلقة ${fallbackIndex + 1}`).trim() || `الحلقة ${fallbackIndex + 1}`;
  const rawScenes = Array.isArray(src.scenes) ? src.scenes : [];
  const scenes = rawScenes.map((sc, i) => migrateSceneSchema(sc, i));
  const computedDuration = scenes.reduce((acc, s) => acc + (s.duration || 8), 0);

  const titleOptionsRaw = Array.isArray(src.titleOptions)
    ? src.titleOptions.map((t) => String(t ?? '').trim()).filter(Boolean)
    : [];
  const titleOptions = titleOptionsRaw.length > 0 ? titleOptionsRaw.slice(0, 4) : [title];

  const thumbConceptsRaw = Array.isArray(src.thumbnailConcepts) ? src.thumbnailConcepts : [];
  const thumbnailConcepts =
    thumbConceptsRaw.length > 0
      ? thumbConceptsRaw.map((t, i) => migrateThumbnailConcept(t, title, i))
      : [migrateThumbnailConcept(src.thumbnail, title, 0)];

  const thumbnail = src.thumbnail
    ? migrateThumbnailConcept(src.thumbnail, title, 0)
    : thumbnailConcepts[0];

  const statusRaw = safeString(src.status, 'ready') as EpisodeStatus;
  const narSrc = (src.narration && typeof src.narration === 'object' ? src.narration : {}) as Record<
    string,
    unknown
  >;
  const voiceRaw = safeString(narSrc.voice, 'Kore');
  const musicSrc = (src.music && typeof src.music === 'object' ? src.music : {}) as Record<
    string,
    unknown
  >;
  const pubSrc = (src.publishKit && typeof src.publishKit === 'object' ? src.publishKit : {}) as Record<
    string,
    unknown
  >;
  const expSrc = (
    src.exportSettings && typeof src.exportSettings === 'object' ? src.exportSettings : {}
  ) as Record<string, unknown>;
  const formatRaw = safeString(expSrc.aspectRatio, defaultFormat) as SeriesFormat;

  const captions = Array.isArray(src.captions)
    ? src.captions.map((c, idx) => {
        const cue = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
        return {
          id: safeString(cue.id, `cue-${idx + 1}`),
          startSec: clampFloat(cue.startSec, 0, 3600, idx * 6),
          endSec: clampFloat(cue.endSec, 0.5, 3660, idx * 6 + 6),
          text: safeString(cue.text, ''),
        };
      })
    : [];

  const verifiedCount = scenes.filter((s) => s.factCheck?.status === 'verified').length;
  const needsReviewCount = scenes.filter((s) => s.factCheck?.status === 'needs_review').length;
  const flaggedScenes = scenes.filter((s) => s.factCheck?.status === 'flagged');
  const flaggedClaims = flaggedScenes
    .map((s) => s.factCheck?.flagReason || s.narration.slice(0, 80))
    .filter(Boolean);

  return {
    id: safeString(src.id, `${seriesId}-ep-${fallbackIndex + 1}`),
    seriesId: safeString(src.seriesId, seriesId),
    index: clampInt(src.index, 0, 500, fallbackIndex),
    title,
    titleOptions,
    hook: safeString(src.hook, scenes[0]?.narration || ''),
    script: safeString(src.script, scenes.map((s) => s.narration).join('\n\n')),
    duration: clampFloat(src.duration, 5, 3600, Math.max(15, computedDuration || 35)),
    status: VALID_STATUSES.has(statusRaw) ? statusRaw : 'ready',
    scenes,
    thumbnail,
    thumbnailConcepts,
    narration: {
      voice: VALID_VOICES.has(voiceRaw)
        ? (voiceRaw as Episode['narration']['voice'])
        : 'Kore',
      rate: clampFloat(narSrc.rate, 0.75, 1.4, 1),
      scriptSummary: safeString(narSrc.scriptSummary, title),
    },
    music: {
      mood: safeString(musicSrc.mood, 'ملهم'),
      trackId: safeString(musicSrc.trackId, 'calmPulse'),
      volume: clampFloat(musicSrc.volume, 0, 1, 0.25),
    },
    captions,
    publishKit: {
      title: safeString(pubSrc.title, title),
      description: safeString(pubSrc.description, ''),
      hashtags: Array.isArray(pubSrc.hashtags)
        ? pubSrc.hashtags.map((h) => String(h)).filter(Boolean)
        : ['#كويز_برو', '#شورتس'],
      tags: Array.isArray(pubSrc.tags) ? pubSrc.tags.map((t) => String(t)).filter(Boolean) : [],
      pinnedComment: safeString(pubSrc.pinnedComment, 'ما أكثر معلومة أدهشتك في هذه الحلقة؟ شاركنا في التعليقات!'),
    },
    exportSettings: {
      format:
        expSrc.format === 'mp4' || expSrc.format === 'webm' ? expSrc.format : 'auto',
      resolution:
        expSrc.resolution === '720p' || expSrc.resolution === '1080p'
          ? expSrc.resolution
          : 'auto',
      aspectRatio: VALID_FORMATS.has(formatRaw) ? formatRaw : defaultFormat,
    },
    projectRef: typeof src.projectRef === 'string' && src.projectRef ? src.projectRef : undefined,
    factReviewSummary: {
      verifiedCount,
      needsReviewCount,
      flaggedCount: flaggedScenes.length,
      flaggedClaims,
    },
    error: typeof src.error === 'string' ? src.error : undefined,
    updatedAt: clampInt(src.updatedAt, 0, Number.MAX_SAFE_INTEGER, Date.now()),
  };
}

export function migrateSeriesSchema(raw: unknown): Series {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const now = Date.now();
  const id = safeString(src.id, `series-${now}-${Math.random().toString(36).slice(2, 6)}`);
  const formatRaw = safeString(src.format, '9:16') as SeriesFormat;
  const format = VALID_FORMATS.has(formatRaw) ? formatRaw : '9:16';
  const styleRaw = safeString(src.stylePreset, 'educational') as SeriesStylePreset;
  const langRaw = safeString(src.language, 'ar') as SeriesLanguage;
  const audienceRaw = safeString(src.audience, 'general') as SeriesAudience;
  const statusRaw = safeString(src.status, 'ready') as SeriesStatus;
  const rawEpisodes = Array.isArray(src.episodes) ? src.episodes : [];

  const migratedEpisodes = rawEpisodes.map((ep, idx) =>
    migrateEpisodeSchema(ep, id, idx, format)
  );

  const topic = safeString(src.topic, safeString(src.name, 'سلسلة فيديو معرفية'));
  const name = safeString(src.name, topic).trim() || 'سلسلة فيديو جديدة';
  const isOpenEnded = Boolean(src.isOpenEnded);
  const scenesPerEpisode = clampInt(src.scenesPerEpisode, 0, 30, 0);

  return {
    id,
    schemaVersion: CURRENT_SERIES_SCHEMA_VERSION,
    name,
    topic,
    prompt: safeString(src.prompt, topic),
    language: VALID_LANGUAGES.has(langRaw) ? langRaw : 'ar',
    audience: VALID_AUDIENCES.has(audienceRaw) ? audienceRaw : 'general',
    status: VALID_STATUSES.has(statusRaw) ? statusRaw : 'ready',
    episodeCount: clampInt(
      src.episodeCount,
      1,
      500,
      migratedEpisodes.length > 0 ? migratedEpisodes.length : 3
    ),
    isOpenEnded,
    scenesPerEpisode,
    targetDurationSec: clampInt(src.targetDurationSec, 15, 600, 45),
    stylePreset: VALID_STYLES.has(styleRaw) ? styleRaw : 'educational',
    brandPreset: migrateBrandPresetSchema(src.brandPreset),
    format,
    episodes: migratedEpisodes,
    activeJobId: typeof src.activeJobId === 'string' ? src.activeJobId : undefined,
    error: typeof src.error === 'string' ? src.error : undefined,
    createdAt: clampInt(src.createdAt, 0, Number.MAX_SAFE_INTEGER, now),
    updatedAt: clampInt(src.updatedAt, 0, Number.MAX_SAFE_INTEGER, now),
  };
}
