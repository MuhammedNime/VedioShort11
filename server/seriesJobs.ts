import fs from 'fs';
import path from 'path';
import {
  BUILTIN_BRAND_PRESETS,
  DEFAULT_BRAND_PRESET,
  migrateBrandPresetSchema,
  migrateEpisodeSchema,
  migrateSceneSchema,
  migrateSeriesSchema,
} from '../src/series/migrations';
import {
  EpisodePlanOutline,
  buildEpisodeDetailPrompt,
  buildSceneRegeneratePrompt,
  buildSeriesPlanPrompt,
  evaluateFactConfidenceHeuristic,
} from '../src/series/promptBuilder';
import {
  BrandPreset,
  CURRENT_SERIES_SCHEMA_VERSION,
  CreateSeriesRequest,
  Episode,
  GenerationJob,
  Scene,
  Series,
} from '../src/types/series';
import { sanitizeSvgToDataUrl } from './seriesValidation';

export interface SeriesTextRunner {
  runJson: <T>(params: {
    systemInstruction: string;
    userPrompt: string;
    temperature?: number;
    parseAndValidate: (payload: unknown) => T;
  }) => Promise<T>;
}

const seriesStore = new Map<string, Series>();
const jobsStore = new Map<string, GenerationJob>();

const IS_TEST_RUNTIME =
  Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test';
const RUNTIME_DATA_DIR = path.resolve(process.cwd(), '.runtime-data');
const RUNTIME_JOBS_FILE = path.join(RUNTIME_DATA_DIR, 'series-jobs.json');
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function writeStoresToDiskSync(): void {
  if (IS_TEST_RUNTIME) return;
  try {
    fs.mkdirSync(RUNTIME_DATA_DIR, { recursive: true });
    const payload = JSON.stringify({
      series: Array.from(seriesStore.values()),
      jobs: Array.from(jobsStore.values()),
    });
    const tmpFile = `${RUNTIME_JOBS_FILE}.tmp`;
    fs.writeFileSync(tmpFile, payload, 'utf8');
    fs.renameSync(tmpFile, RUNTIME_JOBS_FILE);
  } catch {
    // Non-fatal in read-only or ephemeral environments
  }
}

function schedulePersistStores(immediate = false): void {
  if (IS_TEST_RUNTIME) return;
  if (immediate) {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    writeStoresToDiskSync();
    return;
  }
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    writeStoresToDiskSync();
  }, 250);
}

function hydrateStoresFromDisk(): void {
  if (IS_TEST_RUNTIME) return;
  try {
    if (!fs.existsSync(RUNTIME_JOBS_FILE)) return;
    const raw = fs.readFileSync(RUNTIME_JOBS_FILE, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw) as {
      series?: unknown[];
      jobs?: GenerationJob[];
    };
    if (Array.isArray(parsed.series)) {
      for (const sRaw of parsed.series) {
        if (!sRaw || typeof sRaw !== 'object') continue;
        const migrated = migrateSeriesSchema(sRaw);
        if (migrated.status === 'queued' || migrated.status === 'generating') {
          const hasReadyEp = migrated.episodes.some(
            (ep) => ep.status === 'ready' || ep.status === 'reviewing'
          );
          migrated.status = hasReadyEp ? 'reviewing' : 'failed';
          migrated.error =
            migrated.error ||
            'توقفت العملية أثناء إعادة تشغيل الخادم — يمكنك إعادة توليد الحلقات الناقصة.';
          migrated.episodes = migrated.episodes.map((ep) =>
            ep.status === 'queued' || ep.status === 'generating'
              ? { ...ep, status: 'failed', error: 'توقفت أثناء إعادة تشغيل الخادم.' }
              : ep
          );
        }
        seriesStore.set(migrated.id, migrated);
      }
    }
    if (Array.isArray(parsed.jobs)) {
      for (const j of parsed.jobs) {
        if (!j || typeof j !== 'object' || !j.id) continue;
        const jobCopy = { ...j };
        if (jobCopy.status === 'queued' || jobCopy.status === 'generating') {
          jobCopy.status = jobCopy.completedEpisodes > 0 ? 'reviewing' : 'failed';
          jobCopy.progress = 100;
          jobCopy.stageLabel = 'توقفت المهمة أثناء إعادة تشغيل الخادم.';
        }
        jobsStore.set(jobCopy.id, jobCopy);
      }
    }
  } catch {
    // ignore corrupt snapshot
  }
}

hydrateStoresFromDisk();

