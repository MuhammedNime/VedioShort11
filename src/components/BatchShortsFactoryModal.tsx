import React, { useEffect, useState, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Factory,
  Film,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Volume2,
  X,
  Youtube,
} from 'lucide-react';
import { exportCustomThumbnailBlob } from '../canvas/thumbnailRenderer';
import { exportQuizVideo } from '../canvas/videoExporter';
import {
  AiVoiceMode,
  AiVoiceName,
  GeneratedSeriesResult,
  SERIES_PRESETS,
  SeriesPresetId,
  generateConnectedQuizSeries,
  generateSlideVoiceoverSafe,
} from '../services/aiClient';
import { updateCloudBankQuestionsUsedBatch } from '../services/firebaseClient';
import {
  YouTubePrivacyStatus,
  getCachedYouTubeSession,
  uploadVideoToYouTube,
} from '../services/youtubeClient';
import {
  CustomTemplatePreset,
  loadCustomPresets,
  loadCustomPresetsAsync,
} from '../storage/customPresets';
import { saveProjectsToLibraryBatch } from '../storage/projectStore';
import {
  BankQuestionItem,
  bankItemToQuestionSlide,
  markBankQuestionsUsed,
} from '../storage/questionBankVault';
import {
  DEFAULT_TEMPLATE,
  PRESENTER_PORTRAIT_URLS,
  PresenterStyle,
  PresetId,
  QuestionSlide,
  QuizProject,
  STUDIO_THEME_ORDER,
  TemplateSettings,
  applyChannelThemePreset,
  applyCustomTemplateSettings,
  applyStudioThemePreset,
  createDefaultProject,
} from '../types/quiz';
import { getThemeEntryById } from '../types/themesCatalog';
import { DuplicateMatchItem, findDuplicateMatches } from '../utils/duplicateDetector';
import { saveOrDownloadBlob } from '../utils/nativeDownload';
import { DuplicateDecision, DuplicateWarningBanner } from './DuplicateWarningBanner';
import { MiniThemeStagePreview, ThemesLibraryModal } from './ThemesLibraryModal';

interface BatchShortsFactoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolItems: BankQuestionItem[];
  seriesLabel: string;
  voiceName: AiVoiceName;
  cloudUser: User | null;
  activeTemplate?: TemplateSettings;
  ytConnected?: boolean;
  currentProjectSlides?: QuestionSlide[];
  onCreated: (noticeMessage: string) => void;
}

type FactoryThemeMode = 'autoRotate' | 'singleTheme' | 'smartByCategory';
type FactorySourceMode = 'pool' | 'series';
type FactoryStep = 'setup' | 'review';

interface FactoryDraftEpisode {
  id: string;
  episodeNumber: number;
  name: string;
  slides: QuestionSlide[];
  template: TemplateSettings;
  timing: QuizProject['timing'];
  audio: QuizProject['audio'];
  cliffhangerText: string;
  youtubeTitle: string;
  youtubeDescription: string;
  youtubePinnedComment: string;
  themeLabel: string;
  sourceBankIds: string[];
  sourceBankItems: BankQuestionItem[];
  uploadedVideoUrl?: string;
  thumbnailBlob?: Blob;
  thumbnailDataUrl?: string;
}

const ROTATE_THEMES: PresetId[] = [
  'darkCinematic',
  'luxuryGold',
  'quizProSignature',
  'neonCyber',
  'gamingArena',
  'scienceLab',
  'islamicAndalusian',
  'tokyoDrift',
  'luxuryMarble',
  'cosmicSpace',
  'stadiumArena',
  'techBlue',
  'natureEmerald',
  'modernStudio',
  'bookArchive',
  'mysteryVault',
  'vintageClassic',
  'goldenQuizShow',
  'millionaire',
];

function mergeChannelBrandIdentity(
  target: TemplateSettings,
  source?: TemplateSettings
): TemplateSettings {
  if (!source) return target;
  return {
    ...target,
    brandLogoDataUrl: source.brandLogoDataUrl ?? target.brandLogoDataUrl,
    brandLogoName: source.brandLogoName ?? target.brandLogoName,
    brandChannelName: source.brandChannelName ?? target.brandChannelName,
    showChannelName: source.showChannelName ?? target.showChannelName,
    brandHandleText: source.brandHandleText ?? target.brandHandleText,
    brandAccentColor: source.brandAccentColor ?? target.brandAccentColor,
    brandLogoPosition: source.brandLogoPosition ?? target.brandLogoPosition,
    brandLogoX: source.brandLogoX ?? target.brandLogoX,
    brandLogoY: source.brandLogoY ?? target.brandLogoY,
    brandLogoSize: source.brandLogoSize ?? target.brandLogoSize,
    brandLogoAnim: source.brandLogoAnim ?? target.brandLogoAnim,
    brandOpacity: source.brandOpacity ?? target.brandOpacity,
  };
}

