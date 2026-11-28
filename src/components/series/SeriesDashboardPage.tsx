import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Film,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  Layers,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  BrandPreset,
  Episode,
  GenerationJob,
  Scene,
  SceneAnimation,
  SceneMood,
  Series,
} from '../../types/series';
import { QuizProject, SlideTransitionStyle } from '../../types/quiz';
import {
  loadSeriesByIdFromStore,
  saveSeriesBrandPreset,
  saveSeriesToStore,
} from '../../storage/seriesStore';
import { migrateEpisodeSchema, migrateSceneSchema } from '../../series/migrations';
import { loadProjectById, saveProjectToStore } from '../../storage/projectStore';
import {
  appendEpisodesRequest,
  fetchSeriesFromServer,
  fetchSeriesJobStatus,
  generateMissingEpisodeAssetsRequest,
  regenerateEpisodeRequest,
  regenerateSceneRequest,
} from '../../services/seriesClient';
import {
  listCloudSeries,
  pushBrandPresetToCloud,
  pushSeriesToCloud,
  subscribeFirebaseUser,
} from '../../services/firebaseClient';
import {
  brandPresetToTemplatePatch,
  mapEpisodeToQuizProject,
} from '../../series/projectMapper';
import {
  YouTubeChannelInfo,
  YouTubePlaylistItem,
  YouTubePrivacyStatus,
  connectYouTubeWithPopup,
  disconnectYouTubeSession,
  fetchMyYouTubePlaylists,
  initYouTubeAuthListener,
} from '../../services/youtubeClient';
import { YoutubePublishKit } from '../../services/aiClient';
import { ShortsPreviewStage } from '../ShortsPreviewStage';
import { ExportVideoModal } from '../ExportVideoModal';
import { BrandIdentityDrawer } from './BrandIdentityDrawer';
import { BatchSeriesExportModal } from './BatchSeriesExportModal';
import { saveOrDownloadBlob } from '../../utils/nativeDownload';
import { generateProjectSrt } from '../../utils/subtitleExport';
import { triggerHaptic } from '../../utils/haptics';
import {
  SCENE_ANIMATION_OPTIONS,
  SCENE_MOOD_OPTIONS,
  STATUS_ARABIC_LABEL,
  STATUS_TEXT_CLASS,
  TRANSITION_OPTIONS,
  countFlaggedClaimsInEpisode,
  formatDurationSeconds,
  getAudienceLabel,
  getLanguageLabel,
  getStyleLabel,
} from './seriesHelpers';

interface SeriesDashboardPageProps {
  seriesId: string;
  onNavigate: (path: string) => void;
}

type EpisodeDetailTab = 'scenes' | 'script' | 'publish';

