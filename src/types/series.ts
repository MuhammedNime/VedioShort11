import { PresetId, ProjectPublishKit, SlideTransitionStyle, TemplateSettings, VideoAspectRatio } from './quiz';

export const CURRENT_SERIES_SCHEMA_VERSION = 1;

export type SeriesStatus =
  | 'queued'
  | 'generating'
  | 'reviewing'
  | 'ready'
  | 'exporting'
  | 'failed';

export type EpisodeStatus = SeriesStatus;

export type SeriesFormat = VideoAspectRatio; // '9:16' | '16:9' | '1:1'

export type SeriesStylePreset =
  | 'educational'
  | 'documentary'
  | 'storytelling'
  | 'quizChallenge'
  | 'fastFacts'
  | 'mythBuster';

export type SeriesLanguage = 'ar' | 'en' | 'bilingual';

export type SeriesAudience =
  | 'general'
  | 'youth'
  | 'kids'
  | 'professionals'
  | 'students';

export type SceneVisualType = 'svg' | 'aiImage' | 'gradient' | 'quizCard';
export type SceneAnimation = 'zoomIn' | 'panLeft' | 'panRight' | 'pulse' | 'fadeIn' | 'pop';
export type SceneMood = 'energetic' | 'curious' | 'dramatic' | 'calm' | 'triumphant';
export type FactCheckStatus = 'verified' | 'needs_review' | 'flagged';

export interface SceneFactCheck {
  status: FactCheckStatus;
  confidence: number; // 0..1
  flagReason?: string;
}

export interface Scene {
  id: string;
  index: number;
  narration: string;
  onScreenText: string[];
  visualPrompt: string;
  visualAssetUrl?: string;
  visualType: SceneVisualType;
  duration: number; // seconds
  transition: SlideTransitionStyle;
  animation: SceneAnimation;
  mood: SceneMood;
  factCheck?: SceneFactCheck;
  // Optional interactive quiz overlay fields when style uses questions/challenges
  quizQuestion?: string;
  quizOptions?: [string, string, string, string];
  quizCorrectIndex?: 0 | 1 | 2 | 3;
  quizExplanation?: string;
}

export interface ThumbnailConcept {
  id: string;
  title: string;
  visualPrompt: string;
  visibleText: string;
  accentColor: string;
  previewImageUrl?: string;
}

export interface EpisodeNarrationConfig {
  voice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  rate: number;
  scriptSummary: string;
}

export interface EpisodeMusicConfig {
  mood: string;
  trackId: string;
  volume: number;
}

export interface EpisodeCaptionCue {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
}

export interface EpisodeExportSettings {
  format: 'auto' | 'mp4' | 'webm';
  resolution: 'auto' | '720p' | '1080p';
  aspectRatio: SeriesFormat;
}

export interface EpisodeFactReviewSummary {
  verifiedCount: number;
  needsReviewCount: number;
  flaggedCount: number;
  flaggedClaims: string[];
}

export interface Episode {
  id: string;
  seriesId: string;
  index: number;
  title: string;
  titleOptions: string[];
  hook: string;
  script: string;
  duration: number;
  status: EpisodeStatus;
  scenes: Scene[];
  thumbnail: ThumbnailConcept;
  thumbnailConcepts: ThumbnailConcept[];
  narration: EpisodeNarrationConfig;
  music: EpisodeMusicConfig;
  captions: EpisodeCaptionCue[];
  publishKit: ProjectPublishKit;
  exportSettings: EpisodeExportSettings;
  projectRef?: string;
  factReviewSummary?: EpisodeFactReviewSummary;
  error?: string;
  updatedAt: number;
}

export interface BrandPreset {
  id: string;
  name: string;
  presetId: PresetId;
  logo: {
    dataUrl?: string;
    name?: string;
    position: TemplateSettings['brandLogoPosition'];
    size: number;
  };
  primaryColors: {
    bg: string;
    accent: string;
    surface: string;
    text: string;
  };
  secondaryColors: {
    border: string;
    correct: string;
    wrong: string;
  };
  typography: {
    fontFamily: TemplateSettings['fontFamily'];
    headingWeight: number;
  };
  narrator: {
    voice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
    tone: string;
  };
  music: {
    builtinId: string;
    volume: number;
  };
  intro: {
    enabled: boolean;
    text: string;
    duration: number;
    style: 'card' | 'channelBumper';
  };
  outro: {
    enabled: boolean;
    text: string;
    ctaText: string;
  };
  subtitleStyle: {
    enabled: boolean;
    style: 'pillKaraoke' | 'boldYellow' | 'cleanGlass';
    yPct: number;
  };
  lowerThirdStyle: {
    showChannelName: boolean;
    channelName: string;
    handleText: string;
    accentColor: string;
  };
}