function defaultScheduleDateTimeLocal(): string {
  const dt = new Date(Date.now() + 2 * 3600_000);
  dt.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
    dt.getHours()
  )}:${pad(dt.getMinutes())}`;
}

export const BatchShortsFactoryModal: React.FC<BatchShortsFactoryModalProps> = ({
  isOpen,
  onClose,
  poolItems,
  seriesLabel,
  voiceName,
  cloudUser,
  activeTemplate,
  ytConnected,
  currentProjectSlides,
  onCreated,
}) => {
  const [step, setStep] = useState<FactoryStep>('setup');
  const [sourceMode, setSourceMode] = useState<FactorySourceMode>('pool');

  // Pool mode state
  const [episodeCount, setEpisodeCount] = useState(5);
  const [perEpisode, setPerEpisode] = useState(3);

  // Connected 1-click Series mode state
  const [seriesPresetId, setSeriesPresetId] = useState<SeriesPresetId>('seerah');
  const [seriesCustomTopic, setSeriesCustomTopic] = useState('');
  const [seriesEpisodeCount, setSeriesEpisodeCount] = useState(4);
  const [seriesPerEpisode, setSeriesPerEpisode] = useState(3);
  const [seriesDifficulty, setSeriesDifficulty] = useState<'سهل' | 'متوسط' | 'صعب' | 'متنوع'>('متوسط');
  const [includeCliffhanger, setIncludeCliffhanger] = useState(true);
  const [isGeneratingSeries, setIsGeneratingSeries] = useState(false);

  // Duplicate detection state before entering review
  const [dupMatches, setDupMatches] = useState<DuplicateMatchItem[]>([]);
  const [dupDecisions, setDupDecisions] = useState<Record<number, DuplicateDecision>>({});
  const [pendingSeriesResult, setPendingSeriesResult] = useState<GeneratedSeriesResult | null>(null);
  const [pendingPoolChunks, setPendingPoolChunks] = useState<BankQuestionItem[][] | null>(null);

  // Shared design / channel identity / presenter / audio options
  const [themeMode, setThemeMode] = useState<FactoryThemeMode>('autoRotate');
  const [selectedFactoryTemplate, setSelectedFactoryTemplate] = useState<TemplateSettings>(() =>
    applyStudioThemePreset(DEFAULT_TEMPLATE, 'darkCinematic')
  );
  const [selectedThemeLabel, setSelectedThemeLabel] = useState('السينمائي الداكن');
  const [savedCustomThemes, setSavedCustomThemes] = useState<CustomTemplatePreset[]>(() =>
    loadCustomPresets()
  );
  const [isThemesLibraryOpen, setIsThemesLibraryOpen] = useState(false);
  const [themesTargetEpisodeIdx, setThemesTargetEpisodeIdx] = useState<number | null>(null);

  const [inheritChannelIdentity, setInheritChannelIdentity] = useState(true);
  const [enablePresenter, setEnablePresenter] = useState(true);
  const [presenterStyle, setPresenterStyle] = useState<PresenterStyle>('stylized3d');
  const [escalatingSpeed, setEscalatingSpeed] = useState(true);
  const [enableFlashTeaser, setEnableFlashTeaser] = useState(true);
  const [enableScoreboard, setEnableScoreboard] = useState(true);

  const [autoGenerateTts, setAutoGenerateTts] = useState(false);
  const [ttsVoiceMode, setTtsVoiceMode] = useState<AiVoiceMode>('questionAndAnswer');
  const [autoGenerateThumbnails, setAutoGenerateThumbnails] = useState(true);
  const [thumbnailAspect, setThumbnailAspect] = useState<'9:16' | '16:9'>('9:16');
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState(false);

  // Review & per-episode editing
  const [draftEpisodes, setDraftEpisodes] = useState<FactoryDraftEpisode[]>([]);
  const [expandedEpisodeIdx, setExpandedEpisodeIdx] = useState<number>(0);

  // Honest YouTube upload / schedule options
  const [ytPrivacy, setYtPrivacy] = useState<YouTubePrivacyStatus>('private');
  const [useBatchSchedule, setUseBatchSchedule] = useState(false);
  const [scheduleStartLocal, setScheduleStartLocal] = useState<string>(() =>
    defaultScheduleDateTimeLocal()
  );
  const [scheduleIntervalHours, setScheduleIntervalHours] = useState(24);

  const [isRunning, setIsRunning] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    void loadCustomPresetsAsync().then(setSavedCustomThemes).catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const unusedPool = poolItems.filter((it) => !it.usedInVideo);
  const effectivePool = unusedPool.length > 0 ? unusedPool : poolItems;
  const maxPossibleEpisodes = Math.max(1, effectivePool.length);

  const hasActiveIdentity = Boolean(
    activeTemplate?.brandLogoDataUrl ||
      activeTemplate?.brandChannelName?.trim() ||
      activeTemplate?.brandHandleText?.trim()
  );
  const liveYtConnected = Boolean(ytConnected || getCachedYouTubeSession().connected);

  const resolveSmartThemeForChunk = (chunk: BankQuestionItem[], baseTpl: TemplateSettings) => {
    if (chunk.some((it) => it.category === 'math')) {
      return { tpl: applyChannelThemePreset(baseTpl, 'channelMath'), label: 'سبورة الرياضيات' };
    }
    if (chunk.some((it) => it.category === 'islamic')) {
      return { tpl: applyStudioThemePreset(baseTpl, 'islamicAndalusian'), label: 'أندلسي وفوانيس' };
    }
    if (chunk.some((it) => it.category === 'science')) {
      return { tpl: applyStudioThemePreset(baseTpl, 'scienceLab'), label: 'المختبر العلمي' };
    }
    if (chunk.some((it) => it.category === 'sports')) {
      return { tpl: applyStudioThemePreset(baseTpl, 'stadiumArena'), label: 'ملعب الأبطال' };
    }
    if (chunk.some((it) => it.category === 'technology')) {
      return { tpl: applyStudioThemePreset(baseTpl, 'techBlue'), label: 'الأزرق التقني' };
    }
    if (chunk.some((it) => it.category === 'history')) {
      return { tpl: applyStudioThemePreset(baseTpl, 'ancientHistory'), label: 'كنوز التاريخ' };
    }
    if (chunk.some((it) => it.category === 'literature')) {
      return { tpl: applyStudioThemePreset(baseTpl, 'bookArchive'), label: 'أرشيف الكتب' };
    }
    return { tpl: applyStudioThemePreset(baseTpl, 'darkCinematic'), label: 'السينمائي الداكن' };
  };

  const buildTemplateForEpisodeIndex = (
    epIdx: number,
    baseTpl: TemplateSettings,
    smartChunk?: BankQuestionItem[],
    preferredPresetId?: PresetId
  ): { template: TemplateSettings; themeLabel: string } => {
    let epTemplate = baseTpl;
    let themeLabel = selectedThemeLabel;

    if (preferredPresetId) {
      epTemplate = applyStudioThemePreset(epTemplate, preferredPresetId);
      themeLabel = getThemeEntryById(preferredPresetId, epTemplate.aspectRatio).meta.name;
    } else if (themeMode === 'singleTheme') {
      epTemplate = applyCustomTemplateSettings(epTemplate, selectedFactoryTemplate, {
        preserveChannelIdentity: false,
        preserveLayoutPositions: false,
      });
      themeLabel = selectedThemeLabel;
    } else if (themeMode === 'autoRotate') {
      const themeId = ROTATE_THEMES[epIdx % ROTATE_THEMES.length];
      epTemplate = applyStudioThemePreset(epTemplate, themeId);
      themeLabel = getThemeEntryById(themeId, epTemplate.aspectRatio).meta.name;
    } else if (smartChunk) {
      const smart = resolveSmartThemeForChunk(smartChunk, epTemplate);
      epTemplate = smart.tpl;
      themeLabel = smart.label;
    } else {
      const themeId = ROTATE_THEMES[epIdx % ROTATE_THEMES.length];
      epTemplate = applyStudioThemePreset(epTemplate, themeId);
      themeLabel = getThemeEntryById(themeId, epTemplate.aspectRatio).meta.name;
    }

    if (inheritChannelIdentity && activeTemplate) {
      epTemplate = mergeChannelBrandIdentity(epTemplate, activeTemplate);
    }

    epTemplate = {
      ...epTemplate,
      showIntroHook: true,
      introFlashTeaser: enableFlashTeaser,
      showEndCard: true,
      showEndSubscribeCta: true,
      showProgressCounter: true,
      showVideoProgressBar: true,
      showLiveScoreboard: enableScoreboard,
      presenterEnabled: enablePresenter,
      presenterStyle,
      presenterIntroFullscreen: true,
      presenterOutroFullscreen: true,
    };

    return { template: epTemplate, themeLabel };
  };

  const computePoolChunks = (): BankQuestionItem[][] => {
    const safeCount = Math.min(episodeCount, effectivePool.length);
    const chunkSize = Math.max(
      1,
      Math.min(perEpisode, Math.floor(effectivePool.length / Math.max(1, safeCount)))
    );
    const chunks: BankQuestionItem[][] = [];
    for (let ep = 0; ep < safeCount; ep++) {
      const start = ep * chunkSize;
      const chunk = effectivePool.slice(start, start + chunkSize);
      if (chunk.length > 0) chunks.push(chunk);
    }
    return chunks;
  };

  const buildDraftsFromPoolChunks = (chunks: BankQuestionItem[][]): FactoryDraftEpisode[] => {
    const baseTime = Date.now();
    return chunks.map((chunk, ep) => {
      const baseProj = createDefaultProject();
      const slides = chunk.map((it) => bankItemToQuestionSlide(it));
      const { template, themeLabel } = buildTemplateForEpisodeIndex(ep, baseProj.template, chunk);
      const title = `${seriesLabel} — حلقة ${ep + 1}`;
      return {
        id: `factory-${baseTime}-${ep + 1}`,
        episodeNumber: ep + 1,
        name: title,
        slides,
        template,
        timing: { ...baseProj.timing, escalatingSpeed },
        audio: baseProj.audio,
        cliffhangerText: '',
        youtubeTitle: `${title} #Shorts`,
        youtubeDescription: `${title}\nاختبر معلوماتك الآن واكتب نتيجتك في التعليقات!`,
        youtubePinnedComment: 'كم سؤالاً أجبت عنه بشكل صحيح؟ اكتب نتيجتك 👇',
        themeLabel,
        sourceBankIds: chunk.map((it) => it.id),
        sourceBankItems: chunk,
      };
    });
  };

  const buildDraftsFromSeriesResult = (
    res: GeneratedSeriesResult,
    skippedSlideKeys?: Set<string>
  ): FactoryDraftEpisode[] => {
    const baseTime = Date.now();
    const presetMeta = SERIES_PRESETS.find((p) => p.id === seriesPresetId);
    const preferredPresetId: PresetId | undefined =
      seriesPresetId === 'seerah' ||
      seriesPresetId === 'prophets' ||
      seriesPresetId === 'friday'
        ? 'islamicAndalusian'
        : seriesPresetId === 'sahaba'
          ? 'luxuryGold'
          : seriesPresetId === 'history'
            ? 'ancientHistory'
            : seriesPresetId === 'science'
              ? 'scienceLab'
              : undefined;

    let flatIdx = 0;
    const drafts: FactoryDraftEpisode[] = [];
    res.episodes.forEach((ep, epIdx) => {
      const keptSlides: QuestionSlide[] = [];
      ep.slides.forEach((sl) => {
        const key = String(flatIdx);
        flatIdx += 1;
        if (skippedSlideKeys?.has(key)) return;
        keptSlides.push(sl);
      });
      if (keptSlides.length === 0) return;

      const baseProj = createDefaultProject();
      const { template, themeLabel } = buildTemplateForEpisodeIndex(
        epIdx,
        baseProj.template,
        undefined,
        themeMode === 'smartByCategory' ? preferredPresetId : undefined
      );
      const cliffText = includeCliffhanger ? (ep.cliffhangerText || '').trim() : '';
      if (cliffText && keptSlides.length > 0) {
        keptSlides[keptSlides.length - 1] = {
          ...keptSlides[keptSlides.length - 1],
          episodeCliffhanger: cliffText,
        };
      }
      const epName = ep.title || `${presetMeta?.label || res.seriesTitle} — الحلقة ${epIdx + 1}`;
      drafts.push({
        id: `series-${baseTime}-${epIdx + 1}`,
        episodeNumber: ep.episodeNumber || epIdx + 1,
        name: epName,
        slides: keptSlides,
        template,
        timing: { ...baseProj.timing, escalatingSpeed },
        audio: baseProj.audio,
        cliffhangerText: cliffText,
        youtubeTitle: (ep.youtubeTitle || `${epName} #Shorts`).slice(0, 100),
        youtubeDescription:
          ep.youtubeDescription || `${epName}\n${ep.subtitle || ''}\n#Shorts #مسابقات`,
        youtubePinnedComment:
          ep.youtubePinnedComment || 'ما السؤال الذي فاجأك أكثر في هذه الحلقة؟ 👇',
        themeLabel,
        sourceBankIds: [],
        sourceBankItems: [],
      });
    });

    return drafts;
  };

  const renderThumbnailForEpisode = async (
    ep: FactoryDraftEpisode,
    aspectOverride?: '9:16' | '16:9'
  ): Promise<{ blob: Blob; dataUrl: string } | null> => {
    const leadSlide = ep.slides[0];
    return await exportCustomThumbnailBlob(
      ep.template,
      leadSlide,
      {
        aspectRatio: aspectOverride || thumbnailAspect,
        headline: (leadSlide?.question || ep.name || 'تحدي الأسئلة').trim(),
        subline: (ep.cliffhangerText || 'اختبر ذكاءك واكتب نتيجتك 👇').trim(),
        badgeText: (leadSlide?.badgeText || `حلقة ${ep.episodeNumber} 🔥`).trim(),
        badgeBgColor: ep.template.badgeBgColor || ep.template.brandAccentColor || '#F59E0B',
        headlineColor: '#FFFFFF',
        includeSlideImage: Boolean(leadSlide?.imageDataUrl),
        blurSlideImage: false,
      },
      'image/jpeg'
    );
  };

  const generateThumbnailsForEpisodesList = async (episodes: FactoryDraftEpisode[]) => {
    if (episodes.length === 0) return;
    setIsGeneratingThumbs(true);
    try {
      const updated = [...episodes];
      for (let i = 0; i < updated.length; i++) {
        const res = await renderThumbnailForEpisode(updated[i]);
        if (res) {
          updated[i] = {
            ...updated[i],
            thumbnailBlob: res.blob,
            thumbnailDataUrl: res.dataUrl,
          };
          setDraftEpisodes([...updated]);
        }
      }
    } catch {
      // ignore individual thumb errors
    } finally {
      setIsGeneratingThumbs(false);
    }
  };

  const enterReviewWithDrafts = (drafts: FactoryDraftEpisode[]) => {
    setDraftEpisodes(drafts);
    setExpandedEpisodeIdx(0);
    setStep('review');
    if (autoGenerateThumbnails && drafts.length > 0) {
      void generateThumbnailsForEpisodesList(drafts);
    }
  };

  const handlePreparePoolReview = async () => {
    if (effectivePool.length === 0) {
      setErrorMsg('لا توجد أسئلة متاحة في المجلد أو الفلتر الحالي.');
      return;
    }
    setErrorMsg('');
    const chunks = computePoolChunks();
    const flatQuestions = chunks.flat().map((it) => it.question);
    try {
      const matches = await findDuplicateMatches(flatQuestions, {
        currentSlides: currentProjectSlides,
        includeBank: false,
        includeSavedProjects: true,
        threshold: 0.62,
      });
      if (matches.length > 0) {
        const initDecisions: Record<number, DuplicateDecision> = {};
        matches.forEach((m) => {
          initDecisions[m.candidateIndex] = 'pending';
        });
        setPendingPoolChunks(chunks);
        setPendingSeriesResult(null);
        setDupMatches(matches);
        setDupDecisions(initDecisions);
        return;
      }
    } catch {
      // proceed smoothly
    }
    enterReviewWithDrafts(buildDraftsFromPoolChunks(chunks));
  };

  const handleGenerateOneClickSeries = async () => {
    if (isGeneratingSeries || isRunning) return;
    setErrorMsg('');
    setIsGeneratingSeries(true);
    setDupMatches([]);
    setPendingSeriesResult(null);
    setPendingPoolChunks(null);

    try {
      const result = await generateConnectedQuizSeries({
        presetId: seriesPresetId,
        customTopic: seriesCustomTopic.trim() || undefined,
        episodeCount: seriesEpisodeCount,
        questionsPerEpisode: seriesPerEpisode,
        difficulty: seriesDifficulty,
        includeCliffhanger,
        extraAvoidQuestions: currentProjectSlides?.map((s) => s.question),
      });

      const flatQuestions = result.episodes.flatMap((ep) => ep.slides.map((s) => s.question));
      const matches = await findDuplicateMatches(flatQuestions, {
        currentSlides: currentProjectSlides,
        includeBank: true,
        includeSavedProjects: true,
        threshold: 0.6,
      });

      if (matches.length > 0) {
        const initDecisions: Record<number, DuplicateDecision> = {};
        matches.forEach((m) => {
          initDecisions[m.candidateIndex] = 'pending';
        });
        setPendingSeriesResult(result);
        setPendingPoolChunks(null);
        setDupMatches(matches);
        setDupDecisions(initDecisions);
      } else {
        const drafts = buildDraftsFromSeriesResult(result);
        enterReviewWithDrafts(drafts);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر توليد السلسلة المترابطة.');
    } finally {
      setIsGeneratingSeries(false);
    }
  };

  const handleApplyDuplicateDecisions = () => {
    const skippedIndices = new Set<number>();
    dupMatches.forEach((m) => {
      if (dupDecisions[m.candidateIndex] === 'skip') {
        skippedIndices.add(m.candidateIndex);
      }
    });

    if (pendingSeriesResult) {
      const skippedKeys = new Set(Array.from(skippedIndices).map(String));
      const drafts = buildDraftsFromSeriesResult(pendingSeriesResult, skippedKeys);
      if (drafts.length === 0) {
        setErrorMsg('تم استبعاد جميع الأسئلة المكررة ولم تتبق حلقات صالحة.');
        return;
      }
      enterReviewWithDrafts(drafts);
    } else if (pendingPoolChunks) {
      let flatIdx = 0;
      const filteredChunks = pendingPoolChunks
        .map((chunk) =>
          chunk.filter(() => {
            const keep = !skippedIndices.has(flatIdx);
            flatIdx += 1;
            return keep;
          })
        )
        .filter((c) => c.length > 0);
      if (filteredChunks.length === 0) {
        setErrorMsg('تم استبعاد جميع الأسئلة المكررة ولم تتبق حلقات.');
        return;
      }
      enterReviewWithDrafts(buildDraftsFromPoolChunks(filteredChunks));
    }

    setDupMatches([]);
    setDupDecisions({});
    setPendingSeriesResult(null);
    setPendingPoolChunks(null);
  };

  const resolveCurrentDrafts = (): FactoryDraftEpisode[] => {
    if (step === 'review' && draftEpisodes.length > 0) return draftEpisodes;
    return buildDraftsFromPoolChunks(computePoolChunks());
  };

  const enrichDraftsWithTtsIfEnabled = async (
    episodes: FactoryDraftEpisode[],
    signal?: AbortSignal
  ): Promise<{ enriched: FactoryDraftEpisode[]; ttsWarning?: string }> => {
    if (!autoGenerateTts) {
      return { enriched: episodes };
    }
    const totalSlides = episodes.reduce((acc, ep) => acc + ep.slides.length, 0);
    let doneSlides = 0;
    let quotaHitWarning = '';
    const out: FactoryDraftEpisode[] = [];

    for (let eIdx = 0; eIdx < episodes.length; eIdx++) {
      const ep = episodes[eIdx];
      const nextSlides: QuestionSlide[] = [];
      for (let sIdx = 0; sIdx < ep.slides.length; sIdx++) {
        const sl = ep.slides[sIdx];
        if (signal?.aborted || quotaHitWarning) {
          nextSlides.push(sl);
          continue;
        }
        setStatusLabel(
          `توليد الصوت العربي المضبوط: حلقة ${eIdx + 1}/${episodes.length} · سؤال ${sIdx + 1}`
        );
        const res = await generateSlideVoiceoverSafe(sl, voiceName, ttsVoiceMode);
        nextSlides.push(res.slide);
        if (res.quotaExhausted || res.warning) {
          quotaHitWarning =
            res.warning || 'انتهت حصة الصوت المجانية — تم استكمال باقي الحلقات بدون تعليق صوتي.';
        }
        doneSlides += 1;
        setProgressPct(Math.round((doneSlides / Math.max(1, totalSlides)) * 35));
      }
      out.push({ ...ep, slides: nextSlides });
    }
    return { enriched: out, ttsWarning: quotaHitWarning || undefined };
  };

  const toQuizProjects = (episodes: FactoryDraftEpisode[]): QuizProject[] =>
    episodes.map((ep, idx) => ({
      ...createDefaultProject(),
      id: ep.id,
      name: ep.name,
      preferredAiVoice: voiceName,
      slides: ep.slides,
      template: ep.template,
      timing: ep.timing,
      audio: ep.audio,
      updatedAt: Date.now() + idx,
    }));

  const markPoolItemsUsedIfAny = async (episodes: FactoryDraftEpisode[]) => {
    const usedIds = episodes.flatMap((e) => e.sourceBankIds);
    const usedItems = episodes.flatMap((e) => e.sourceBankItems);
    if (usedIds.length > 0) {
      await markBankQuestionsUsed(usedIds, true);
      if (cloudUser) {
        void updateCloudBankQuestionsUsedBatch(usedIds, true, usedItems).catch(() => {});
      }
    }
    return usedIds.length;
  };

  const handleSaveBatchProjects = async () => {
    if (isRunning) return;
    const rawDrafts = resolveCurrentDrafts();
    if (rawDrafts.length === 0) {
      setErrorMsg('لا توجد حلقات جاهزة للحفظ.');
      return;
    }
    setErrorMsg('');
    setIsRunning(true);
    setProgressPct(5);
    setStatusLabel('جارٍ تجهيز وحفظ الحلقات في مكتبة المشاريع...');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { enriched, ttsWarning } = await enrichDraftsWithTtsIfEnabled(
        rawDrafts,
        controller.signal
      );
      const projects = toQuizProjects(enriched);
      await saveProjectsToLibraryBatch(projects);
      await markPoolItemsUsedIfAny(enriched);
      const totalQ = enriched.reduce((acc, e) => acc + e.slides.length, 0);
      onCreated(
        `تم إنتاج وحفظ ${projects.length} حلقات (${totalQ} سؤالاً) بنجاح!${
          ttsWarning ? ` (${ttsWarning})` : ''
        }`
      );
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حفظ سلسلة الحلقات.');
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  };

  const handleBatchExportVideos = async () => {
    if (isRunning) return;
    const rawDrafts = resolveCurrentDrafts();
    if (rawDrafts.length === 0) {
      setErrorMsg('لا توجد حلقات جاهزة للتصدير.');
      return;
    }
    setErrorMsg('');
    setIsRunning(true);
    setProgressPct(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { enriched, ttsWarning } = await enrichDraftsWithTtsIfEnabled(
        rawDrafts,
        controller.signal
      );
      const projects = toQuizProjects(enriched);
      await saveProjectsToLibraryBatch(projects);
      await markPoolItemsUsedIfAny(enriched);

      const baseProgress = autoGenerateTts ? 35 : 0;
      const exportWeight = 100 - baseProgress;

      let exportedCount = 0;
      for (let i = 0; i < projects.length; i++) {
        if (controller.signal.aborted) break;
        const ep = projects[i];
        setStatusLabel(`تصدير الحلقة ${i + 1} من ${projects.length}: ${ep.name}`);

        const result = await exportQuizVideo(
          ep.slides,
          ep.template,
          ep.timing,
          ep.audio,
          (p) => {
            const overall = baseProgress + ((i + p.progress) / projects.length) * exportWeight;
            setProgressPct(Math.round(overall));
          },
          controller.signal,
          { formatPreference: 'auto', resolutionPreference: '720p', includeAudio: true }
        );

        const safeFile = `${ep.name.replace(/[^\w\u0600-\u06FF-]+/g, '-')}.${result.extension}`;
        await saveOrDownloadBlob(result.blob, safeFile, result.mimeType);
        exportedCount += 1;
      }

      onCreated(
        `تم حفظ ${projects.length} حلقات وتصدير ${exportedCount} ملفات فيديو متتالية بنجاح!${
          ttsWarning ? ` (${ttsWarning})` : ''
        }`
      );
      onClose();
    } catch (err) {
      if (!controller.signal.aborted) {
        setErrorMsg(err instanceof Error ? err.message : 'توقف التصدير المتتالي.');
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  };

  const handleBatchUploadToYouTube = async () => {
    if (isRunning) return;
    if (!liveYtConnected) {
      setErrorMsg(
        'الرفع والجدولة على YouTube غير متاحين قبل ربط حساب Google / YouTube أولاً من تبويب «يوتيوب».'
      );
      return;
    }

    const rawDrafts = resolveCurrentDrafts();
    if (rawDrafts.length === 0) {
      setErrorMsg('لا توجد حلقات جاهزة للرفع.');
      return;
    }

    let baseScheduleMs = 0;
    if (useBatchSchedule) {
      const parsed = new Date(scheduleStartLocal);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() < Date.now() + 60_000) {
        setErrorMsg('اختر وقت بداية مستقبلياً صحيحاً للجدولة (بعد الدقيقة الحالية).');
        return;
      }
      baseScheduleMs = parsed.getTime();
    }

    setErrorMsg('');
    setIsRunning(true);
    setProgressPct(0);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { enriched, ttsWarning } = await enrichDraftsWithTtsIfEnabled(
        rawDrafts,
        controller.signal
      );
      const projects = toQuizProjects(enriched);
      await saveProjectsToLibraryBatch(projects);
      await markPoolItemsUsedIfAny(enriched);

      let uploadedCount = 0;
      const updatedDrafts = [...enriched];

      for (let i = 0; i < projects.length; i++) {
        if (controller.signal.aborted) break;
        const proj = projects[i];
        const draft = updatedDrafts[i];
        setStatusLabel(`تجهيز وتصدير حلقة ${i + 1} من ${projects.length} للرفع...`);

        const exported = await exportQuizVideo(
          proj.slides,
          proj.template,
          proj.timing,
          proj.audio,
          (p) => {
            const overall = ((i + p.progress * 0.6) / projects.length) * 100;
            setProgressPct(Math.round(overall));
          },
          controller.signal,
          { formatPreference: 'auto', resolutionPreference: '720p', includeAudio: true }
        );

        if (controller.signal.aborted) break;

        let thumbBlob = draft.thumbnailBlob;
        if (autoGenerateThumbnails && !thumbBlob) {
          setStatusLabel(`تصميم غلاف تلقائي للحلقة ${i + 1}...`);
          const thumbRes = await renderThumbnailForEpisode(draft);
          if (thumbRes) {
            thumbBlob = thumbRes.blob;
            updatedDrafts[i] = {
              ...updatedDrafts[i],
              thumbnailBlob: thumbRes.blob,
              thumbnailDataUrl: thumbRes.dataUrl,
            };
          }
        }

        const publishAtIso = useBatchSchedule
          ? new Date(baseScheduleMs + i * scheduleIntervalHours * 3600_000).toISOString()
          : undefined;

        const uploadRes = await uploadVideoToYouTube({
          blob: exported.blob,
          mimeType: exported.mimeType,
          title: draft.youtubeTitle || proj.name,
          description: draft.youtubeDescription,
          tags: ['Shorts', 'تحدي', 'أسئلة', 'مسابقات'],
          privacyStatus: ytPrivacy,
          publishAtIso,
          pinnedComment: draft.youtubePinnedComment,
          thumbnailBlob: autoGenerateThumbnails ? thumbBlob : undefined,
          onProgress: (pct, st) => {
            const overall = ((i + 0.6 + (pct / 100) * 0.4) / projects.length) * 100;
            setProgressPct(Math.round(overall));
            setStatusLabel(`رفع حلقة ${i + 1}/${projects.length}: ${st}`);
          },
        });

        updatedDrafts[i] = { ...updatedDrafts[i], uploadedVideoUrl: uploadRes.videoUrl };
        setDraftEpisodes([...updatedDrafts]);
        uploadedCount += 1;
      }

      onCreated(
        `تم حفظ ${projects.length} حلقات ورفع ${uploadedCount} منها فعلياً إلى YouTube${
          useBatchSchedule ? ' مع جدولة زمنية متتالية' : ''
        }!${ttsWarning ? ` (${ttsWarning})` : ''}`
      );
      onClose();
    } catch (err) {
      if (!controller.signal.aborted) {
        setErrorMsg(err instanceof Error ? err.message : 'تعذر إكمال الرفع المتتالي لـ YouTube.');
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  };

  const updateEpisodeDraft = (
    idx: number,
    updater: (prev: FactoryDraftEpisode) => FactoryDraftEpisode
  ) => {
    setDraftEpisodes((prev) => prev.map((ep, i) => (i === idx ? updater(ep) : ep)));
  };

  const quickSuggestedThemes: PresetId[] = [
    'darkCinematic',
    'luxuryGold',
    'tvShowGold',
    'neonCyber',
    'scienceLab',
    'islamicAndalusian',
    'gamingArena',
    'minimalClean',
  ];

  const activeDraftList = resolveCurrentDrafts();

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3"
        dir="rtl"
      >
        <div className="w-full max-w-2xl rounded-2xl bg-[var(--panel)] border border-[var(--pline)] shadow-2xl overflow-hidden text-[var(--ptxt)] flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--pline)] bg-[var(--surface)]">
            <div className="flex items-center gap-2">
              <Factory className="w-5 h-5 text-[#00B050]" />
              <div>
                <h3 className="text-sm font-extrabold">مصنع الشورتس والسلاسل المتكاملة</h3>
                <p className="text-[11px] text-[var(--pmuted)]">
                  {step === 'review'
                    ? `مراجعة وتخصيص ${draftEpisodes.length} حلقات قبل الحفظ أو التصدير`
                    : `متوفر ${unusedPool.length} سؤال جديد بالبنك (إجمالي ${poolItems.length} بالفلتر الحالي)`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                abortRef.current?.abort();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-[var(--panel)] border border-[var(--pline)] text-[var(--pmuted)] hover:text-rose-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 flex flex-col gap-3 max-h-[75dvh] overflow-y-auto">
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/12 border border-rose-500/40 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* Channel Identity Inheritance Notice */}
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--pline)]">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-4 h-4 text-[#00B050] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">
                    {hasActiveIdentity
                      ? `تطبيق هوية القناة الموحّدة (${
                          activeTemplate?.brandChannelName?.trim() ||
                          activeTemplate?.brandHandleText?.trim() ||
                          'شعار القناة'
                        })`
                      : 'توريث إعدادات هوية القناة الحالية'}
                  </div>
                  <div className="text-[10px] text-[var(--pmuted)] truncate">
                    {hasActiveIdentity
                      ? 'يتم توريث الشعار واسم القناة والـ @handle وألوان الهوية لجميع حلقات المصنع تلقائياً.'
                      : 'أضف شعار أو اسم القناة من تبويب «القالب» لتطبيقه تلقائياً على جميع الحلقات.'}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={inheritChannelIdentity}
                disabled={isRunning}
                onChange={(e) => setInheritChannelIdentity(e.target.checked)}
                className="w-4 h-4 accent-[#00B050] rounded cursor-pointer shrink-0"
              />
            </div>

            {step === 'setup' && (
              <>
                {/* Source Mode Tabs */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--surface)] border border-[var(--pline)]">
                  <button
                    type="button"
                    disabled={isRunning || isGeneratingSeries}
                    onClick={() => {
                      setSourceMode('pool');
                      setDupMatches([]);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      sourceMode === 'pool'
                        ? 'bg-[#00B050] text-white'
                        : 'text-[var(--pmuted)] hover:text-[var(--ptxt)]'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>من أسئلة البنك ({effectivePool.length})</span>
                  </button>
                  <button
                    type="button"
                    disabled={isRunning || isGeneratingSeries}
                    onClick={() => {
                      setSourceMode('series');
                      setDupMatches([]);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      sourceMode === 'series'
                        ? 'bg-[#00B050] text-white'
                        : 'text-[var(--pmuted)] hover:text-[var(--ptxt)]'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>سلسلة جاهزة بضغطة واحدة</span>
                  </button>
                </div>

                {sourceMode === 'pool' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--pline)]">
                      <div className="flex justify-between text-xs font-bold">
                        <span>عدد الحلقات</span>
                        <span className="tabular-nums text-[#00B050]">
                          {Math.min(episodeCount, maxPossibleEpisodes)} حلقة
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={Math.max(2, Math.min(20, maxPossibleEpisodes))}
                        step={1}
                        disabled={isRunning}
                        value={Math.min(episodeCount, Math.max(2, maxPossibleEpisodes))}
                        onChange={(e) => setEpisodeCount(parseInt(e.target.value, 10))}
                      />
                    </label>

                    <label className="flex flex-col gap-1 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--pline)]">
                      <div className="flex justify-between text-xs font-bold">
                        <span>أسئلة كل حلقة</span>
                        <span className="tabular-nums text-[var(--gold)]">{perEpisode} أسئلة</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        disabled={isRunning}
                        value={perEpisode}
                        onChange={(e) => setPerEpisode(parseInt(e.target.value, 10))}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-[var(--surface)] border border-[#00B050]/35">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#00B050] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        <span>اختر قالب السلسلة المترابطة</span>
                      </span>
                      <span className="text-[10px] text-[var(--pmuted)]">
                        حلقات مرقمة + منع التكرار تلقائياً
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {SERIES_PRESETS.map((preset) => {
                        const active = seriesPresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            disabled={isRunning || isGeneratingSeries}
                            onClick={() => setSeriesPresetId(preset.id)}
                            className={`p-2 rounded-xl border text-right transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#00B050]/18 border-[#00B050] text-[var(--ptxt)]'
                                : 'bg-[var(--panel)] border-[var(--pline)] text-[var(--pmuted)] hover:text-[var(--ptxt)]'
                            }`}
                          >
                            <div className="text-[11px] font-extrabold truncate">{preset.label}</div>
                            <div className="text-[9px] opacity-80 line-clamp-2 mt-0.5">
                              {preset.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold">
                          عنوان أو محور مخصص (اختياري)
                        </span>
                        <input
                          type="text"
                          value={seriesCustomTopic}
                          disabled={isRunning || isGeneratingSeries}
                          onChange={(e) => setSeriesCustomTopic(e.target.value)}
                          placeholder={
                            SERIES_PRESETS.find((p) => p.id === seriesPresetId)?.defaultTopic ||
                            'مثال: غزوات النبي ﷺ'
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--pline)] text-xs"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold">مستوى الصعوبة</span>
                        <select
                          value={seriesDifficulty}
                          disabled={isRunning || isGeneratingSeries}
                          onChange={(e) =>
                            setSeriesDifficulty(
                              e.target.value as 'سهل' | 'متوسط' | 'صعب' | 'متنوع'
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--pline)] text-xs"
                        >
                          <option value="سهل">سهل ومناسب للجميع</option>
                          <option value="متوسط">متوسط</option>
                          <option value="صعب">تحدي صعب</option>
                          <option value="متنوع">متدرج من السهل للصعب</option>
                        </select>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1 p-2 rounded-xl bg-[var(--panel)] border border-[var(--pline)]">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span>عدد الحلقات</span>
                          <span className="tabular-nums text-[#00B050]">
                            {seriesEpisodeCount} حلقات
                          </span>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={25}
                          step={1}
                          disabled={isRunning || isGeneratingSeries}
                          value={seriesEpisodeCount}
                          onChange={(e) => setSeriesEpisodeCount(parseInt(e.target.value, 10))}
                        />
                      </label>

                      <label className="flex flex-col gap-1 p-2 rounded-xl bg-[var(--panel)] border border-[var(--pline)]">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span>أسئلة كل حلقة</span>
                          <span className="tabular-nums text-[var(--gold)]">
                            {seriesPerEpisode} أسئلة
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={15}
                          step={1}
                          disabled={isRunning || isGeneratingSeries}
                          value={seriesPerEpisode}
                          onChange={(e) => setSeriesPerEpisode(parseInt(e.target.value, 10))}
                        />
                      </label>
                    </div>

                    <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--pline)] text-[11px] font-bold cursor-pointer">
                      <span>إضافة تشويق الحلقة القادمة في نهاية كل حلقة (Cliffhanger)</span>
                      <input
                        type="checkbox"
                        checked={includeCliffhanger}
                        disabled={isRunning || isGeneratingSeries}
                        onChange={(e) => setIncludeCliffhanger(e.target.checked)}
                        className="w-4 h-4 accent-[#00B050] rounded cursor-pointer"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={isRunning || isGeneratingSeries}
                      onClick={() => void handleGenerateOneClickSeries()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00B050] hover:bg-[#00c85b] text-white text-xs font-extrabold cursor-pointer disabled:opacity-60"
                    >
                      {isGeneratingSeries ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جارٍ بناء السلسلة المترابطة وفحص التكرار...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>توليد السلسلة المترابطة الآن ومراجعة الحلقات</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {dupMatches.length > 0 && (
                  <DuplicateWarningBanner
                    matches={dupMatches}
                    decisions={dupDecisions}
                    onDecisionChange={(idx, d) =>
                      setDupDecisions((prev) => ({ ...prev, [idx]: d }))
                    }
                    onAcceptAll={() => {
                      const next: Record<number, DuplicateDecision> = {};
                      dupMatches.forEach((m) => {
                        next[m.candidateIndex] = 'keep';
                      });
                      setDupDecisions(next);
                    }}
                    onSkipAll={() => {
                      const next: Record<number, DuplicateDecision> = {};
                      dupMatches.forEach((m) => {
                        next[m.candidateIndex] = 'skip';
                      });
                      setDupDecisions(next);
                    }}
                    onConfirmApply={handleApplyDuplicateDecisions}
                    confirmLabel="تطبيق الاختيارات والانتقال لمراجعة الحلقات"
                  />
                )}

                {/* Visual Themes Library Controls inside Shorts Factory */}
                <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-[var(--surface)] border border-[var(--pline)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold">
                      <Palette className="w-4 h-4 text-[#00B050]" />
                      <span>الثيم البصري لحلقات المصنع</span>
                    </span>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => {
                        setThemesTargetEpisodeIdx(null);
                        setIsThemesLibraryOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#00B050] hover:bg-[#00c85b] text-white text-[11px] font-bold cursor-pointer"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>تصفح مكتبة الثيمات ({ROTATE_THEMES.length}+)</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--panel)] border border-[var(--pline)]">
                    {(
                      [
                        { id: 'autoRotate', label: 'تنويع تلقائي' },
                        { id: 'singleTheme', label: 'ثيم موحّد للسلسلة' },
                        { id: 'smartByCategory', label: 'تلقائي حسب التصنيف' },
                      ] as { id: FactoryThemeMode; label: string }[]
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        disabled={isRunning}
                        onClick={() => setThemeMode(m.id)}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          themeMode === m.id
                            ? 'bg-[#00B050] text-white'
                            : 'text-[var(--pmuted)] hover:text-[var(--ptxt)]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {themeMode === 'singleTheme' && (
                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex items-center gap-3 p-2 rounded-xl bg-[var(--panel)] border border-[var(--pline)]">
                        <div className="w-12 rounded-md overflow-hidden border border-[var(--pline)] shrink-0">
                          <MiniThemeStagePreview
                            template={selectedFactoryTemplate}
                            phase="reveal"
                            compact
                            showHandle={false}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-extrabold truncate">{selectedThemeLabel}</div>
                          <div className="text-[10px] text-[var(--pmuted)] truncate">
                            الخط: {selectedFactoryTemplate.fontFamily} · العداد:{' '}
                            {selectedFactoryTemplate.timerStyle}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => {
                            setThemesTargetEpisodeIdx(null);
                            setIsThemesLibraryOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] hover:border-[#00B050] text-[11px] font-bold cursor-pointer shrink-0"
                        >
                          تغيير / تعديل
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {quickSuggestedThemes.map((pid) => {
                          const entry = getThemeEntryById(pid, '9:16');
                          const isSel = selectedFactoryTemplate.presetId === pid;
                          return (
                            <button
                              key={pid}
                              type="button"
                              disabled={isRunning}
                              onClick={() => {
                                setSelectedFactoryTemplate(
                                  applyStudioThemePreset(DEFAULT_TEMPLATE, pid)
                                );
                                setSelectedThemeLabel(entry.meta.name);
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                                isSel
                                  ? 'bg-[#00B050]/18 border-[#00B050] text-[#00B050] dark:text-[#6ee7b7]'
                                  : 'bg-[var(--panel)] border-[var(--pline)] text-[var(--ptxt)]'
                              }`}
                            >
                              {entry.meta.emoji} {entry.meta.name}
                            </button>
                          );
                        })}
                        {savedCustomThemes.slice(0, 4).map((cp) => (
                          <button
                            key={cp.id}
                            type="button"
                            disabled={isRunning}
                            onClick={() => {
                              setSelectedFactoryTemplate(
                                applyCustomTemplateSettings(DEFAULT_TEMPLATE, cp.template, {
                                  preserveChannelIdentity: false,
                                  preserveLayoutPositions: false,
                                })
                              );
                              setSelectedThemeLabel(cp.name);
                            }}
                            className="px-2.5 py-1 rounded-lg border bg-[var(--panel)] border-[var(--gold)]/55 text-[var(--gold)] text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            ★ {cp.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Presenter Option */}
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-[var(--surface)] border border-[var(--pline)]">
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="flex items-center gap-1.5 text-xs font-bold">
                      <UserCheck className="w-4 h-4 text-[#00B050]" />
                      <span>تفعيل المذيع التفاعلي في كل الحلقات</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={enablePresenter}
                      disabled={isRunning}
                      onChange={(e) => setEnablePresenter(e.target.checked)}
                      className="w-4 h-4 accent-[#00B050] rounded cursor-pointer"
                    />
                  </label>

                  {enablePresenter && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                      {[
                        { id: 'stylized3d' as PresenterStyle, label: 'مذيع ذكي 2D', thumb: '' },
                        { id: 'clawatar3d' as PresenterStyle, label: 'أفاتار 3D', thumb: '' },
                        {
                          id: 'photoMale' as PresenterStyle,
                          label: 'صورة مذيع',
                          thumb: PRESENTER_PORTRAIT_URLS.photoMale,
                        },
                        {
                          id: 'photoFemale' as PresenterStyle,
                          label: 'صورة مذيعة',
                          thumb: PRESENTER_PORTRAIT_URLS.photoFemale,
                        },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isRunning}
                          onClick={() => setPresenterStyle(opt.id)}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                            presenterStyle === opt.id
                              ? 'bg-[#00B050]/18 border-[#00B050] text-[#00B050] dark:text-[#6ee7b7]'
                              : 'bg-[var(--panel)] border-[var(--pline)] text-[var(--ptxt)]'
                          }`}
                        >
                          {opt.thumb ? (
                            <img
                              src={opt.thumb}
                              alt={opt.label}
                              className="w-6 h-6 rounded object-cover shrink-0"
                            />
                          ) : (
                            <Sparkles className="w-4 h-4 shrink-0 text-[#00B050]" />
                          )}
                          <span className="truncate">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Viral Booster & Auto Thumbnail Options */}
                <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
                  {[
                    { label: 'تسريع العداد ⚡', val: escalatingSpeed, set: setEscalatingSpeed },
                    { label: 'ومضة أول ثانية 👀', val: enableFlashTeaser, set: setEnableFlashTeaser },
                    { label: 'لوحة النقاط 🏆', val: enableScoreboard, set: setEnableScoreboard },
                  ].map((sw) => (
                    <label
                      key={sw.label}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--pline)] cursor-pointer"
                    >
                      <span className="truncate">{sw.label}</span>
                      <input
                        type="checkbox"
                        checked={sw.val}
                        disabled={isRunning}
                        onChange={(e) => sw.set(e.target.checked)}
                        className="w-4 h-4 accent-[#00B050] rounded cursor-pointer shrink-0"
                      />
                    </label>
                  ))}
                </div>

                {/* Auto Batch Thumbnails Config */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--pline)]">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={autoGenerateThumbnails}
                      disabled={isRunning}
                      onChange={(e) => setAutoGenerateThumbnails(e.target.checked)}
                      className="w-4 h-4 accent-[#00B050] rounded cursor-pointer"
                    />
                    <ImageIcon className="w-4 h-4 text-[var(--gold)]" />
                    <span>توليد أغلفة يوتيوب تلقائية (Thumbnails) وإرفاقها عند الرفع</span>
                  </label>
                  {autoGenerateThumbnails && (
                    <select
                      value={thumbnailAspect}
                      disabled={isRunning}
                      onChange={(e) => setThumbnailAspect(e.target.value as '9:16' | '16:9')}
                      className="px-2 py-1 rounded-lg bg-[var(--panel)] border border-[var(--pline)] text-[11px] font-bold"
                    >
                      <option value="9:16">غلاف عمودي 9:16 (Shorts)</option>
                      <option value="16:9">غلاف عريض 16:9 (YouTube)</option>
                    </select>
                  )}
                </div>
              </>
            )}

            {/* STEP 2: Per-Episode Review & Individual Editing */}
            {step === 'review' && (
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setStep('setup')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs font-bold hover:border-[#00B050] cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>تعديل الإعدادات العامة</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isRunning || isGeneratingThumbs}
                      onClick={() => void generateThumbnailsForEpisodesList(draftEpisodes)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/45 text-[var(--gold)] text-[11px] font-bold hover:bg-[var(--gold)]/25 cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingThumbs ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isGeneratingThumbs ? 'جارٍ تصميم الأغلفة...' : 'توليد / تحديث أغلفة الكل 🖼️'}
                      </span>
                    </button>
                  </div>
                </div>

                {draftEpisodes.map((ep, idx) => {
                  const isExpanded = expandedEpisodeIdx === idx;
                  return (
                    <div
                      key={ep.id}
                      className="rounded-xl border border-[var(--pline)] bg-[var(--surface)] overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedEpisodeIdx(isExpanded ? -1 : idx)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-right hover:bg-[var(--panel)]/60 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded-md bg-[#00B050]/18 text-[#00B050] text-[10px] font-extrabold shrink-0">
                            حلقة {idx + 1}
                          </span>
                          <span className="text-xs font-bold truncate">{ep.name}</span>
                          <span className="text-[10px] text-[var(--pmuted)] shrink-0">
                            · {ep.slides.length} أسئلة · {ep.themeLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {ep.uploadedVideoUrl && (
                            <span className="text-[10px] text-emerald-400 font-bold">
                              ✓ رُفع لليوتيوب
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[var(--pmuted)]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[var(--pmuted)]" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-3 border-t border-[var(--pline)] bg-[var(--panel)]/45 flex flex-col gap-2.5">
                          {/* Per-episode Name & Theme Override */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-[var(--pmuted)]">
                                اسم الحلقة
                              </span>
                              <input
                                type="text"
                                value={ep.name}
                                disabled={isRunning}
                                onChange={(e) =>
                                  updateEpisodeDraft(idx, (prev) => ({
                                    ...prev,
                                    name: e.target.value,
                                  }))
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs font-bold"
                              />
                            </label>

                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-[var(--pmuted)]">
                                ثيم هذه الحلقة فقط
                              </span>
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={ep.template.presetId}
                                  disabled={isRunning}
                                  onChange={(e) => {
                                    const pid = e.target.value as PresetId;
                                    const entry = getThemeEntryById(pid, ep.template.aspectRatio);
                                    updateEpisodeDraft(idx, (prev) => {
                                      const nextTpl = applyStudioThemePreset(prev.template, pid);
                                      return {
                                        ...prev,
                                        template:
                                          inheritChannelIdentity && activeTemplate
                                            ? mergeChannelBrandIdentity(nextTpl, activeTemplate)
                                            : nextTpl,
                                        themeLabel: entry.meta.name,
                                      };
                                    });
                                  }}
                                  className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs"
                                >
                                  {STUDIO_THEME_ORDER.map((pid) => {
                                    const entry = getThemeEntryById(pid, ep.template.aspectRatio);
                                    return (
                                      <option key={pid} value={pid}>
                                        {entry.meta.emoji} {entry.meta.name}
                                      </option>
                                    );
                                  })}
                                </select>
                                <button
                                  type="button"
                                  disabled={isRunning}
                                  onClick={() => {
                                    setThemesTargetEpisodeIdx(idx);
                                    setIsThemesLibraryOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#00B050]/15 border border-[#00B050]/45 text-[#00B050] text-[10px] font-bold cursor-pointer shrink-0"
                                >
                                  مكتبة الثيمات
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Per-episode Presenter & Cliffhanger */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)]">
                              <label className="flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(ep.template.presenterEnabled)}
                                  disabled={isRunning}
                                  onChange={(e) =>
                                    updateEpisodeDraft(idx, (prev) => ({
                                      ...prev,
                                      template: {
                                        ...prev.template,
                                        presenterEnabled: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="w-3.5 h-3.5 accent-[#00B050]"
                                />
                                <span>مذيع لهذه الحلقة</span>
                              </label>
                              {ep.template.presenterEnabled && (
                                <select
                                  value={ep.template.presenterStyle}
                                  disabled={isRunning}
                                  onChange={(e) =>
                                    updateEpisodeDraft(idx, (prev) => ({
                                      ...prev,
                                      template: {
                                        ...prev.template,
                                        presenterStyle: e.target.value as PresenterStyle,
                                      },
                                    }))
                                  }
                                  className="px-2 py-1 rounded bg-[var(--panel)] border border-[var(--pline)] text-[10px]"
                                >
                                  <option value="stylized3d">مذيع ذكي 2D</option>
                                  <option value="clawatar3d">أفاتار 3D</option>
                                  <option value="photoMale">صورة مذيع</option>
                                  <option value="photoFemale">صورة مذيعة</option>
                                </select>
                              )}
                            </div>

                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-[var(--pmuted)]">
                                عبارة تشويق الحلقة القادمة
                              </span>
                              <input
                                type="text"
                                value={ep.cliffhangerText}
                                disabled={isRunning}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateEpisodeDraft(idx, (prev) => {
                                    const nextSlides = [...prev.slides];
                                    if (nextSlides.length > 0) {
                                      const lastIdx = nextSlides.length - 1;
                                      nextSlides[lastIdx] = {
                                        ...nextSlides[lastIdx],
                                        episodeCliffhanger: val.trim() || undefined,
                                      };
                                    }
                                    return { ...prev, cliffhangerText: val, slides: nextSlides };
                                  });
                                }}
                                placeholder="مثال: تابع الحلقة القادمة لمعرفة ما حدث في الهجرة!"
                                className="px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs"
                              />
                            </label>
                          </div>

                          {/* YouTube Metadata & Auto Thumbnail Preview for Episode */}
                          <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] flex flex-col gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[10px] font-extrabold text-[var(--gold)] flex items-center gap-1">
                                <Edit3 className="w-3 h-3" />
                                <span>بيانات النشر والغلاف المصغّر لهذه الحلقة</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isRunning}
                                  onClick={() => {
                                    void renderThumbnailForEpisode(ep).then((res) => {
                                      if (res) {
                                        updateEpisodeDraft(idx, (prev) => ({
                                          ...prev,
                                          thumbnailBlob: res.blob,
                                          thumbnailDataUrl: res.dataUrl,
                                        }));
                                      }
                                    });
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--panel)] border border-[var(--pline)] hover:border-[var(--gold)] text-[10px] font-bold cursor-pointer"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>{ep.thumbnailDataUrl ? 'تحديث الغلاف' : 'توليد غلاف'}</span>
                                </button>
                                {ep.thumbnailBlob && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const safe =
                                        ep.name.replace(/[^\w\u0600-\u06FF-]+/g, '-') ||
                                        `episode-${idx + 1}`;
                                      void saveOrDownloadBlob(
                                        ep.thumbnailBlob!,
                                        `${safe}-thumb.jpg`,
                                        'image/jpeg'
                                      );
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#00B050]/18 border border-[#00B050]/45 text-[#00B050] text-[10px] font-bold cursor-pointer"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>تحميل الغلاف</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2.5 items-start">
                              {ep.thumbnailDataUrl && (
                                <img
                                  src={ep.thumbnailDataUrl}
                                  alt={`غلاف ${ep.name}`}
                                  className={`${
                                    thumbnailAspect === '16:9' ? 'w-28 h-16' : 'w-14 h-24'
                                  } rounded-lg object-cover border border-[var(--gold)]/50 shrink-0 shadow-sm`}
                                />
                              )}
                              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                <input
                                  type="text"
                                  value={ep.youtubeTitle}
                                  disabled={isRunning}
                                  onChange={(e) =>
                                    updateEpisodeDraft(idx, (prev) => ({
                                      ...prev,
                                      youtubeTitle: e.target.value,
                                    }))
                                  }
                                  placeholder="عنوان فيديو YouTube"
                                  className="px-2 py-1 rounded bg-[var(--panel)] border border-[var(--pline)] text-[11px]"
                                />
                                <textarea
                                  rows={2}
                                  value={ep.youtubeDescription}
                                  disabled={isRunning}
                                  onChange={(e) =>
                                    updateEpisodeDraft(idx, (prev) => ({
                                      ...prev,
                                      youtubeDescription: e.target.value,
                                    }))
                                  }
                                  placeholder="وصف الفيديو والهاشتاغات"
                                  className="px-2 py-1 rounded bg-[var(--panel)] border border-[var(--pline)] text-[11px] resize-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Editable Slides inside Episode */}
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold text-[var(--pmuted)]">
                              الأسئلة ({ep.slides.length})
                            </span>
                            {ep.slides.map((sl, sIdx) => (
                              <div
                                key={sl.id}
                                className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] flex flex-col gap-1.5"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-extrabold text-[#00B050] shrink-0">
                                    س{sIdx + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={sl.question}
                                    disabled={isRunning}
                                    onChange={(e) =>
                                      updateEpisodeDraft(idx, (prev) => ({
                                        ...prev,
                                        slides: prev.slides.map((item, k) =>
                                          k === sIdx ? { ...item, question: e.target.value } : item
                                        ),
                                      }))
                                    }
                                    className="flex-1 px-2 py-1 rounded bg-[var(--panel)] border border-[var(--pline)] text-[11px]"
                                  />
                                  {ep.slides.length > 1 && (
                                    <button
                                      type="button"
                                      disabled={isRunning}
                                      onClick={() =>
                                        updateEpisodeDraft(idx, (prev) => ({
                                          ...prev,
                                          slides: prev.slides.filter((_, k) => k !== sIdx),
                                        }))
                                      }
                                      className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                                      title="حذف السؤال"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <input
                                    type="text"
                                    value={sl.explanationText || ''}
                                    disabled={isRunning}
                                    onChange={(e) =>
                                      updateEpisodeDraft(idx, (prev) => ({
                                        ...prev,
                                        slides: prev.slides.map((item, k) =>
                                          k === sIdx
                                            ? { ...item, explanationText: e.target.value }
                                            : item
                                        ),
                                      }))
                                    }
                                    placeholder="الدليل / المعلومة عند كشف الجواب"
                                    className="px-2 py-1 rounded bg-[var(--panel)] border border-[var(--pline)] text-[10px]"
                                  />
                                  <input
                                    type="text"
                                    value={sl.explanationSource || ''}
                                    disabled={isRunning}
                                    onChange={(e) =>
                                      updateEpisodeDraft(idx, (prev) => ({
                                        ...prev,
                                        slides: prev.slides.map((item, k) =>
                                          k === sIdx
                                            ? { ...item, explanationSource: e.target.value }
                                            : item
                                        ),
                                      }))
                                    }
                                    placeholder="المصدر الموثق (اختياري)"
                                    className="px-2 py-1 rounded bg-[var(--panel)] border border-[var(--pline)] text-[10px]"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Auto TTS Batch Toggle */}
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--pline)] flex flex-col gap-2">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <Volume2 className="w-4 h-4 text-[#00B050]" />
                  <span>توليد تعليق صوتي تلقائي للأسئلة (مع ضبط النطق العربي)</span>
                </span>
                <input
                  type="checkbox"
                  checked={autoGenerateTts}
                  disabled={isRunning}
                  onChange={(e) => setAutoGenerateTts(e.target.checked)}
                  className="w-4 h-4 accent-[#00B050] rounded cursor-pointer"
                />
              </label>
              {autoGenerateTts && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-[var(--pmuted)]">نطاق القراءة:</span>
                  <select
                    value={ttsVoiceMode}
                    disabled={isRunning}
                    onChange={(e) => setTtsVoiceMode(e.target.value as AiVoiceMode)}
                    className="px-2 py-1 rounded-lg bg-[var(--panel)] border border-[var(--pline)] text-[11px]"
                  >
                    <option value="questionAndAnswer">السؤال + الإجابة الصحيحة (موصى به)</option>
                    <option value="questionOnly">السؤال فقط</option>
                    <option value="full">السؤال + الخيارات + الإجابة</option>
                  </select>
                </div>
              )}
            </div>

            {/* Honest Sequential YouTube Upload & Scheduling Section */}
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--pline)] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-extrabold">
                  <Youtube className="w-4 h-4 text-rose-500" />
                  <span>الرفع والجدولة المتتالية على YouTube</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    liveYtConnected
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/35'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/35'
                  }`}
                >
                  {liveYtConnected ? 'حساب YouTube متصل ✓' : 'غير متصل بـ Google OAuth'}
                </span>
              </div>

              {!liveYtConnected ? (
                <p className="text-[11px] text-amber-300/90 leading-relaxed">
                  يتطلب الرفع المباشر أو الجدولة المتتالية ربط قناة YouTube عبر Google OAuth من تبويب
                  «يوتيوب» أولاً. يمكنك حفظ الحلقات أو تصدير ملفات الفيديو محلياً الآن.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <label className="flex flex-col gap-1">
                      <span className="font-bold text-[var(--pmuted)]">حالة الخصوصية</span>
                      <select
                        value={ytPrivacy}
                        disabled={isRunning}
                        onChange={(e) => setYtPrivacy(e.target.value as YouTubePrivacyStatus)}
                        className="px-2 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--pline)]"
                      >
                        <option value="private">خاص (Private) — آمن للمراجعة</option>
                        <option value="unlisted">غير مدرج (Unlisted)</option>
                        <option value="public">علني فوراً (Public)</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[var(--panel)] border border-[var(--pline)] font-bold cursor-pointer self-end">
                      <span className="flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5 text-[#00B050]" />
                        <span>جدولة تلقائية متباعدة</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={useBatchSchedule}
                        disabled={isRunning}
                        onChange={(e) => setUseBatchSchedule(e.target.checked)}
                        className="w-4 h-4 accent-[#00B050]"
                      />
                    </label>
                  </div>

                  {useBatchSchedule && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <label className="flex flex-col gap-1">
                        <span className="font-bold text-[var(--pmuted)]">موعد أول حلقة</span>
                        <input
                          type="datetime-local"
                          value={scheduleStartLocal}
                          disabled={isRunning}
                          onChange={(e) => setScheduleStartLocal(e.target.value)}
                          className="px-2 py-1 rounded-lg bg-[var(--panel)] border border-[var(--pline)]"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="font-bold text-[var(--pmuted)]">
                          الفاصل بين الحلقات (بالساعات)
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={168}
                          value={scheduleIntervalHours}
                          disabled={isRunning}
                          onChange={(e) =>
                            setScheduleIntervalHours(Math.max(1, parseInt(e.target.value || '24', 10)))
                          }
                          className="px-2 py-1 rounded-lg bg-[var(--panel)] border border-[var(--pline)]"
                        />
                      </label>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isRunning || activeDraftList.length === 0}
                    onClick={() => void handleBatchUploadToYouTube()}
                    className="flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>
                      تصدير ورفع {activeDraftList.length} حلقات إلى YouTube بالتتابع
                    </span>
                  </button>
                </div>
              )}
            </div>

            {isRunning && (
              <div className="p-3 rounded-xl bg-[#00B050]/10 border border-[#00B050]/40 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-[#00B050]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{statusLabel}</span>
                  </span>
                  <span className="tabular-nums">{progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden">
                  <div
                    className="h-full bg-[#00B050] transition-all duration-200"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-3.5 border-t border-[var(--pline)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-2">
            {!isRunning && step === 'setup' && sourceMode === 'pool' ? (
              <button
                type="button"
                onClick={() => void handlePreparePoolReview()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--panel)] border border-[var(--pline)] hover:border-[#00B050] text-xs font-bold cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#00B050]" />
                <span>تخصيص كل حلقة على حدة ✏️</span>
              </button>
            ) : (
              <span className="text-[11px] text-[var(--pmuted)]">
                {activeDraftList.length} حلقات جاهزة للإنتاج
              </span>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {isRunning ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                >
                  إيقاف العملية
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={activeDraftList.length === 0}
                    onClick={() => void handleSaveBatchProjects()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--panel)] border border-[#00B050]/55 hover:border-[#00B050] text-[#00B050] dark:text-[#6ee7b7] text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>إنشاء وحفظ بالمشاريع</span>
                  </button>
                  <button
                    type="button"
                    disabled={activeDraftList.length === 0}
                    onClick={() => void handleBatchExportVideos()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00B050] hover:bg-[#00c85b] text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                  >
                    <Film className="w-4 h-4" />
                    <Check className="w-3.5 h-3.5" />
                    <span>توليد وتصدير الفيديوهات متتالية</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ThemesLibraryModal
        isOpen={isThemesLibraryOpen}
        onClose={() => {
          setIsThemesLibraryOpen(false);
          setThemesTargetEpisodeIdx(null);
        }}
        mode="factory"
        currentTemplate={
          themesTargetEpisodeIdx !== null && draftEpisodes[themesTargetEpisodeIdx]
            ? draftEpisodes[themesTargetEpisodeIdx].template
            : selectedFactoryTemplate
        }
        seriesLabel={seriesLabel}
        onApplyForFactory={(chosenTpl, meta) => {
          if (themesTargetEpisodeIdx !== null) {
            const targetIdx = themesTargetEpisodeIdx;
            updateEpisodeDraft(targetIdx, (prev) => ({
              ...prev,
              template:
                inheritChannelIdentity && activeTemplate
                  ? mergeChannelBrandIdentity(chosenTpl, activeTemplate)
                  : chosenTpl,
              themeLabel: meta.label,
            }));
          } else {
            setSelectedFactoryTemplate(chosenTpl);
            setSelectedThemeLabel(meta.label);
            setThemeMode('singleTheme');
          }
        }}
      />
    </>
  );
};