export const SeriesDashboardPage: React.FC<SeriesDashboardPageProps> = ({
  seriesId,
  onNavigate,
}) => {
  const [series, setSeries] = useState<Series | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState(0);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<EpisodeDetailTab>('scenes');

  const [isBrandDrawerOpen, setIsBrandDrawerOpen] = useState(false);
  const [isBatchExportOpen, setIsBatchExportOpen] = useState(false);
  const [isSingleExportOpen, setIsSingleExportOpen] = useState(false);

  const [regenBusyEpisodeId, setRegenBusyEpisodeId] = useState<string | null>(null);
  const [regenBusySceneId, setRegenBusySceneId] = useState<string | null>(null);
  const [sceneNoteMap, setSceneNoteMap] = useState<Record<string, string>>({});
  const [assetsBusyEpisodeId, setAssetsBusyEpisodeId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Open-ended continuation batch state
  const [showAppendPanel, setShowAppendPanel] = useState(false);
  const [appendCount, setAppendCount] = useState(5);
  const [appendFocus, setAppendFocus] = useState('');
  const [appendScenesPerEp, setAppendScenesPerEp] = useState<number>(0);
  const [isAppending, setIsAppending] = useState(false);

  // Firebase & YouTube session for single episode ExportVideoModal
  const cloudVerifiedRef = useRef(false);
  const [ytConnected, setYtConnected] = useState(false);
  const [ytChannel, setYtChannel] = useState<YouTubeChannelInfo | null>(null);
  const [ytEmail, setYtEmail] = useState<string | null>(null);
  const [ytPlaylists, setYtPlaylists] = useState<YouTubePlaylistItem[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [ytPrivacy, setYtPrivacy] = useState<YouTubePrivacyStatus>('private');
  const [ytUseSchedule, setYtUseSchedule] = useState(false);
  const [ytScheduleLocal, setYtScheduleLocal] = useState('');
  const [ytAutoPostComment, setYtAutoPostComment] = useState(true);
  const [isConnectingYt, setIsConnectingYt] = useState(false);
  const [ytAuthError, setYtAuthError] = useState('');

  useEffect(() => {
    return subscribeFirebaseUser((user) => {
      cloudVerifiedRef.current = Boolean(user && user.emailVerified);
    });
  }, []);

  useEffect(() => {
    return initYouTubeAuthListener((session) => {
      setYtConnected(session.connected);
      setYtChannel(session.channel);
      setYtEmail(session.email);
      if (session.connected && session.token) {
        void fetchMyYouTubePlaylists(session.token).then(setYtPlaylists);
      } else {
        setYtPlaylists([]);
        setSelectedPlaylistId('');
      }
    });
  }, []);

  // Load initial series (Local IDB -> Server -> Cloud)
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);

    const resolveSeries = async () => {
      const local = await loadSeriesByIdFromStore(seriesId);
      if (local && active) {
        setSeries(local);
        setLoading(false);
      }

      const fromServer = await fetchSeriesFromServer(seriesId);
      if (fromServer && active) {
        const chosen =
          !local || fromServer.updatedAt >= local.updatedAt ? fromServer : local;
        setSeries(chosen);
        await saveSeriesToStore(chosen);
        setLoading(false);
        return;
      }

      if (!local && active) {
        try {
          const cloudList = await listCloudSeries();
          const fromCloud = cloudList.find((s) => s.id === seriesId);
          if (fromCloud && active) {
            setSeries(fromCloud);
            await saveSeriesToStore(fromCloud);
            setLoading(false);
            return;
          }
        } catch {
          // ignore
        }
        if (active) {
          setLoadError('لم يتم العثور على السلسلة المطلوبة.');
          setLoading(false);
        }
      }
    };

    void resolveSeries();
    return () => {
      active = false;
    };
  }, [seriesId]);

  // Poll active background generation job until terminal state
  const activeJobId = series?.activeJobId;
  const seriesStatus = series?.status;

  useEffect(() => {
    if (!activeJobId) return;
    if (seriesStatus !== 'queued' && seriesStatus !== 'generating') return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetchSeriesJobStatus(activeJobId);
        if (cancelled) return;
        setJob(res.job);
        if (res.series) {
          setSeries(res.series);
          await saveSeriesToStore(res.series);
          if (
            cloudVerifiedRef.current &&
            res.job.status !== 'queued' &&
            res.job.status !== 'generating'
          ) {
            void pushSeriesToCloud(res.series).catch(() => {});
          }
        }
      } catch {
        // continue gracefully on transient network blip
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobId, seriesStatus]);

  const persistSeriesUpdate = useCallback(async (next: Series) => {
    const stamped: Series = { ...next, updatedAt: Date.now() };
    setSeries(stamped);
    await saveSeriesToStore(stamped);
    if (cloudVerifiedRef.current) {
      void pushSeriesToCloud(stamped).catch(() => {});
    }
  }, []);

  const activeEpisode: Episode | undefined = useMemo(() => {
    if (!series || series.episodes.length === 0) return undefined;
    return series.episodes[activeEpisodeIndex] || series.episodes[0];
  }, [series, activeEpisodeIndex]);

  const mappedActiveProject: QuizProject | null = useMemo(() => {
    if (!series || !activeEpisode) return null;
    return mapEpisodeToQuizProject(activeEpisode, series);
  }, [series, activeEpisode]);

  const updateEpisode = useCallback(
    (episodeId: string, updater: (ep: Episode) => Episode) => {
      if (!series) return;
      const nextEpisodes = series.episodes.map((ep) =>
        ep.id === episodeId ? { ...updater(ep), updatedAt: Date.now() } : ep
      );
      void persistSeriesUpdate({ ...series, episodes: nextEpisodes });
    },
    [series, persistSeriesUpdate]
  );

  const updateScene = useCallback(
    (episodeId: string, sceneId: string, updater: (sc: Scene) => Scene) => {
      updateEpisode(episodeId, (ep) => {
        const scenes = ep.scenes.map((sc) => (sc.id === sceneId ? updater(sc) : sc));
        const totalDur = Math.max(
          10,
          Math.round(scenes.reduce((acc, sc) => acc + (Number(sc.duration) || 6), 0))
        );
        return { ...ep, scenes, duration: totalDur };
      });
    },
    [updateEpisode]
  );

  const handleApplyUnifiedBrand = async (nextBrand: BrandPreset) => {
    if (!series) return;
    await saveSeriesBrandPreset(nextBrand);
    if (cloudVerifiedRef.current) {
      void pushBrandPresetToCloud(nextBrand).catch(() => {});
    }

    const nextSeries: Series = {
      ...series,
      brandPreset: nextBrand,
      updatedAt: Date.now(),
    };
    await persistSeriesUpdate(nextSeries);

    // Sync any already-opened QuizProject refs locally
    for (const ep of nextSeries.episodes) {
      if (!ep.projectRef) continue;
      const existingProj = await loadProjectById(ep.projectRef);
      if (existingProj) {
        const patched: QuizProject = {
          ...existingProj,
          template: brandPresetToTemplatePatch(nextBrand, nextSeries.format, existingProj.template),
          preferredAiVoice: nextBrand.narrator.voice,
          updatedAt: Date.now(),
        };
        await saveProjectToStore(patched);
      }
    }

    setStatusNotice('تم تطبيق الهوية الموحدة على كل حلقات السلسلة والمشاريع المرتبطة ✓');
  };

  const handleRegenerateEpisode = async (episodeId: string) => {
    if (!series || regenBusyEpisodeId) return;
    triggerHaptic('medium');
    setRegenBusyEpisodeId(episodeId);
    setStatusNotice(null);
    try {
      const res = await regenerateEpisodeRequest(series, episodeId);
      setJob(res.job);
      await persistSeriesUpdate(res.series);
    } catch (err) {
      setStatusNotice(err instanceof Error ? err.message : 'تعذر إعادة توليد الحلقة.');
    } finally {
      setRegenBusyEpisodeId(null);
    }
  };

  const handleRegenerateScene = async (episodeId: string, sceneId: string) => {
    if (!series || regenBusySceneId) return;
    triggerHaptic('medium');
    setRegenBusySceneId(sceneId);
    setStatusNotice(null);
    try {
      const note = sceneNoteMap[sceneId]?.trim();
      const res = await regenerateSceneRequest(series, episodeId, sceneId, note);
      await persistSeriesUpdate(res.series);
      setStatusNotice('تم تحديث المشهد وإعادة فحص معلوماته بنجاح ✓');
    } catch (err) {
      setStatusNotice(err instanceof Error ? err.message : 'تعذر إعادة توليد المشهد.');
    } finally {
      setRegenBusySceneId(null);
    }
  };

  const handleGenerateMissingAssets = async (episodeId: string) => {
    if (!series || assetsBusyEpisodeId) return;
    triggerHaptic('medium');
    setAssetsBusyEpisodeId(episodeId);
    setStatusNotice(null);
    try {
      const res = await generateMissingEpisodeAssetsRequest(series, episodeId);
      await persistSeriesUpdate(res.series);
      setStatusNotice(
        res.generatedCount > 0
          ? `تم توليد ${res.generatedCount} أصول بصرية جديدة للحلقة ✓`
          : 'جميع مشاهد هذه الحلقة تمتلك أصولاً بصرية بالفعل.'
      );
    } catch (err) {
      setStatusNotice(err instanceof Error ? err.message : 'تعذر توليد الأصول البصرية.');
    } finally {
      setAssetsBusyEpisodeId(null);
    }
  };

  const handleOpenInAdvancedStudio = async (episode?: Episode) => {
    if (!series) return;
    triggerHaptic('medium');
    if (!episode || episode.scenes.length === 0) {
      onNavigate(`/advanced?seriesId=${encodeURIComponent(series.id)}`);
      return;
    }
    const existing = episode.projectRef ? await loadProjectById(episode.projectRef) : null;
    const mapped = mapEpisodeToQuizProject(episode, series, existing || undefined);
    await saveProjectToStore(mapped);

    if (episode.projectRef !== mapped.id) {
      updateEpisode(episode.id, (ep) => ({ ...ep, projectRef: mapped.id }));
    }

    onNavigate(`/advanced/${encodeURIComponent(mapped.id)}?seriesId=${encodeURIComponent(series.id)}`);
  };

  const handleAppendEpisodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!series || isAppending) return;
    triggerHaptic('medium');
    setIsAppending(true);
    setStatusNotice(null);
    try {
      const res = await appendEpisodesRequest(series, {
        count: Math.max(1, Math.min(20, Math.round(appendCount || 5))),
        focusTopic: appendFocus.trim() || undefined,
        scenesPerEpisode: appendScenesPerEp > 0 ? appendScenesPerEp : series.scenesPerEpisode,
      });
      setJob(res.job);
      await persistSeriesUpdate(res.series);
      setShowAppendPanel(false);
      setAppendFocus('');
      setActiveEpisodeIndex(Math.max(0, res.series.episodes.length - Math.max(1, appendCount)));
      setActiveSceneIndex(0);
    } catch (err) {
      setStatusNotice(err instanceof Error ? err.message : 'تعذر إضافة الدفعة الجديدة.');
    } finally {
      setIsAppending(false);
    }
  };

  const handleAddManualEpisode = () => {
    if (!series) return;
    triggerHaptic('medium');
    const nextIdx = series.episodes.length;
    const epId = `${series.id}-ep-${nextIdx + 1}-${Date.now().toString(36)}`;
    const newEp = migrateEpisodeSchema(
      {
        id: epId,
        seriesId: series.id,
        index: nextIdx,
        title: `الحلقة ${nextIdx + 1}: عنوان جديد`,
        titleOptions: [`الحلقة ${nextIdx + 1}: عنوان جديد`],
        hook: 'اكتب هنا الجملة الافتتاحية الجاذبة لأول 3 ثوانٍ...',
        script: 'نص الحلقة الجديدة...',
        status: 'ready',
        scenes: [
          migrateSceneSchema(
            {
              id: `${epId}-sc-1`,
              index: 0,
              narration: 'المشهد الافتتاحي للحلقة الجديدة — عدّل النص والوصف البصري بحرية.',
              onScreenText: ['عنوان المشهد الأول'],
              visualPrompt: `مشهد افتتاحي يعبر عن ${series.topic}`,
              visualType: 'svg',
              duration: 8,
            },
            0
          ),
        ],
      },
      series.id,
      nextIdx,
      series.format
    );
    const nextEpisodes = [...series.episodes, newEp];
    void persistSeriesUpdate({
      ...series,
      episodeCount: Math.max(series.episodeCount, nextEpisodes.length),
      episodes: nextEpisodes,
    });
    setActiveEpisodeIndex(nextEpisodes.length - 1);
    setActiveSceneIndex(0);
    setStatusNotice(`تمت إضافة الحلقة ${nextIdx + 1} يدوياً ✓`);
  };

  const handleAddManualScene = (episodeId: string) => {
    if (!series) return;
    triggerHaptic('light');
    let nextCount = 1;
    updateEpisode(episodeId, (ep) => {
      const nextIdx = ep.scenes.length;
      const newScene = migrateSceneSchema(
        {
          id: `${ep.id}-sc-${nextIdx + 1}-${Date.now().toString(36)}`,
          index: nextIdx,
          narration: `محتوى المشهد ${nextIdx + 1}...`,
          onScreenText: [`نقطة المشهد ${nextIdx + 1}`],
          visualPrompt: `تكوين بصري احترافي للمشهد ${nextIdx + 1} حول ${ep.title}`,
          visualType: series.stylePreset === 'quizChallenge' ? 'quizCard' : 'svg',
          duration: 8,
        },
        nextIdx
      );
      const scenes = [...ep.scenes, newScene];
      nextCount = scenes.length;
      const duration = Math.max(
        10,
        Math.round(scenes.reduce((acc, sc) => acc + (Number(sc.duration) || 8), 0))
      );
      return {
        ...ep,
        scenes,
        duration,
        script: scenes.map((s) => s.narration).join('\n\n'),
      };
    });
    setActiveSceneIndex(Math.max(0, nextCount - 1));
  };

  const handleDeleteScene = (episodeId: string, sceneId: string) => {
    triggerHaptic('light');
    updateEpisode(episodeId, (ep) => {
      if (ep.scenes.length <= 1) return ep;
      const scenes = ep.scenes
        .filter((sc) => sc.id !== sceneId)
        .map((sc, idx) => ({ ...sc, index: idx }));
      const duration = Math.max(
        10,
        Math.round(scenes.reduce((acc, sc) => acc + (Number(sc.duration) || 8), 0))
      );
      return {
        ...ep,
        scenes,
        duration,
        script: scenes.map((s) => s.narration).join('\n\n'),
      };
    });
    setActiveSceneIndex((prev) => Math.max(0, prev - 1));
  };

  const handleDownloadSrt = async () => {
    if (!mappedActiveProject || !activeEpisode) return;
    triggerHaptic('light');
    const srt = generateProjectSrt(
      mappedActiveProject.slides,
      mappedActiveProject.timing,
      mappedActiveProject.audio,
      mappedActiveProject.template
    );
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    await saveOrDownloadBlob(blob, `${series?.id || 'series'}-ep${activeEpisode.index + 1}.srt`);
  };

  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      triggerHaptic('light');
      setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleConnectYouTube = async () => {
    if (isConnectingYt) return;
    setIsConnectingYt(true);
    setYtAuthError('');
    try {
      const res = await connectYouTubeWithPopup();
      setYtConnected(true);
      setYtChannel(res.channel);
      setYtEmail(res.email);
      const pls = await fetchMyYouTubePlaylists(res.accessToken);
      setYtPlaylists(pls);
    } catch (err) {
      setYtAuthError(err instanceof Error ? err.message : 'تعذر ربط حساب Google / YouTube.');
    } finally {
      setIsConnectingYt(false);
    }
  };

  const handleDisconnectYouTube = async () => {
    setYtAuthError('');
    await disconnectYouTubeSession();
    setYtConnected(false);
    setYtChannel(null);
    setYtEmail(null);
    setYtPlaylists([]);
    setSelectedPlaylistId('');
  };

  if (loading) {
    return (
      <div
        dir="rtl"
        className="min-h-[100dvh] bg-[var(--page)] text-[var(--ptxt)] p-6 max-w-7xl mx-auto space-y-6"
      >
        <div className="h-14 rounded-2xl border border-[var(--pline)] bg-[var(--panel)] animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl border border-[var(--pline)] bg-[var(--panel)] animate-pulse"
              />
            ))}
          </div>
          <div className="h-[520px] rounded-2xl border border-[var(--pline)] bg-[var(--panel)] animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadError || !series) {
    return (
      <div
        dir="rtl"
        className="min-h-[100dvh] bg-[var(--page)] text-[var(--ptxt)] flex flex-col items-center justify-center p-6 text-center space-y-4"
      >
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <h1 className="text-lg font-extrabold">{loadError || 'السلسلة غير موجودة'}</h1>
        <button
          type="button"
          onClick={() => onNavigate('/create')}
          className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#00B050] text-white text-sm font-extrabold cursor-pointer"
        >
          العودة إلى إنشاء سلسلة جديدة
        </button>
      </div>
    );
  }

  const isJobActive = series.status === 'queued' || series.status === 'generating';
  const failedEpisodes = series.episodes.filter((e) => e.status === 'failed');

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[var(--page)] text-[var(--ptxt)] flex flex-col">
      {/* Sticky Studio Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--pline)] bg-[var(--panel)]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Zone 1: Back + Series Title + Metadata */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onNavigate('/create');
              }}
              aria-label="العودة إلى صفحة إنشاء سلسلة"
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[var(--pline)] bg-[var(--surface)] hover:border-[#00B050]/65 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ArrowRight className="w-3.5 h-3.5 text-[#00c85b]" />
              <span>السلاسل</span>
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold truncate max-w-[240px] sm:max-w-[380px]">
                  {series.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-bold ${STATUS_TEXT_CLASS[series.status]}`}
                >
                  {isJobActive && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{STATUS_ARABIC_LABEL[series.status]}</span>
                </span>
              </div>
              <p className="text-[11px] font-mono-nums text-[var(--pmuted)] truncate">
                {getStyleLabel(series.stylePreset)} ·{' '}
                {series.isOpenEnded
                  ? `${series.episodes.length} حلقة (سلسلة مفتوحة)`
                  : series.episodeCount > series.episodes.length
                    ? `${series.episodes.length} من ${series.episodeCount} حلقة`
                    : `${series.episodes.length} حلقات`}{' '}
                · {series.format} · {getAudienceLabel(series.audience)} ·{' '}
                {getLanguageLabel(series.language)}
              </p>
            </div>
          </div>

          {/* Zone 2/3: Brand Identity, Batch Export, Open in Full Studio */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsBrandDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border border-[var(--pline)] bg-[var(--surface)] hover:border-[var(--gold)]/65 text-xs font-bold cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span>الهوية الموحدة</span>
            </button>

            <button
              type="button"
              onClick={() => void handleOpenInAdvancedStudio(activeEpisode)}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border border-[var(--pline)] bg-[var(--surface)] hover:border-[#00B050]/65 text-xs font-bold cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#00c85b]" />
              <span>الاستوديو الكامل</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                setIsBatchExportOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-[#00B050] hover:bg-[#00c85b] text-white text-xs sm:text-sm font-extrabold cursor-pointer"
            >
              <Film className="w-3.5 h-3.5" />
              <span>تصدير السلسلة</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Live Job Progress Banner */}
        {isJobActive && (
          <section
            aria-live="polite"
            className="rounded-2xl border border-[var(--gold)]/45 bg-[var(--panel)] p-4 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[var(--gold)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{job?.stageLabel || 'جارٍ توليد حلقات السلسلة ومشاهدها...'}</span>
              </div>
              <span className="text-xs font-mono-nums font-extrabold text-[var(--ptxt)]">
                {job?.progress ?? 15}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden">
              <div
                className="h-full bg-[#00B050] transition-all duration-300"
                style={{ width: `${Math.max(8, job?.progress ?? 15)}%` }}
              />
            </div>
          </section>
        )}

        {/* Partial failure recovery banner */}
        {failedEpisodes.length > 0 && (
          <section
            role="alert"
            className="rounded-2xl border border-rose-500/45 bg-rose-500/10 p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                تعذر توليد {failedEpisodes.length} حلقة مع الحفاظ على باقي الحلقات الجاهزة. يمكنك إعادة المحاولة لأي حلقة متعثرة.
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleRegenerateEpisode(failedEpisodes[0].id)}
              className="px-3.5 py-2 min-h-[40px] rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/50 text-xs font-extrabold text-white cursor-pointer"
            >
              إعادة توليد الحلقة المتعثرة
            </button>
          </section>
        )}

        {statusNotice && (
          <div className="rounded-xl border border-[#00B050]/45 bg-[#00B050]/10 px-4 py-2.5 text-xs sm:text-sm font-bold text-[#00c85b] flex items-center justify-between gap-2">
            <span>{statusNotice}</span>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              className="text-xs underline cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Main Dashboard Workspace: Episodes Sidebar + Active Episode Studio */}
        <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-5 items-start">
          {/* Episode Cards Column */}
          <aside className="rounded-2xl border border-[var(--pline)] bg-[var(--panel)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--gold)]" />
                <h2 className="text-sm font-extrabold">حلقات السلسلة</h2>
                {series.isOpenEnded && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--gold)]/15 text-[var(--gold)] text-[10px] font-bold">
                    <InfinityIcon className="w-3 h-3" />
                    <span>مفتوحة</span>
                  </span>
                )}
              </div>
              <span className="text-xs font-mono-nums text-[var(--pmuted)]">
                {series.isOpenEnded || series.episodeCount <= series.episodes.length
                  ? series.episodes.length
                  : `${series.episodes.length}/${series.episodeCount}`}
              </span>
            </div>

            {/* Continue / Append Episodes Action Row */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isJobActive || isAppending}
                onClick={() => {
                  triggerHaptic('light');
                  setAppendScenesPerEp(series.scenesPerEpisode || 0);
                  setShowAppendPanel((prev) => !prev);
                }}
                className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#00B050]/15 border border-[#00B050]/50 hover:bg-[#00B050]/25 text-[#00c85b] text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>توليد دفعة تالية</span>
              </button>

              <button
                type="button"
                onClick={handleAddManualEpisode}
                className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-[var(--pline)] bg-[var(--surface)] hover:border-[var(--gold)]/65 text-[var(--ptxt)] text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span>حلقة يدوية</span>
              </button>
            </div>

            {/* Expandable Append Episodes Form */}
            {showAppendPanel && (
              <form
                onSubmit={(e) => void handleAppendEpisodes(e)}
                className="p-3 rounded-xl border border-[#00B050]/45 bg-[var(--surface)] space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#00c85b]">
                    استكمال السلسلة (من الحلقة {series.episodes.length + 1})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAppendPanel(false)}
                    className="text-[11px] text-[var(--pmuted)] hover:text-[var(--ptxt)] cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[3, 5, 10].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAppendCount(c)}
                      className={`min-h-[34px] rounded-lg border text-xs font-mono-nums font-extrabold cursor-pointer ${
                        appendCount === c
                          ? 'border-[#00B050] bg-[#00B050]/15 text-[#00c85b]'
                          : 'border-[var(--pline)] bg-[var(--panel)]'
                      }`}
                    >
                      +{c}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={appendCount}
                    onChange={(e) =>
                      setAppendCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                    }
                    aria-label="عدد الحلقات المضافة"
                    className="min-h-[34px] px-2 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs font-mono-nums font-extrabold text-center"
                  />
                </div>

                <input
                  type="text"
                  value={appendFocus}
                  onChange={(e) => setAppendFocus(e.target.value)}
                  placeholder="محور الدفعة (اختياري، مثال: الغزوات أو كأس العالم)..."
                  className="w-full min-h-[36px] px-2.5 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs"
                />

                <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--pmuted)]">
                  <span>المشاهد/حلقة (0 = تلقائي):</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={appendScenesPerEp}
                    onChange={(e) =>
                      setAppendScenesPerEp(
                        Math.max(0, Math.min(30, Number(e.target.value) || 0))
                      )
                    }
                    className="w-16 min-h-[32px] px-2 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs font-mono-nums text-center text-[var(--ptxt)]"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isAppending}
                  className="w-full min-h-[38px] rounded-lg bg-[#00B050] hover:bg-[#00c85b] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isAppending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جارٍ الإضافة...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>توليد +{appendCount} حلقات الآن</span>
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="space-y-2.5 max-h-[68vh] overflow-y-auto pr-0.5">
              {series.episodes.map((ep, idx) => {
                const isSelected = activeEpisode?.id === ep.id;
                const flaggedCount = countFlaggedClaimsInEpisode(ep);
                const isEpBusy =
                  ep.status === 'queued' ||
                  ep.status === 'generating' ||
                  regenBusyEpisodeId === ep.id;

                return (
                  <div
                    key={ep.id}
                    className={`rounded-xl border p-3 transition-colors space-y-2 ${
                      isSelected
                        ? 'border-[#00B050] bg-[#00B050]/10'
                        : 'border-[var(--pline)] bg-[var(--surface)] hover:border-[var(--gold)]/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setActiveEpisodeIndex(idx);
                        setActiveSceneIndex(0);
                      }}
                      className="w-full text-right cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-extrabold leading-snug">
                          {idx + 1}. {ep.title}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0 ${STATUS_TEXT_CLASS[ep.status]}`}
                        >
                          {STATUS_ARABIC_LABEL[ep.status]}
                        </span>
                      </div>

                      {isEpBusy && ep.scenes.length === 0 ? (
                        <div className="space-y-1.5 pt-1">
                          <div className="h-2.5 w-3/4 rounded bg-[var(--panel)] animate-pulse" />
                          <div className="h-2.5 w-1/2 rounded bg-[var(--panel)] animate-pulse" />
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-nums text-[var(--pmuted)]">
                          <span>{ep.scenes.length} مشاهد</span>
                          <span>· {formatDurationSeconds(ep.duration)}</span>
                          {flaggedCount > 0 && (
                            <span className="text-amber-300 font-bold">
                              · {flaggedCount} تنبيه تدقيق
                            </span>
                          )}
                        </div>
                      )}
                    </button>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--pline)]/60">
                      <button
                        type="button"
                        disabled={isEpBusy}
                        onClick={() => void handleRegenerateEpisode(ep.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--pmuted)] hover:text-[var(--gold)] disabled:opacity-40 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isEpBusy ? 'animate-spin' : ''}`} />
                        <span>إعادة توليد الحلقة</span>
                      </button>

                      {ep.scenes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleOpenInAdvancedStudio(ep)}
                          className="text-[11px] font-bold text-[#00c85b] hover:underline cursor-pointer"
                        >
                          تحرير متقدم
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Active Episode Workspace */}
          {activeEpisode ? (
            <section className="rounded-2xl border border-[var(--pline)] bg-[var(--panel)] overflow-hidden">
              {/* Episode Header + Tabs */}
              <div className="px-5 py-4 border-b border-[var(--pline)] bg-[var(--surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-mono-nums text-[var(--gold)] font-bold">
                    الحلقة {activeEpisode.index + 1} من {series.episodes.length}
                  </p>
                  <h2 className="text-base sm:text-lg font-extrabold truncate">
                    {activeEpisode.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: 'scenes', label: 'المشاهد والمعاينة' },
                      { id: 'script', label: 'السيناريو والعناوين' },
                      { id: 'publish', label: 'النشر والتصدير' },
                    ] as Array<{ id: EpisodeDetailTab; label: string }>
                  ).map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setActiveTab(tab.id);
                        }}
                        className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#00B050] text-white'
                            : 'border border-[var(--pline)] bg-[var(--panel)] text-[var(--pmuted)] hover:text-[var(--ptxt)]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-5">
                {activeEpisode.scenes.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <Loader2 className="w-7 h-7 animate-spin text-[var(--gold)] mx-auto" />
                    <p className="text-sm font-bold">
                      {activeEpisode.error
                        ? activeEpisode.error
                        : 'جارٍ إعداد مشاهد هذه الحلقة والسيناريو...'}
                    </p>
                  </div>
                ) : activeTab === 'scenes' ? (
                  <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">
                    {/* Scenes Editor List */}
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-extrabold">
                          الخط الزمني للمشاهد ({activeEpisode.scenes.length})
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddManualScene(activeEpisode.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border border-[#00B050]/50 bg-[#00B050]/10 hover:bg-[#00B050]/20 text-xs font-extrabold text-[#00c85b] cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>إضافة مشهد جديد</span>
                          </button>

                          <button
                            type="button"
                            disabled={assetsBusyEpisodeId === activeEpisode.id}
                            onClick={() => void handleGenerateMissingAssets(activeEpisode.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-[var(--gold)]/50 bg-[var(--gold)]/10 hover:bg-[var(--gold)]/20 text-xs font-extrabold text-[var(--gold)] cursor-pointer disabled:opacity-50"
                          >
                            {assetsBusyEpisodeId === activeEpisode.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5" />
                            )}
                            <span>توليد الأصول البصرية المفقودة</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3.5">
                        {activeEpisode.scenes.map((scene, sIdx) => {
                          const isSelected = activeSceneIndex === sIdx;
                          const fc = scene.factCheck;
                          const needsWarning =
                            fc && (fc.status === 'flagged' || fc.status === 'needs_review');

                          return (
                            <article
                              key={scene.id}
                              onClick={() => setActiveSceneIndex(sIdx)}
                              className={`rounded-xl border p-4 space-y-3 transition-colors ${
                                isSelected
                                  ? 'border-[#00B050] bg-[var(--surface)]'
                                  : 'border-[var(--pline)] bg-[var(--surface)]/75'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded bg-[var(--panel)] border border-[var(--pline)] text-xs font-mono-nums font-extrabold">
                                    مشهد {sIdx + 1}
                                  </span>
                                  <span className="text-xs font-mono-nums text-[var(--pmuted)]">
                                    {scene.duration} ث
                                  </span>
                                  {fc && (
                                    <span
                                      className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                                        fc.status === 'verified'
                                          ? 'text-[#00c85b]'
                                          : fc.status === 'needs_review'
                                            ? 'text-amber-300'
                                            : 'text-rose-300'
                                      }`}
                                    >
                                      {fc.status === 'verified' ? (
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                      ) : (
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                      )}
                                      <span>
                                        ثقة المعلومة {Math.round(fc.confidence * 100)}%
                                      </span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={regenBusySceneId === scene.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleRegenerateScene(activeEpisode.id, scene.id);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-lg border border-[var(--pline)] hover:border-[var(--gold)]/65 text-xs font-bold cursor-pointer disabled:opacity-50"
                                  >
                                    {regenBusySceneId === scene.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Wand2 className="w-3 h-3 text-[var(--gold)]" />
                                    )}
                                    <span>إعادة توليد المشهد</span>
                                  </button>

                                  {activeEpisode.scenes.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteScene(activeEpisode.id, scene.id);
                                      }}
                                      aria-label={`حذف المشهد ${sIdx + 1}`}
                                      className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg border border-[var(--pline)] text-[var(--pmuted)] hover:text-rose-300 hover:border-rose-400/50 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Flagged claim warning + verify toggle */}
                              {needsWarning && (
                                <div className="p-3 rounded-lg border border-amber-400/45 bg-amber-500/10 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs text-amber-200 font-semibold">
                                    {fc?.flagReason ||
                                      'يحتوي هذا المشهد على رقم أو ادعاء يُنصح بالتحقق منه قبل النشر.'}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateScene(activeEpisode.id, scene.id, (sc) => ({
                                        ...sc,
                                        factCheck: {
                                          status: 'verified',
                                          confidence: 0.95,
                                        },
                                      }));
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00B050]/20 border border-[#00B050]/50 text-[11px] font-bold text-[#00c85b] cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>اعتماد المعلومة</span>
                                  </button>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-3 items-start">
                                {/* Visual preview box */}
                                <div className="rounded-lg border border-[var(--pline)] bg-black/40 overflow-hidden aspect-square flex items-center justify-center">
                                  {scene.visualAssetUrl ? (
                                    <img
                                      src={scene.visualAssetUrl}
                                      alt={`معاينة المشهد ${sIdx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[11px] text-[var(--pmuted)] p-2 text-center">
                                      بدون صورة بعد
                                    </span>
                                  )}
                                </div>

                                {/* Editable scene fields */}
                                <div className="space-y-2.5">
                                  <label className="block space-y-1">
                                    <span className="text-[11px] font-bold text-[var(--pmuted)]">
                                      نص التعليق الصوتي (Narration)
                                    </span>
                                    <textarea
                                      rows={2}
                                      value={scene.narration}
                                      onChange={(e) =>
                                        updateScene(activeEpisode.id, scene.id, (sc) => ({
                                          ...sc,
                                          narration: e.target.value,
                                        }))
                                      }
                                      className="w-full px-3 py-2 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs sm:text-sm text-[var(--ptxt)]"
                                    />
                                  </label>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <label className="block space-y-1">
                                      <span className="text-[11px] font-bold text-[var(--pmuted)]">
                                        النص الظاهر على الشاشة (سطر لكل نقطة)
                                      </span>
                                      <textarea
                                        rows={2}
                                        value={scene.onScreenText.join('\n')}
                                        onChange={(e) =>
                                          updateScene(activeEpisode.id, scene.id, (sc) => ({
                                            ...sc,
                                            onScreenText: e.target.value
                                              .split('\n')
                                              .map((l) => l.trim())
                                              .filter(Boolean),
                                          }))
                                        }
                                        className="w-full px-3 py-1.5 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs text-[var(--ptxt)]"
                                      />
                                    </label>

                                    <label className="block space-y-1">
                                      <span className="text-[11px] font-bold text-[var(--pmuted)]">
                                        الوصف البصري (Visual Prompt)
                                      </span>
                                      <textarea
                                        rows={2}
                                        value={scene.visualPrompt}
                                        onChange={(e) =>
                                          updateScene(activeEpisode.id, scene.id, (sc) => ({
                                            ...sc,
                                            visualPrompt: e.target.value,
                                          }))
                                        }
                                        className="w-full px-3 py-1.5 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs text-[var(--ptxt)]"
                                      />
                                    </label>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <label className="block space-y-1">
                                      <span className="text-[10px] font-bold text-[var(--pmuted)]">
                                        المدة (ث)
                                      </span>
                                      <input
                                        type="number"
                                        min={2}
                                        max={180}
                                        value={scene.duration}
                                        onChange={(e) =>
                                          updateScene(activeEpisode.id, scene.id, (sc) => ({
                                            ...sc,
                                            duration: Math.max(
                                              2,
                                              Math.min(180, Number(e.target.value) || 6)
                                            ),
                                          }))
                                        }
                                        className="w-full min-h-[36px] px-2.5 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs font-mono-nums"
                                      />
                                    </label>

                                    <label className="block space-y-1">
                                      <span className="text-[10px] font-bold text-[var(--pmuted)]">
                                        الانتقال
                                      </span>
                                      <select
                                        value={scene.transition}
                                        onChange={(e) =>
                                          updateScene(activeEpisode.id, scene.id, (sc) => ({
                                            ...sc,
                                            transition: e.target.value as SlideTransitionStyle,
                                          }))
                                        }
                                        className="w-full min-h-[36px] px-2 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs"
                                      >
                                        {TRANSITION_OPTIONS.map((t) => (
                                          <option key={t.id} value={t.id}>
                                            {t.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label className="block space-y-1">
                                      <span className="text-[10px] font-bold text-[var(--pmuted)]">
                                        الحركة
                                      </span>
                                      <select
                                        value={scene.animation}
                                        onChange={(e) =>
                                          updateScene(activeEpisode.id, scene.id, (sc) => ({
                                            ...sc,
                                            animation: e.target.value as SceneAnimation,
                                          }))
                                        }
                                        className="w-full min-h-[36px] px-2 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs"
                                      >
                                        {SCENE_ANIMATION_OPTIONS.map((a) => (
                                          <option key={a.id} value={a.id}>
                                            {a.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label className="block space-y-1">
                                      <span className="text-[10px] font-bold text-[var(--pmuted)]">
                                        المزاج
                                      </span>
                                      <select
                                        value={scene.mood}
                                        onChange={(e) =>
                                          updateScene(activeEpisode.id, scene.id, (sc) => ({
                                            ...sc,
                                            mood: e.target.value as SceneMood,
                                          }))
                                        }
                                        className="w-full min-h-[36px] px-2 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs"
                                      >
                                        {SCENE_MOOD_OPTIONS.map((m) => (
                                          <option key={m.id} value={m.id}>
                                            {m.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  </div>

                                  {/* Optional instruction for regenerating scene */}
                                  <input
                                    type="text"
                                    value={sceneNoteMap[scene.id] || ''}
                                    onChange={(e) =>
                                      setSceneNoteMap((prev) => ({
                                        ...prev,
                                        [scene.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="توجيه اختياري عند إعادة توليد هذا المشهد (مثال: اختصر النص أو أضف مثالاً)..."
                                    className="w-full min-h-[36px] px-3 py-1 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-[11px] text-[var(--ptxt)]"
                                  />
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>

                    {/* Live Canvas Preview Stage */}
                    {mappedActiveProject && (
                      <div className="rounded-2xl border border-[var(--pline)] bg-[var(--surface)] p-3 space-y-2.5 xl:sticky xl:top-24">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-extrabold text-[var(--gold)]">
                            معاينة الفيديو المباشرة
                          </span>
                          <span className="text-[11px] font-mono-nums text-[var(--pmuted)]">
                            {series.format}
                          </span>
                        </div>
                        <div className="h-[500px] flex flex-col">
                          <ShortsPreviewStage
                            slides={mappedActiveProject.slides}
                            activeSlideIndex={Math.min(
                              activeSceneIndex,
                              Math.max(0, mappedActiveProject.slides.length - 1)
                            )}
                            template={mappedActiveProject.template}
                            timing={mappedActiveProject.timing}
                            audio={mappedActiveProject.audio}
                            onToggleSafeGuides={() => {}}
                            onCycleChannelTheme={() => {}}
                            onActiveSlideChange={(idx) => setActiveSceneIndex(idx)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : activeTab === 'script' ? (
                  <div className="space-y-6">
                    {/* 4 Title Options */}
                    <div className="space-y-2.5">
                      <p className="text-sm font-extrabold">
                        خيارات العنوان المقترحة (اختر الأنسب أو عدّل)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {activeEpisode.titleOptions.map((opt, i) => {
                          const selected = activeEpisode.title === opt;
                          return (
                            <button
                              key={`${opt}-${i}`}
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                updateEpisode(activeEpisode.id, (ep) => ({
                                  ...ep,
                                  title: opt,
                                  publishKit: { ...ep.publishKit, title: opt },
                                }));
                              }}
                              className={`p-3 rounded-xl border text-right transition-colors cursor-pointer min-h-[44px] flex items-center justify-between gap-2 ${
                                selected
                                  ? 'border-[#00B050] bg-[#00B050]/12'
                                  : 'border-[var(--pline)] bg-[var(--surface)] hover:border-[var(--gold)]/60'
                              }`}
                            >
                              <span className="text-xs sm:text-sm font-bold">{opt}</span>
                              {selected && <CheckCircle2 className="w-4 h-4 text-[#00c85b] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hook & Full Script */}
                    <div className="grid grid-cols-1 gap-4">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-extrabold text-[var(--gold)]">
                          الخطاف الافتتاحي (أول 3 ثوانٍ)
                        </span>
                        <input
                          type="text"
                          value={activeEpisode.hook}
                          onChange={(e) =>
                            updateEpisode(activeEpisode.id, (ep) => ({
                              ...ep,
                              hook: e.target.value,
                            }))
                          }
                          className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm font-bold"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-extrabold text-[var(--pmuted)]">
                          السيناريو الكامل للحلقة
                        </span>
                        <textarea
                          rows={7}
                          value={activeEpisode.script}
                          onChange={(e) =>
                            updateEpisode(activeEpisode.id, (ep) => ({
                              ...ep,
                              script: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm leading-relaxed"
                        />
                      </label>
                    </div>

                    {/* Thumbnail Concepts */}
                    <div className="space-y-2.5">
                      <p className="text-sm font-extrabold">
                        أفكار الصورة المصغرة والنص المقترح عليها
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {activeEpisode.thumbnailConcepts.map((tc) => (
                          <div
                            key={tc.id}
                            className={`p-4 rounded-xl border space-y-2 ${
                              activeEpisode.thumbnail.id === tc.id
                                ? 'border-[#00B050] bg-[#00B050]/8'
                                : 'border-[var(--pline)] bg-[var(--surface)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold text-[var(--gold)]">
                                {tc.title}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateEpisode(activeEpisode.id, (ep) => ({
                                    ...ep,
                                    thumbnail: tc,
                                  }))
                                }
                                className="text-[11px] font-bold text-[#00c85b] hover:underline cursor-pointer"
                              >
                                {activeEpisode.thumbnail.id === tc.id ? 'محدد ✓' : 'اعتماد'}
                              </button>
                            </div>
                            <div
                              className="p-3 rounded-lg border border-white/10 text-center font-extrabold text-sm"
                              style={{ backgroundColor: `${tc.accentColor}22` }}
                            >
                              {tc.visibleText}
                            </div>
                            <p className="text-xs text-[var(--pmuted)] leading-relaxed">
                              {tc.visualPrompt}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Publish & Export Tab */
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-[#00B050]/45 bg-[#00B050]/10">
                      <div>
                        <p className="text-sm font-extrabold">
                          تصدير أو نشر الحلقة {activeEpisode.index + 1} على يوتيوب
                        </p>
                        <p className="text-xs text-[var(--pmuted)]">
                          يدعم MP4 / WebM، ملف الترجمة SRT، والرفع المباشر إلى قناتك
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDownloadSrt()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] rounded-xl border border-[var(--pline)] bg-[var(--panel)] text-xs font-bold cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-[var(--gold)]" />
                          <span>تحميل ملف الترجمة SRT</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('medium');
                            setIsSingleExportOpen(true);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] rounded-xl bg-[#00B050] hover:bg-[#00c85b] text-white text-xs sm:text-sm font-extrabold cursor-pointer"
                        >
                          <Film className="w-4 h-4" />
                          <span>تصدير هذه الحلقة</span>
                        </button>
                      </div>
                    </div>

                    {/* Editable Publish Kit */}
                    <div className="space-y-4">
                      <label className="block space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--pmuted)]">
                            عنوان النشر الموصى به
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyText('title', activeEpisode.publishKit.title)
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--gold)] cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedKey === 'title' ? 'تم النسخ' : 'نسخ'}</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={activeEpisode.publishKit.title}
                          onChange={(e) =>
                            updateEpisode(activeEpisode.id, (ep) => ({
                              ...ep,
                              publishKit: { ...ep.publishKit, title: e.target.value },
                            }))
                          }
                          className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm font-bold"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--pmuted)]">
                            وصف الفيديو (Description)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyText('desc', activeEpisode.publishKit.description)
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--gold)] cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedKey === 'desc' ? 'تم النسخ' : 'نسخ'}</span>
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={activeEpisode.publishKit.description}
                          onChange={(e) =>
                            updateEpisode(activeEpisode.id, (ep) => ({
                              ...ep,
                              publishKit: { ...ep.publishKit, description: e.target.value },
                            }))
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm"
                        />
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-bold text-[var(--pmuted)]">
                            الوسوم (Tags مفصولة بفاصلة)
                          </span>
                          <input
                            type="text"
                            value={activeEpisode.publishKit.tags.join('، ')}
                            onChange={(e) =>
                              updateEpisode(activeEpisode.id, (ep) => ({
                                ...ep,
                                publishKit: {
                                  ...ep.publishKit,
                                  tags: e.target.value
                                    .split(/[،,]/)
                                    .map((t) => t.trim())
                                    .filter(Boolean),
                                },
                              }))
                            }
                            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-xs"
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs font-bold text-[var(--pmuted)]">
                            الهاشتاغات
                          </span>
                          <input
                            type="text"
                            value={activeEpisode.publishKit.hashtags.join(' ')}
                            onChange={(e) =>
                              updateEpisode(activeEpisode.id, (ep) => ({
                                ...ep,
                                publishKit: {
                                  ...ep.publishKit,
                                  hashtags: e.target.value
                                    .split(/\s+/)
                                    .map((h) => h.trim())
                                    .filter(Boolean),
                                },
                              }))
                            }
                            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-xs"
                          />
                        </label>
                      </div>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-bold text-[var(--pmuted)]">
                          التعليق المثبت المقترح (Pinned Comment)
                        </span>
                        <input
                          type="text"
                          value={activeEpisode.publishKit.pinnedComment}
                          onChange={(e) =>
                            updateEpisode(activeEpisode.id, (ep) => ({
                              ...ep,
                              publishKit: { ...ep.publishKit, pinnedComment: e.target.value },
                            }))
                          }
                          className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <div className="rounded-2xl border border-[var(--pline)] bg-[var(--panel)] p-8 text-center space-y-3">
              <Sparkles className="w-6 h-6 text-[var(--gold)] mx-auto" />
              <p className="text-sm font-bold">جارٍ تحضير هيكل الحلقات...</p>
            </div>
          )}
        </div>
      </main>

      {/* Unified Brand Identity Drawer */}
      <BrandIdentityDrawer
        isOpen={isBrandDrawerOpen}
        brandPreset={series.brandPreset}
        onClose={() => setIsBrandDrawerOpen(false)}
        onApplyToSeries={(nextBrand) => void handleApplyUnifiedBrand(nextBrand)}
      />

      {/* Batch Export Modal */}
      <BatchSeriesExportModal
        isOpen={isBatchExportOpen}
        series={series}
        onClose={() => setIsBatchExportOpen(false)}
      />

      {/* Single Episode Export & YouTube Publish Modal */}
      {mappedActiveProject && activeEpisode && (
        <ExportVideoModal
          isOpen={isSingleExportOpen}
          project={mappedActiveProject}
          onClose={() => setIsSingleExportOpen(false)}
          publishKit={activeEpisode.publishKit}
          tagsInput={activeEpisode.publishKit.tags.join('، ')}
          onUpdatePublishKit={(updater: (prev: YoutubePublishKit) => YoutubePublishKit) =>
            updateEpisode(activeEpisode.id, (ep) => ({
              ...ep,
              publishKit: updater(ep.publishKit),
            }))
          }
          onUpdateTagsInput={(val: string) =>
            updateEpisode(activeEpisode.id, (ep) => ({
              ...ep,
              publishKit: {
                ...ep.publishKit,
                tags: val
                  .split(/[،,]/)
                  .map((t) => t.trim())
                  .filter(Boolean),
              },
            }))
          }
          ytConnected={ytConnected}
          ytChannel={ytChannel}
          ytEmail={ytEmail}
          ytPlaylists={ytPlaylists}
          selectedPlaylistId={selectedPlaylistId}
          onSelectPlaylistId={setSelectedPlaylistId}
          ytPrivacy={ytPrivacy}
          onChangePrivacy={setYtPrivacy}
          ytUseSchedule={ytUseSchedule}
          onChangeUseSchedule={setYtUseSchedule}
          ytScheduleLocal={ytScheduleLocal}
          onChangeScheduleLocal={setYtScheduleLocal}
          ytAutoPostComment={ytAutoPostComment}
          onChangeAutoPostComment={setYtAutoPostComment}
          isConnectingYt={isConnectingYt}
          ytAuthError={ytAuthError}
          onConnectYouTube={handleConnectYouTube}
          onDisconnectYouTube={handleDisconnectYouTube}
        />
      )}
    </div>
  );
};