export interface Series {
  id: string;
  schemaVersion: number;
  name: string;
  topic: string;
  prompt: string;
  language: SeriesLanguage;
  audience: SeriesAudience;
  status: SeriesStatus;
  episodeCount: number;
  isOpenEnded?: boolean;
  scenesPerEpisode?: number; // 0 or undefined = auto based on duration; 1..30 = user-defined scenes per episode
  targetDurationSec: number;
  stylePreset: SeriesStylePreset;
  brandPreset: BrandPreset;
  format: SeriesFormat;
  episodes: Episode[];
  activeJobId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GenerationJob {
  id: string;
  seriesId: string;
  type: 'fullSeries' | 'episode' | 'scene' | 'assets' | 'export';
  status: SeriesStatus;
  progress: number; // 0..100
  stageLabel: string;
  completedEpisodes: number;
  totalEpisodes: number;
  failedEpisodeIds: string[];
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSeriesRequest {
  topic: string;
  stylePreset: SeriesStylePreset;
  language: SeriesLanguage;
  audience: SeriesAudience;
  targetDurationSec: number;
  episodeCount: number;
  isOpenEnded?: boolean;
  scenesPerEpisode?: number;
  initialBatchCount?: number;
  format: SeriesFormat;
  brandPresetId?: string;
  brandPreset?: BrandPreset;
}

export interface AppendEpisodesRequest {
  count: number;
  focusTopic?: string;
  scenesPerEpisode?: number;
}

export const SERIES_STYLE_OPTIONS: Array<{
  id: SeriesStylePreset;
  label: string;
  subtitle: string;
  badge: string;
}> = [
  {
    id: 'educational',
    label: 'تعليمي مبسط',
    subtitle: 'شرح مركز، حقائق متدرجة، ونص بصري واضح على الشاشة',
    badge: 'الأكثر شيوعاً',
  },
  {
    id: 'storytelling',
    label: 'قصصي مشوق',
    subtitle: 'سرد درامي يبدأ بخطاف قوي ويغلق بنهاية لا تُنسى',
    badge: 'تفاعل عالٍ',
  },
  {
    id: 'quizChallenge',
    label: 'تحدي ومسابقات',
    subtitle: 'أسئلة تفاعلية بخيارات ومؤقت تنازلي متوافق مع الاستوديو المتقدم',
    badge: 'جاهز للكويز',
  },
  {
    id: 'documentary',
    label: 'وثائقي قصير',
    subtitle: 'نبرة رصينة مع مشاهد بصرية غنية وتحقق دقيق من المعلومات',
    badge: 'عمق معرفي',
  },
  {
    id: 'fastFacts',
    label: 'حقائق سريعة',
    subtitle: 'إيقاع سريع ومكثف مثالي لمشاهدات الشورتس والريلز',
    badge: 'إيقاع سريع',
  },
  {
    id: 'mythBuster',
    label: 'تصحيح المفاهيم',
    subtitle: 'كشف الشائعات والمعتقدات الخاطئة بالدليل والتفسير',
    badge: 'فضول وبحث',
  },
];

export const SERIES_AUDIENCE_OPTIONS: Array<{
  id: SeriesAudience;
  label: string;
}> = [
  { id: 'general', label: 'الجمهور العام' },
  { id: 'youth', label: 'الشباب وصناع المحتوى' },
  { id: 'students', label: 'الطلاب والمتعلمون' },
  { id: 'professionals', label: 'المهنيون ورواد الأعمال' },
  { id: 'kids', label: 'الأطفال والناشئة' },
];

export const SERIES_LANGUAGE_OPTIONS: Array<{
  id: SeriesLanguage;
  label: string;
}> = [
  { id: 'ar', label: 'العربية الفصحى السلسة' },
  { id: 'bilingual', label: 'عربية + مصطلحات إنجليزية' },
  { id: 'en', label: 'الإنجليزية (English)' },
];

export const SERIES_EXAMPLE_PROMPTS: Array<{
  title: string;
  topic: string;
  stylePreset: SeriesStylePreset;
  episodeCount: number;
  isOpenEnded?: boolean;
  scenesPerEpisode?: number;
  targetDurationSec: number;
  format: SeriesFormat;
  audience: SeriesAudience;
}> = [
  {
    title: 'سلسلة السيرة النبوية (100 حلقة)',
    topic: 'السيرة النبوية الكاملة وقصص النبي محمد ﷺ خطوة بخطوة من المولد إلى الوفاة بأسلوب قصصي موثق',
    stylePreset: 'storytelling',
    episodeCount: 100,
    isOpenEnded: false,
    scenesPerEpisode: 8,
    targetDurationSec: 60,
    format: '9:16',
    audience: 'general',
  },
  {
    title: 'سلسلة كرة القدم وأساطير المونديال',
    topic: 'أعظم المباريات واللحظات التاريخية واللاعبين الذين صنعوا مجد كرة القدم العالمية',
    stylePreset: 'documentary',
    episodeCount: 20,
    isOpenEnded: true,
    scenesPerEpisode: 8,
    targetDurationSec: 60,
    format: '9:16',
    audience: 'youth',
  },
  {
    title: 'تحدي عواصم ومعالم العالم',
    topic: 'تحدي جغرافي ذكي: هل تعرف الدولة من 3 حقائق ومعلومة خفية؟',
    stylePreset: 'quizChallenge',
    episodeCount: 5,
    scenesPerEpisode: 6,
    targetDurationSec: 45,
    format: '9:16',
    audience: 'youth',
  },
  {
    title: 'أسرار الحضارة الأندلسية',
    topic: 'اختراعات وعلماء غيروا العالم في الأندلس — من الزهراوي إلى عباس بن فرناس',
    stylePreset: 'documentary',
    episodeCount: 10,
    scenesPerEpisode: 7,
    targetDurationSec: 45,
    format: '16:9',
    audience: 'general',
  },
];