function pruneStoresIfNeeded(): void {
  if (seriesStore.size > 80) {
    const sorted = Array.from(seriesStore.values()).sort((a, b) => a.updatedAt - b.updatedAt);
    for (const s of sorted.slice(0, seriesStore.size - 80)) {
      seriesStore.delete(s.id);
    }
  }
  if (jobsStore.size > 160) {
    const sorted = Array.from(jobsStore.values()).sort((a, b) => a.updatedAt - b.updatedAt);
    for (const j of sorted.slice(0, jobsStore.size - 160)) {
      jobsStore.delete(j.id);
    }
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function resolveBrandPreset(req: CreateSeriesRequest): BrandPreset {
  if (req.brandPreset) {
    return migrateBrandPresetSchema(req.brandPreset);
  }
  if (req.brandPresetId) {
    const match = BUILTIN_BRAND_PRESETS.find((b) => b.id === req.brandPresetId);
    if (match) return migrateBrandPresetSchema(match);
  }
  return migrateBrandPresetSchema(DEFAULT_BRAND_PRESET);
}

function buildFallbackBrandedSvg(scene: Scene, brand: BrandPreset, idx: number): string {
  const bg = brand.primaryColors.bg || '#0c0c0c';
  const surface = brand.primaryColors.surface || '#17130c';
  const accent = brand.primaryColors.accent || '#00B050';
  const gold = brand.secondaryColors.border || '#d4a73a';
  const textLine = (scene.onScreenText[0] || scene.narration || `مشهد ${idx + 1}`)
    .replace(/[<>&"']/g, '')
    .slice(0, 42);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
  <defs>
    <linearGradient id="g${idx}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${surface}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" rx="24" fill="url(#g${idx})"/>
  <circle cx="670" cy="95" r="88" fill="${accent}" fill-opacity="0.16"/>
  <circle cx="130" cy="360" r="110" fill="${gold}" fill-opacity="0.14"/>
  <rect x="44" y="44" width="712" height="362" rx="18" fill="none" stroke="${gold}" stroke-opacity="0.4" stroke-width="2"/>
  <circle cx="400" cy="185" r="54" fill="${accent}" fill-opacity="0.22" stroke="${accent}" stroke-width="3"/>
  <text x="400" y="198" text-anchor="middle" fill="${gold}" font-family="Cairo, sans-serif" font-size="38" font-weight="800">${idx + 1}</text>
  <text x="400" y="302" text-anchor="middle" fill="#f4ead2" font-family="Cairo, sans-serif" font-size="26" font-weight="700">${textLine}</text>
</svg>`;
  return sanitizeSvgToDataUrl(svg) || '';
}

function buildCaptionsFromScenes(scenes: Scene[]) {
  let cursor = 0;
  return scenes.map((sc, i) => {
    const startSec = Number(cursor.toFixed(2));
    const endSec = Number((cursor + (sc.duration || 8)).toFixed(2));
    cursor = endSec;
    return {
      id: `cue-${i + 1}`,
      startSec,
      endSec,
      text: sc.narration || sc.onScreenText[0] || '',
    };
  });
}

function normalizeBuiltEpisode(
  raw: Record<string, unknown>,
  series: Series,
  epIndex: number,
  existingEpId?: string
): Episode {
  const epId = existingEpId || `${series.id}-ep-${epIndex + 1}`;
  const rawScenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  const scenes: Scene[] = rawScenes.slice(0, 30).map((scRaw, idx) => {
    const base = migrateSceneSchema(scRaw, idx);
    const scObj = (scRaw && typeof scRaw === 'object' ? scRaw : {}) as Record<string, unknown>;
    const evaluated = evaluateFactConfidenceHeuristic(
      base.narration,
      scObj.factCheck && typeof scObj.factCheck === 'object'
        ? (scObj.factCheck as { status?: string; confidence?: number; flagReason?: string })
        : undefined
    );
    return {
      ...base,
      id: `${epId}-sc-${idx + 1}`,
      index: idx,
      factCheck: evaluated,
    };
  });

  const titleOptionsRaw = Array.isArray(raw.titleOptions)
    ? raw.titleOptions.map((t) => String(t ?? '').trim()).filter(Boolean)
    : [];
  const fallbackTitle = `الحلقة ${epIndex + 1}: ${series.topic.slice(0, 42)}`;
  const titleOptions =
    titleOptionsRaw.length >= 4
      ? titleOptionsRaw.slice(0, 4)
      : [
          titleOptionsRaw[0] || fallbackTitle,
          titleOptionsRaw[1] || `${series.topic.slice(0, 32)} — الجزء ${epIndex + 1}`,
          titleOptionsRaw[2] || `حقائق مذهلة في الحلقة ${epIndex + 1}`,
          titleOptionsRaw[3] || `هل كنت تعرف هذا عن ${series.topic.slice(0, 26)}؟`,
        ];

  const strongestTitle = titleOptions[0];
  const hasFlagged = scenes.some((s) => s.factCheck?.status === 'flagged');
  const hasReview = scenes.some((s) => s.factCheck?.status === 'needs_review');

  const migrated = migrateEpisodeSchema(
    {
      ...raw,
      id: epId,
      seriesId: series.id,
      index: epIndex,
      title: strongestTitle,
      titleOptions,
      status: hasFlagged || hasReview ? 'reviewing' : 'ready',
      scenes,
      captions: buildCaptionsFromScenes(scenes),
      narration: {
        voice: series.brandPreset.narrator.voice,
        rate: 1,
        scriptSummary: strongestTitle,
      },
      music: {
        mood: typeof raw.musicMood === 'string' ? raw.musicMood : 'ملهم',
        trackId: series.brandPreset.music.builtinId,
        volume: series.brandPreset.music.volume,
      },
      exportSettings: {
        format: 'auto',
        resolution: 'auto',
        aspectRatio: series.format,
      },
      updatedAt: Date.now(),
    },
    series.id,
    epIndex,
    series.format
  );

  return migrated;
}

function createPlaceholderEpisodes(
  seriesId: string,
  req: Pick<CreateSeriesRequest, 'targetDurationSec' | 'format'>,
  brand: BrandPreset,
  count: number,
  startIndex = 0
): Episode[] {
  return Array.from({ length: count }, (_, offset) => {
    const idx = startIndex + offset;
    return migrateEpisodeSchema(
      {
        id: `${seriesId}-ep-${idx + 1}`,
        seriesId,
        index: idx,
        title: `الحلقة ${idx + 1} (قيد التجهيز...)`,
        titleOptions: [`الحلقة ${idx + 1}`],
        hook: '',
        script: '',
        duration: req.targetDurationSec,
        status: 'queued',
        scenes: [],
        narration: {
          voice: brand.narrator.voice,
          rate: 1,
          scriptSummary: '',
        },
        music: {
          mood: 'ملهم',
          trackId: brand.music.builtinId,
          volume: brand.music.volume,
        },
        exportSettings: {
          format: 'auto',
          resolution: 'auto',
          aspectRatio: req.format,
        },
      },
      seriesId,
      idx,
      req.format
    );
  });
}

async function generatePlanOutlines(
  req: CreateSeriesRequest,
  runner: SeriesTextRunner,
  options: { startIndex?: number; batchCount?: number; avoidTopics?: string[]; continuationFocus?: string } = {}
): Promise<{ seriesName: string; outlines: EpisodePlanOutline[] }> {
  const startIndex = Math.max(0, Math.round(options.startIndex || 0));
  const batchCount = Math.max(1, Math.min(20, Math.round(options.batchCount ?? req.initialBatchCount ?? req.episodeCount ?? 3)));
  const prompt = buildSeriesPlanPrompt(req, options.avoidTopics || [], {
    startIndex,
    batchCount,
    continuationFocus: options.continuationFocus,
  });
  return runner.runJson({
    systemInstruction: prompt.systemInstruction,
    userPrompt: prompt.userPrompt,
    temperature: 0.75,
    parseAndValidate: (payload) => {
      const obj = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
      const rawEps = Array.isArray(obj.episodes) ? obj.episodes : [];
      if (rawEps.length === 0) {
        throw new Error('لم يُرجع الذكاء الاصطناعي خطة حلقات صالحة.');
      }
      const outlines: EpisodePlanOutline[] = Array.from({ length: batchCount }, (_, offset) => {
        const epIdx = startIndex + offset;
        const item = (rawEps[offset] && typeof rawEps[offset] === 'object' ? rawEps[offset] : {}) as Record<
          string,
          unknown
        >;
        return {
          index: epIdx,
          title:
            typeof item.title === 'string' && item.title.trim()
              ? item.title.trim()
              : `${req.topic.slice(0, 36)} — الحلقة ${epIdx + 1}`,
          angle:
            typeof item.angle === 'string' && item.angle.trim()
              ? item.angle.trim()
              : `زاوية معرفية مستقلة للحلقة ${epIdx + 1}`,
          hookIdea:
            typeof item.hookIdea === 'string' && item.hookIdea.trim()
              ? item.hookIdea.trim()
              : `حقيقة غير متوقعة في الحلقة ${epIdx + 1}`,
          keyTakeaway:
            typeof item.keyTakeaway === 'string' && item.keyTakeaway.trim()
              ? item.keyTakeaway.trim()
              : `خلاصة الحلقة ${epIdx + 1}`,
        };
      });
      const seriesName =
        typeof obj.seriesName === 'string' && obj.seriesName.trim()
          ? obj.seriesName.trim().slice(0, 110)
          : req.topic.slice(0, 90);
      return { seriesName, outlines };
    },
  });
}

async function generateSingleEpisodeContent(
  req: CreateSeriesRequest,
  series: Series,
  outline: EpisodePlanOutline,
  allOutlines: EpisodePlanOutline[],
  runner: SeriesTextRunner,
  existingEpId?: string
): Promise<Episode> {
  const prompt = buildEpisodeDetailPrompt(req, outline, allOutlines);
  const rawEp = await runner.runJson<Record<string, unknown>>({
    systemInstruction: prompt.systemInstruction,
    userPrompt: prompt.userPrompt,
    temperature: 0.72,
    parseAndValidate: (payload) => {
      const obj = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
      if (!Array.isArray(obj.scenes) || obj.scenes.length === 0) {
        throw new Error('لم يحتوِ الرد على مشاهد صالحة للحلقة.');
      }
      return obj;
    },
  });
  return normalizeBuiltEpisode(rawEp, series, outline.index, existingEpId);
}

export function enqueueCreateSeriesJob(
  req: CreateSeriesRequest,
  runner: SeriesTextRunner
): { series: Series; job: GenerationJob } {
  pruneStoresIfNeeded();
  const now = Date.now();
  const seriesId = makeId('series');
  const jobId = makeId('job');
  const brand = resolveBrandPreset(req);
  const batchLimit = Math.max(
    1,
    Math.min(20, Math.round(req.initialBatchCount ?? Math.min(req.episodeCount, 8)))
  );

  const series: Series = {
    id: seriesId,
    schemaVersion: CURRENT_SERIES_SCHEMA_VERSION,
    name: req.topic.slice(0, 90),
    topic: req.topic,
    prompt: req.topic,
    language: req.language,
    audience: req.audience,
    status: 'queued',
    episodeCount: req.episodeCount,
    isOpenEnded: Boolean(req.isOpenEnded),
    scenesPerEpisode: Math.max(0, Math.min(30, Math.round(req.scenesPerEpisode || 0))),
    targetDurationSec: req.targetDurationSec,
    stylePreset: req.stylePreset,
    brandPreset: brand,
    format: req.format,
    episodes: createPlaceholderEpisodes(seriesId, req, brand, batchLimit, 0),
    activeJobId: jobId,
    createdAt: now,
    updatedAt: now,
  };

  const job: GenerationJob = {
    id: jobId,
    seriesId,
    type: 'fullSeries',
    status: 'queued',
    progress: 4,
    stageLabel: 'تمت إضافة السلسلة إلى قائمة الانتظار...',
    completedEpisodes: 0,
    totalEpisodes: batchLimit,
    failedEpisodeIds: [],
    createdAt: now,
    updatedAt: now,
  };

  seriesStore.set(seriesId, series);
  jobsStore.set(jobId, job);
  schedulePersistStores(true);

  setImmediate(() => {
    void (async () => {
      const currentSeries = seriesStore.get(seriesId);
      const currentJob = jobsStore.get(jobId);
      if (!currentSeries || !currentJob) return;

      currentSeries.status = 'generating';
      currentJob.status = 'generating';
      currentJob.progress = 12;
      currentJob.stageLabel = 'جارٍ بناء خطة السلسلة وتوزيع محاور الحلقات...';
      currentJob.updatedAt = Date.now();
      schedulePersistStores();

      let outlines: EpisodePlanOutline[] = [];
      try {
        const plan = await generatePlanOutlines(req, runner, {
          startIndex: 0,
          batchCount: batchLimit,
        });
        outlines = plan.outlines;
        currentSeries.name = plan.seriesName;
        currentSeries.episodes = currentSeries.episodes.map((ep, idx) => ({
          ...ep,
          title: outlines[idx]?.title || ep.title,
          hook: outlines[idx]?.hookIdea || ep.hook,
          updatedAt: Date.now(),
        }));
        currentSeries.updatedAt = Date.now();
        currentJob.progress = 24;
        currentJob.updatedAt = Date.now();
        schedulePersistStores();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'فشل تخطيط السلسلة.';
        currentSeries.status = 'failed';
        currentSeries.error = msg;
        currentSeries.episodes = currentSeries.episodes.map((ep) => ({
          ...ep,
          status: 'failed',
          error: msg,
        }));
        currentJob.status = 'failed';
        currentJob.error = msg;
        currentJob.stageLabel = 'تعذر إنشاء خطة السلسلة.';
        currentJob.updatedAt = Date.now();
        schedulePersistStores(true);
        return;
      }

      for (let i = 0; i < outlines.length; i++) {
        const outline = outlines[i];
        const targetEp = currentSeries.episodes[i];
        if (targetEp) {
          targetEp.status = 'generating';
          targetEp.updatedAt = Date.now();
        }
        currentJob.stageLabel = `جارٍ كتابة وتجهيز الحلقة ${i + 1} من ${outlines.length}...`;
        currentJob.progress = Math.min(94, 24 + Math.round((i / outlines.length) * 70));
        currentJob.updatedAt = Date.now();

        try {
          const builtEp = await generateSingleEpisodeContent(
            req,
            currentSeries,
            outline,
            outlines,
            runner,
            targetEp?.id
          );
          currentSeries.episodes[i] = builtEp;
          currentJob.completedEpisodes += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'تعذر توليد الحلقة.';
          if (targetEp) {
            targetEp.status = 'failed';
            targetEp.error = msg;
            targetEp.updatedAt = Date.now();
            currentJob.failedEpisodeIds.push(targetEp.id);
          }
        }
        currentSeries.updatedAt = Date.now();
        currentJob.progress = Math.min(96, 24 + Math.round(((i + 1) / outlines.length) * 72));
        currentJob.updatedAt = Date.now();
        schedulePersistStores();
      }

      const anySucceeded = currentJob.completedEpisodes > 0;
      const anyFailed = currentJob.failedEpisodeIds.length > 0;
      const anyReviewing = currentSeries.episodes.some((e) => e.status === 'reviewing');

      if (!anySucceeded) {
        currentSeries.status = 'failed';
        currentSeries.error = 'تعذر توليد جميع الحلقات. يمكنك إعادة المحاولة.';
        currentJob.status = 'failed';
        currentJob.stageLabel = 'فشل توليد الحلقات.';
      } else if (anyFailed || anyReviewing) {
        currentSeries.status = 'reviewing';
        currentSeries.error = anyFailed
          ? `نجحت ${currentJob.completedEpisodes} حلقات وفشلت ${currentJob.failedEpisodeIds.length} حلقات — يمكنك إعادة توليدها.`
          : undefined;
        currentJob.status = 'reviewing';
        currentJob.stageLabel = anyFailed
          ? 'اكتمل التوليد الجزئي — بعض الحلقات تحتاج إعادة محاولة'
          : 'اكتملت الدفعة — بعض المعلومات بحاجة لمراجعة سريعة';
      } else {
        currentSeries.status = 'ready';
        currentJob.status = 'ready';
        currentJob.stageLabel = 'الحلقات جاهزة للمعاينة والتصدير ويمكنك متابعة توليد المزيد!';
      }

      currentJob.progress = 100;
      currentJob.updatedAt = Date.now();
      currentSeries.updatedAt = Date.now();
      schedulePersistStores(true);
    })();
  });

  return { series, job };
}

export function enqueueAppendEpisodesJob(
  series: Series,
  params: { count: number; focusTopic?: string; scenesPerEpisode?: number },
  runner: SeriesTextRunner
): { series: Series; job: GenerationJob } {
  pruneStoresIfNeeded();
  const safeCount = Math.max(1, Math.min(20, Math.round(params.count || 5)));
  const startIndex = series.episodes.length;
  const now = Date.now();
  const jobId = makeId('job-append');

  const placeholders = createPlaceholderEpisodes(
    series.id,
    { targetDurationSec: series.targetDurationSec, format: series.format },
    series.brandPreset,
    safeCount,
    startIndex
  );

  const nextScenesPerEp =
    typeof params.scenesPerEpisode === 'number'
      ? Math.max(0, Math.min(30, Math.round(params.scenesPerEpisode)))
      : series.scenesPerEpisode || 0;

  const updatedSeries: Series = {
    ...series,
    scenesPerEpisode: nextScenesPerEp,
    episodeCount: Math.max(series.episodeCount, startIndex + safeCount),
    status: 'generating',
    activeJobId: jobId,
    episodes: [...series.episodes, ...placeholders],
    updatedAt: now,
  };

  const job: GenerationJob = {
    id: jobId,
    seriesId: series.id,
    type: 'fullSeries',
    status: 'queued',
    progress: 6,
    stageLabel: `تحضير دفعة جديدة (+${safeCount} حلقات) تبدأ من الحلقة ${startIndex + 1}...`,
    completedEpisodes: 0,
    totalEpisodes: safeCount,
    failedEpisodeIds: [],
    createdAt: now,
    updatedAt: now,
  };

  seriesStore.set(series.id, updatedSeries);
  jobsStore.set(jobId, job);
  schedulePersistStores(true);

  setImmediate(() => {
    void (async () => {
      const currentSeries = seriesStore.get(series.id);
      const currentJob = jobsStore.get(jobId);
      if (!currentSeries || !currentJob) return;

      const req: CreateSeriesRequest = {
        topic: currentSeries.topic,
        stylePreset: currentSeries.stylePreset,
        language: currentSeries.language,
        audience: currentSeries.audience,
        targetDurationSec: currentSeries.targetDurationSec,
        episodeCount: currentSeries.episodeCount,
        isOpenEnded: currentSeries.isOpenEnded,
        scenesPerEpisode: nextScenesPerEp,
        initialBatchCount: safeCount,
        format: currentSeries.format,
        brandPreset: currentSeries.brandPreset,
      };

      const existingTitles = currentSeries.episodes
        .slice(0, startIndex)
        .map((e) => e.title)
        .filter(Boolean);

      currentJob.status = 'generating';
      currentJob.progress = 14;
      currentJob.stageLabel = 'جارٍ تخطيط استكمال الحلقات بدون تكرار...';
      currentJob.updatedAt = Date.now();
      schedulePersistStores();

      let outlines: EpisodePlanOutline[] = [];
      try {
        const plan = await generatePlanOutlines(req, runner, {
          startIndex,
          batchCount: safeCount,
          avoidTopics: existingTitles,
          continuationFocus: params.focusTopic,
        });
        outlines = plan.outlines;
        for (let offset = 0; offset < outlines.length; offset++) {
          const epPos = startIndex + offset;
          if (currentSeries.episodes[epPos]) {
            currentSeries.episodes[epPos] = {
              ...currentSeries.episodes[epPos],
              title: outlines[offset].title,
              hook: outlines[offset].hookIdea,
              updatedAt: Date.now(),
            };
          }
        }
        currentSeries.updatedAt = Date.now();
        currentJob.progress = 26;
        currentJob.updatedAt = Date.now();
        schedulePersistStores();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'فشل تخطيط الدفعة الجديدة.';
        for (let offset = 0; offset < safeCount; offset++) {
          const epPos = startIndex + offset;
          if (currentSeries.episodes[epPos]) {
            currentSeries.episodes[epPos].status = 'failed';
            currentSeries.episodes[epPos].error = msg;
            currentJob.failedEpisodeIds.push(currentSeries.episodes[epPos].id);
          }
        }
        currentSeries.status = 'reviewing';
        currentJob.status = 'failed';
        currentJob.error = msg;
        currentJob.stageLabel = 'تعذر تخطيط الحلقات الإضافية.';
        currentJob.updatedAt = Date.now();
        schedulePersistStores(true);
        return;
      }

      const siblingPool: EpisodePlanOutline[] = [
        ...currentSeries.episodes.slice(0, startIndex).map((ep, idx) => ({
          index: idx,
          title: ep.title,
          angle: ep.narration.scriptSummary || ep.title,
          hookIdea: ep.hook,
          keyTakeaway: ep.publishKit.pinnedComment || ep.title,
        })),
        ...outlines,
      ];

      for (let offset = 0; offset < outlines.length; offset++) {
        const epPos = startIndex + offset;
        const outline = outlines[offset];
        const targetEp = currentSeries.episodes[epPos];
        if (targetEp) {
          targetEp.status = 'generating';
          targetEp.updatedAt = Date.now();
        }
        currentJob.stageLabel = `جارٍ كتابة الحلقة ${epPos + 1} (دفعة +${safeCount})...`;
        currentJob.progress = Math.min(94, 26 + Math.round((offset / outlines.length) * 68));
        currentJob.updatedAt = Date.now();

        try {
          const builtEp = await generateSingleEpisodeContent(
            req,
            currentSeries,
            outline,
            siblingPool,
            runner,
            targetEp?.id
          );
          currentSeries.episodes[epPos] = builtEp;
          currentJob.completedEpisodes += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'تعذر توليد الحلقة.';
          if (targetEp) {
            targetEp.status = 'failed';
            targetEp.error = msg;
            targetEp.updatedAt = Date.now();
            currentJob.failedEpisodeIds.push(targetEp.id);
          }
        }
        currentSeries.updatedAt = Date.now();
        currentJob.progress = Math.min(96, 26 + Math.round(((offset + 1) / outlines.length) * 70));
        currentJob.updatedAt = Date.now();
        schedulePersistStores();
      }

      const anyFailed = currentSeries.episodes.some((e) => e.status === 'failed');
      const anyReviewing = currentSeries.episodes.some((e) => e.status === 'reviewing');
      currentSeries.status = anyFailed || anyReviewing ? 'reviewing' : 'ready';
      currentSeries.updatedAt = Date.now();
      currentJob.status =
        currentJob.completedEpisodes === 0
          ? 'failed'
          : currentJob.failedEpisodeIds.length > 0 || anyReviewing
            ? 'reviewing'
            : 'ready';
      currentJob.stageLabel =
        currentJob.completedEpisodes > 0
          ? `تمت إضافة ${currentJob.completedEpisodes} حلقات جديدة بنجاح!`
          : 'تعذر توليد الحلقات الإضافية.';
      currentJob.progress = 100;
      currentJob.updatedAt = Date.now();
      schedulePersistStores(true);
    })();
  });

  return { series: updatedSeries, job };
}

export function getJobSnapshot(jobId: string): { job: GenerationJob; series?: Series } | null {
  const job = jobsStore.get(jobId);
  if (!job) return null;
  const series = seriesStore.get(job.seriesId);
  return { job, series };
}

export function getSeriesSnapshot(seriesId: string): Series | null {
  return seriesStore.get(seriesId) || null;
}

export function hydrateOrGetSeries(seriesId: string, snapshot?: unknown): Series | null {
  const existing = seriesStore.get(seriesId);
  if (existing) return existing;
  if (snapshot && typeof snapshot === 'object') {
    const migrated = migrateSeriesSchema({ ...(snapshot as Record<string, unknown>), id: seriesId });
    seriesStore.set(seriesId, migrated);
    return migrated;
  }
  return null;
}

export function enqueueRegenerateEpisode(
  series: Series,
  episodeId: string,
  runner: SeriesTextRunner
): { series: Series; job: GenerationJob } | null {
  const epIdx = series.episodes.findIndex((e) => e.id === episodeId);
  if (epIdx === -1) return null;

  const jobId = makeId('job-ep');
  const now = Date.now();
  const job: GenerationJob = {
    id: jobId,
    seriesId: series.id,
    type: 'episode',
    status: 'queued',
    progress: 10,
    stageLabel: `إعادة توليد الحلقة ${epIdx + 1}...`,
    completedEpisodes: 0,
    totalEpisodes: 1,
    failedEpisodeIds: [],
    createdAt: now,
    updatedAt: now,
  };

  series.episodes[epIdx] = {
    ...series.episodes[epIdx],
    status: 'generating',
    error: undefined,
    updatedAt: now,
  };
  series.activeJobId = jobId;
  series.status = 'generating';
  series.updatedAt = now;

  seriesStore.set(series.id, series);
  jobsStore.set(jobId, job);
  schedulePersistStores(true);

  setImmediate(() => {
    void (async () => {
      const targetSeries = seriesStore.get(series.id);
      const targetJob = jobsStore.get(jobId);
      if (!targetSeries || !targetJob) return;

      targetJob.status = 'generating';
      targetJob.progress = 35;
      targetJob.updatedAt = Date.now();
      schedulePersistStores();

      const outlines: EpisodePlanOutline[] = targetSeries.episodes.map((ep, i) => ({
        index: i,
        title: ep.title,
        angle: ep.narration.scriptSummary || ep.title,
        hookIdea: ep.hook,
        keyTakeaway: ep.publishKit.pinnedComment || ep.title,
      }));

      const req: CreateSeriesRequest = {
        topic: targetSeries.topic,
        stylePreset: targetSeries.stylePreset,
        language: targetSeries.language,
        audience: targetSeries.audience,
        targetDurationSec: targetSeries.targetDurationSec,
        episodeCount: targetSeries.episodeCount,
        isOpenEnded: targetSeries.isOpenEnded,
        scenesPerEpisode: targetSeries.scenesPerEpisode,
        format: targetSeries.format,
        brandPreset: targetSeries.brandPreset,
      };

      try {
        const rebuilt = await generateSingleEpisodeContent(
          req,
          targetSeries,
          outlines[epIdx],
          outlines,
          runner,
          episodeId
        );
        targetSeries.episodes[epIdx] = rebuilt;
        targetJob.completedEpisodes = 1;
        targetJob.status = rebuilt.status === 'reviewing' ? 'reviewing' : 'ready';
        targetJob.stageLabel = 'تمت إعادة توليد الحلقة بنجاح.';
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذر إعادة توليد الحلقة.';
        targetSeries.episodes[epIdx] = {
          ...targetSeries.episodes[epIdx],
          status: 'failed',
          error: msg,
          updatedAt: Date.now(),
        };
        targetJob.status = 'failed';
        targetJob.failedEpisodeIds = [episodeId];
        targetJob.error = msg;
        targetJob.stageLabel = 'فشلت إعادة توليد الحلقة.';
      }

      const anyFailed = targetSeries.episodes.some((e) => e.status === 'failed');
      const anyReview = targetSeries.episodes.some((e) => e.status === 'reviewing');
      targetSeries.status = anyFailed || anyReview ? 'reviewing' : 'ready';
      targetSeries.updatedAt = Date.now();
      targetJob.progress = 100;
      targetJob.updatedAt = Date.now();
      schedulePersistStores(true);
    })();
  });

  return { series, job };
}

export async function regenerateSingleScene(
  series: Series,
  episodeId: string,
  sceneId: string,
  customInstruction: string | undefined,
  runner: SeriesTextRunner
): Promise<{ series: Series; episode: Episode; scene: Scene } | null> {
  const epIdx = series.episodes.findIndex((e) => e.id === episodeId);
  if (epIdx === -1) return null;
  const episode = series.episodes[epIdx];
  const scIdx = episode.scenes.findIndex((s) => s.id === sceneId);
  if (scIdx === -1) return null;
  const oldScene = episode.scenes[scIdx];

  const prompt = buildSceneRegeneratePrompt(series, episode, oldScene, customInstruction);
  const rawScene = await runner.runJson<Record<string, unknown>>({
    systemInstruction: prompt.systemInstruction,
    userPrompt: prompt.userPrompt,
    temperature: 0.78,
    parseAndValidate: (payload) => {
      if (!payload || typeof payload !== 'object') {
        throw new Error('استجابة المشهد غير صالحة.');
      }
      return payload as Record<string, unknown>;
    },
  });

  const migrated = migrateSceneSchema(
    {
      ...oldScene,
      ...rawScene,
      id: oldScene.id,
      index: oldScene.index,
    },
    oldScene.index
  );
  migrated.factCheck = evaluateFactConfidenceHeuristic(
    migrated.narration,
    rawScene.factCheck && typeof rawScene.factCheck === 'object'
      ? (rawScene.factCheck as { status?: string; confidence?: number; flagReason?: string })
      : undefined
  );

  const nextScenes = [...episode.scenes];
  nextScenes[scIdx] = migrated;
  const nextEpisode = migrateEpisodeSchema(
    {
      ...episode,
      scenes: nextScenes,
      script: nextScenes.map((s) => s.narration).join('\n\n'),
      captions: buildCaptionsFromScenes(nextScenes),
      updatedAt: Date.now(),
    },
    series.id,
    epIdx,
    series.format
  );

  series.episodes[epIdx] = nextEpisode;
  series.updatedAt = Date.now();
  seriesStore.set(series.id, series);
  schedulePersistStores(true);

  return { series, episode: nextEpisode, scene: migrated };
}

export async function generateMissingEpisodeAssets(
  series: Series,
  episodeId: string,
  runner: SeriesTextRunner
): Promise<{ series: Series; episode: Episode; generatedCount: number } | null> {
  const epIdx = series.episodes.findIndex((e) => e.id === episodeId);
  if (epIdx === -1) return null;
  const episode = series.episodes[epIdx];

  let generatedCount = 0;
  const nextScenes = [...episode.scenes];
  for (let i = 0; i < nextScenes.length; i++) {
    const sc = nextScenes[i];
    if (sc.visualAssetUrl) continue;

    let assetUrl = '';
    try {
      const svgRes = await runner.runJson<{ svg: string }>({
        systemInstruction:
          'أنت مصمم جرافيك متجهات SVG. أنشئ كود SVG بسيطاً ونظيفاً وعالي التباين بدون أي نصوص برمجية أو script.',
        userPrompt: `صمّم رسماً توضيحياً SVG (viewBox="0 0 800 450") يعبر عن: "${sc.visualPrompt || sc.narration.slice(0, 80)}".
استخدم ألوان الهوية: خلفية ${series.brandPreset.primaryColors.bg}، تمييز ${series.brandPreset.primaryColors.accent}، وذهبي ${series.brandPreset.secondaryColors.border}.
أرجع JSON فقط: { "svg": "<svg ...>...</svg>" }`,
        temperature: 0.65,
        parseAndValidate: (payload) => {
          const obj = (payload && typeof payload === 'object' ? payload : {}) as Record<
            string,
            unknown
          >;
          if (typeof obj.svg !== 'string') throw new Error('missing svg');
          return { svg: obj.svg };
        },
      });
      assetUrl = sanitizeSvgToDataUrl(svgRes.svg) || '';
    } catch {
      assetUrl = '';
    }

    if (!assetUrl) {
      assetUrl = buildFallbackBrandedSvg(sc, series.brandPreset, i);
    }

    if (assetUrl) {
      nextScenes[i] = {
        ...sc,
        visualAssetUrl: assetUrl,
        visualType: 'svg',
      };
      generatedCount += 1;
    }
  }

  const nextEpisode = {
    ...episode,
    scenes: nextScenes,
    updatedAt: Date.now(),
  };
  series.episodes[epIdx] = nextEpisode;
  series.updatedAt = Date.now();
  seriesStore.set(series.id, series);
  schedulePersistStores(true);

  return { series, episode: nextEpisode, generatedCount };
}
