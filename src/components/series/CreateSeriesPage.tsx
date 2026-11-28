import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  Cloud,
  Film,
  FolderOpen,
  Infinity as InfinityIcon,
  Layers,
  Loader2,
  LogOut,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  BrandPreset,
  SERIES_AUDIENCE_OPTIONS,
  SERIES_EXAMPLE_PROMPTS,
  SERIES_LANGUAGE_OPTIONS,
  SERIES_STYLE_OPTIONS,
  Series,
  SeriesAudience,
  SeriesFormat,
  SeriesLanguage,
  SeriesStylePreset,
} from '../../types/series';
import { ProjectSummary, listProjectsFromStore } from '../../storage/projectStore';
import {
  deleteSeriesFromStore,
  listSeriesFromStore,
  loadSeriesBrandPresets,
  saveSeriesToStore,
} from '../../storage/seriesStore';
import { BUILTIN_BRAND_PRESETS, migrateSeriesSchema } from '../../series/migrations';
import { createSeriesJobRequest } from '../../services/seriesClient';
import {
  listCloudSeries,
  pushSeriesToCloud,
  signInWithGoogleForSync,
  signOutFirebaseUser,
  subscribeFirebaseUser,
} from '../../services/firebaseClient';
import {
  subscribeSeriesBackgroundUpdates,
  syncActiveSeriesJobsNow,
} from '../../services/backgroundSeriesSync';
import { beginBackgroundTask } from '../../services/backgroundKeepAlive';
import { BackgroundProtectionControl } from '../BackgroundProtectionControl';
import { triggerHaptic } from '../../utils/haptics';
import {
  FORMAT_LABELS,
  STATUS_ARABIC_LABEL,
  STATUS_TEXT_CLASS,
  formatDurationSeconds,
  getStyleLabel,
} from './seriesHelpers';

interface CreateSeriesPageProps {
  onNavigate: (path: string) => void;
}

const ONBOARDING_DISMISSED_KEY = 'quizpro_series_onboarding_dismissed_v1';
const EPISODE_PRESET_COUNTS = [3, 5, 10, 20, 50, 100];
const INITIAL_BATCH_PRESETS = [3, 5, 8, 10];
const SCENE_PRESETS = [
  { val: 0, label: 'تلقائي' },
  { val: 4, label: '4' },
  { val: 6, label: '6' },
  { val: 8, label: '8' },
  { val: 12, label: '12' },
  { val: 20, label: '20' },
];
const DURATION_OPTIONS = [
  { sec: 30, label: '30 ثانية — سريع ومكثف' },
  { sec: 45, label: '45 ثانية — متوازن للشورتس' },
  { sec: 60, label: '60 ثانية — شرح وافٍ' },
  { sec: 90, label: '90 ثانية — سرد مفصل' },
  { sec: 120, label: 'دقيقتان — قصة أو درس كامل' },
  { sec: 180, label: '3 دقائق — حلقة موسعة' },
];

export const CreateSeriesPage: React.FC<CreateSeriesPageProps> = ({ onNavigate }) => {
  const [topic, setTopic] = useState('');
  const [stylePreset, setStylePreset] = useState<SeriesStylePreset>('educational');
  const [language, setLanguage] = useState<SeriesLanguage>('ar');
  const [audience, setAudience] = useState<SeriesAudience>('general');
  const [targetDurationSec, setTargetDurationSec] = useState<number>(45);
  const [episodeCount, setEpisodeCount] = useState<number>(5);
  const [isOpenEnded, setIsOpenEnded] = useState<boolean>(false);
  const [initialBatchCount, setInitialBatchCount] = useState<number>(5);
  const [scenesPerEpisode, setScenesPerEpisode] = useState<number>(0); // 0 = auto
  const [format, setFormat] = useState<SeriesFormat>('9:16');
  const [brandPresets, setBrandPresets] = useState<BrandPreset[]>(BUILTIN_BRAND_PRESETS);
  const [selectedBrandId, setSelectedBrandId] = useState<string>(BUILTIN_BRAND_PRESETS[0].id);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [recentSeries, setRecentSeries] = useState<Series[]>([]);
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [loadingLibraries, setLoadingLibraries] = useState(true);

  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [isCloudBusy, setIsCloudBusy] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARDING_DISMISSED_KEY) !== '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadSeriesBrandPresets(),
      listSeriesFromStore(),
      listProjectsFromStore(),
    ]).then(([presets, seriesList, projectList]) => {
      if (!active) return;
      if (presets.length > 0) {
        setBrandPresets(presets);
        setSelectedBrandId((prev) =>
          presets.some((b) => b.id === prev) ? prev : presets[0].id
        );
      }
      setRecentSeries(seriesList);
      setRecentProjects(projectList.slice(0, 8));
      setLoadingLibraries(false);
    });
    const unsubBg = subscribeSeriesBackgroundUpdates((updated) => {
      if (!active) return;
      setRecentSeries((prev) => {
        const next = prev.some((s) => s.id === updated.id)
          ? prev.map((s) => (s.id === updated.id ? updated : s))
          : [updated, ...prev];
        return next.sort((a, b) => b.updatedAt - a.updatedAt);
      });
    });
    return () => {
      active = false;
      unsubBg();
    };
  }, []);

  useEffect(() => {
    return subscribeFirebaseUser((user) => {
      setCloudUser(user);
      if (user && user.emailVerified) {
        void listCloudSeries()
          .then(async (cloudList) => {
            if (cloudList.length === 0) return;
            const localList = await listSeriesFromStore();
            const merged = new Map<string, Series>();
            for (const s of localList) merged.set(s.id, s);
            for (const cs of cloudList) {
              const existing = merged.get(cs.id);
              if (!existing || cs.updatedAt > existing.updatedAt) {
                const migrated = migrateSeriesSchema(cs);
                merged.set(cs.id, migrated);
                await saveSeriesToStore(migrated);
              }
            }
            const sorted = Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
            setRecentSeries(sorted);
          })
          .catch(() => {});
      }
    });
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
  };

  const handleApplyExample = (ex: (typeof SERIES_EXAMPLE_PROMPTS)[number]) => {
    triggerHaptic('light');
    setTopic(ex.topic);
    setStylePreset(ex.stylePreset);
    setEpisodeCount(ex.episodeCount);
    setIsOpenEnded(Boolean(ex.isOpenEnded));
    setScenesPerEpisode(ex.scenesPerEpisode ?? 0);
    if (ex.episodeCount > 10 || ex.isOpenEnded) {
      setInitialBatchCount(5);
    }
    setTargetDurationSec(ex.targetDurationSec);
    setFormat(ex.format);
    setAudience(ex.audience);
    setSubmitError(null);
  };

  const effectiveInitialBatch =
    isOpenEnded || episodeCount > 10
      ? Math.max(1, Math.min(20, initialBatchCount))
      : Math.max(1, Math.min(10, episodeCount));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = topic.trim();
    if (cleaned.length < 3) {
      setSubmitError('أدخل موضوعاً أو فكرة واضحة (3 أحرف على الأقل) لبدء السلسلة.');
      return;
    }

    const safeEpisodes = Math.max(1, Math.min(500, Math.round(episodeCount || 5)));

    setSubmitError(null);
    setIsSubmitting(true);
    triggerHaptic('medium');

    try {
      const selectedBrand =
        brandPresets.find((b) => b.id === selectedBrandId) || BUILTIN_BRAND_PRESETS[0];
      const { series } = await createSeriesJobRequest({
        topic: cleaned,
        stylePreset,
        language,
        audience,
        targetDurationSec,
        episodeCount: isOpenEnded ? Math.max(effectiveInitialBatch, safeEpisodes) : safeEpisodes,
        isOpenEnded,
        scenesPerEpisode,
        initialBatchCount: effectiveInitialBatch,
        format,
        brandPresetId: selectedBrand.id,
        brandPreset: selectedBrand,
      });

      await saveSeriesToStore(series);
      beginBackgroundTask('series-bg-watcher', `جارٍ توليد سلسلة «${series.name}»...`, 8);
      void syncActiveSeriesJobsNow();
      if (cloudUser?.emailVerified) {
        void pushSeriesToCloud(series).catch(() => {});
      }
      onNavigate(`/series/${encodeURIComponent(series.id)}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'تعذر بدء إنشاء السلسلة، حاول مجدداً.'
      );
      setIsSubmitting(false);
    }
  };

  const handleDeleteSeries = async (seriesId: string) => {
    triggerHaptic('light');
    const updated = await deleteSeriesFromStore(seriesId);
    setRecentSeries(updated);
  };

  const handleCloudAuth = async () => {
    if (isCloudBusy) return;
    setIsCloudBusy(true);
    triggerHaptic('light');
    try {
      if (cloudUser) {
        await signOutFirebaseUser();
      } else {
        await signInWithGoogleForSync();
      }
    } catch {
      // handled gracefully
    } finally {
      setIsCloudBusy(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-[100dvh] bg-[var(--page)] text-[var(--ptxt)] flex flex-col"
    >
      {/* Unified Studio Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--pline)] bg-[var(--panel)]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Zone 1: Brand mark */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#00B050]/15 border border-[#00B050]/45 flex items-center justify-center shrink-0">
              <Film className="w-4 h-4 text-[#00c85b]" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-sm sm:text-base font-extrabold tracking-tight truncate">
                استوديو كويز برو
              </h1>
              <p className="text-[11px] text-[var(--pmuted)] hidden md:block truncate">
                سلاسل فيديو مفتوحة بالذكاء الاصطناعي + محرر الشرائح الكامل
              </p>
            </div>
          </div>

          {/* Zone 2: Unified Mode Switcher */}
          <nav
            aria-label="وضع العمل"
            className="hidden sm:flex items-center p-1 rounded-xl border border-[var(--pline)] bg-[var(--surface)] gap-1"
          >
            <button
              type="button"
              aria-current="page"
              className="px-3 py-1.5 rounded-lg bg-[#00B050] text-white text-xs font-extrabold cursor-default"
            >
              إنشاء سلسلة ذكية
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onNavigate('/advanced');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--pmuted)] hover:text-[var(--ptxt)] hover:bg-[var(--panel)] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#00c85b]" />
              <span>الاستوديو الكامل</span>
            </button>
          </nav>

          {/* Zone 3: Cloud Sync + Mobile Studio Shortcut */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCloudAuth()}
              disabled={isCloudBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border border-[var(--pline)] bg-[var(--surface)] hover:border-[var(--gold)]/60 text-xs font-bold transition-colors cursor-pointer"
              aria-label={cloudUser ? 'تسجيل الخروج من المزامنة السحابية' : 'تسجيل الدخول لحفظ السلاسل سحابياً'}
            >
              {isCloudBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--gold)]" />
              ) : cloudUser ? (
                <LogOut className="w-3.5 h-3.5 text-[#00c85b]" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-[var(--gold)]" />
              )}
              <span className="hidden md:inline truncate max-w-[150px]">
                {cloudUser ? cloudUser.email || 'متصل بالسحابة' : 'حفظ عبر Google'}
              </span>
              <span className="md:hidden">{cloudUser ? 'متصل' : 'سحابة'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onNavigate('/advanced');
              }}
              className="sm:hidden inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border border-[#00B050]/50 bg-[#00B050]/12 text-[#00c85b] text-xs font-extrabold cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>الاستوديو</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* First-time Onboarding Strip */}
        {showOnboarding && (
          <section
            aria-label="دليل البدء السريع"
            className="rounded-2xl border border-[var(--pline)] bg-[var(--panel)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--gold)]">
                <Sparkles className="w-4 h-4" />
                <span>سلاسل مفتوحة بلا قيود · متكاملة مع الاستوديو الكامل</span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--ptxt)] leading-relaxed">
                حدد موضوع سلسلتك واختر أي عدد من الحلقات (من 1 إلى 100+ حلقة أو سلسلة مفتوحة مستمرة) وعدد المشاهد المناسب لك، ثم عدّل كل حلقة أو افتحها مباشرة داخل الاستوديو الكامل في أي وقت.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              aria-label="إخفاء دليل البدء السريع"
              className="self-end sm:self-center inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg border border-[var(--pline)] text-xs font-bold text-[var(--pmuted)] hover:text-[var(--ptxt)] cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>إخفاء</span>
            </button>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Primary Create Series Card */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[var(--pline)] bg-[var(--panel)] p-5 sm:p-7 space-y-6"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="series-topic-input"
                  className="text-base sm:text-lg font-extrabold text-[var(--ptxt)]"
                >
                  عن ماذا تدور سلسلة الفيديو؟
                </label>
                {topic.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTopic('')}
                    className="text-xs font-bold text-[var(--pmuted)] hover:text-[var(--ptxt)] cursor-pointer"
                  >
                    مسح النص
                  </button>
                )}
              </div>
              <textarea
                id="series-topic-input"
                rows={3}
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  if (submitError) setSubmitError(null);
                }}
                placeholder="مثال: السيرة النبوية كاملة في 100 حلقة، أو سلسلة تاريخ كأس العالم وأساطير الكرة..."
                className="w-full px-4 py-3.5 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm sm:text-base text-[var(--ptxt)] placeholder:text-[var(--pmuted)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B050] resize-y min-h-[96px]"
              />
            </div>

            {/* Example Prompts */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-[var(--pmuted)]">أو ابدأ بأحد الأمثلة الجاهزة:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SERIES_EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex.title}
                    type="button"
                    onClick={() => handleApplyExample(ex)}
                    className="p-3 rounded-xl border border-[var(--pline)] bg-[var(--surface)] hover:border-[var(--gold)]/65 text-right transition-colors cursor-pointer group min-h-[44px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[var(--ptxt)] group-hover:text-[var(--gold)] transition-colors">
                        {ex.title}
                      </span>
                      <span className="text-[11px] font-mono-nums text-[var(--pmuted)] shrink-0">
                        {ex.isOpenEnded ? 'مفتوحة' : `${ex.episodeCount} حلقة`} · {ex.format}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--pmuted)] mt-1 line-clamp-1">
                      {ex.topic}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Style Presets */}
            <div className="space-y-2.5">
              <p className="text-sm font-extrabold text-[var(--ptxt)]">أسلوب السلسلة</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {SERIES_STYLE_OPTIONS.map((opt) => {
                  const active = stylePreset === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setStylePreset(opt.id);
                      }}
                      aria-pressed={active}
                      className={`p-3.5 rounded-xl border text-right transition-colors cursor-pointer min-h-[44px] flex flex-col justify-between gap-1.5 ${
                        active
                          ? 'border-[#00B050] bg-[#00B050]/10'
                          : 'border-[var(--pline)] bg-[var(--surface)] hover:border-[var(--gold)]/55'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-extrabold">{opt.label}</span>
                        <span className="text-[10px] font-bold text-[var(--gold)] shrink-0">
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--pmuted)] leading-relaxed">
                        {opt.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Open-Ended Episode Count & Scene Count Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-[var(--pline)] bg-[var(--surface)]/75">
              {/* Episode Count & Open-Ended Toggle */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[var(--ptxt)]">
                    نطاق وعدد الحلقات
                  </span>
                  <div className="flex items-center gap-1 p-0.5 rounded-lg border border-[var(--pline)] bg-[var(--panel)]">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setIsOpenEnded(false);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                        !isOpenEnded
                          ? 'bg-[#00B050] text-white'
                          : 'text-[var(--pmuted)] hover:text-[var(--ptxt)]'
                      }`}
                    >
                      عدد محدد
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setIsOpenEnded(true);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 ${
                        isOpenEnded
                          ? 'bg-[var(--gold)] text-black'
                          : 'text-[var(--pmuted)] hover:text-[var(--ptxt)]'
                      }`}
                    >
                      <InfinityIcon className="w-3 h-3" />
                      <span>سلسلة مفتوحة</span>
                    </button>
                  </div>
                </div>

                {!isOpenEnded ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {EPISODE_PRESET_COUNTS.map((cnt) => {
                        const active = episodeCount === cnt;
                        return (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setEpisodeCount(cnt);
                            }}
                            aria-pressed={active}
                            className={`px-3 min-h-[38px] rounded-lg border font-mono-nums text-xs font-extrabold transition-colors cursor-pointer ${
                              active
                                ? 'border-[#00B050] bg-[#00B050]/15 text-[#00c85b]'
                                : 'border-[var(--pline)] bg-[var(--panel)] text-[var(--ptxt)] hover:border-[var(--gold)]/60'
                            }`}
                          >
                            {cnt}
                          </button>
                        );
                      })}
                      <label className="flex items-center gap-1.5 mr-auto">
                        <span className="text-[11px] text-[var(--pmuted)] font-bold">مخصص:</span>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={episodeCount}
                          onChange={(e) =>
                            setEpisodeCount(
                              Math.max(1, Math.min(500, Number(e.target.value) || 1))
                            )
                          }
                          aria-label="عدد الحلقات المخصص"
                          className="w-20 min-h-[38px] px-2.5 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs font-mono-nums font-extrabold text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B050]"
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-[var(--pmuted)]">
                      يمكنك تحديد أي عدد حتى 500 حلقة (مثل سلسلة من 30 أو 100 حلقة).
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--gold)] font-semibold leading-relaxed">
                    سلسلة مفتوحة بلا سقف: تبدأ بالدفعة الأولى الآن وتضيف حلقات جديدة أو دفعات متصلة في أي وقت من لوحة السلسلة دون حد أقصى.
                  </p>
                )}

                {(isOpenEnded || episodeCount > 10) && (
                  <div className="pt-2 border-t border-[var(--pline)]/60 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[var(--pmuted)]">
                        حجم الدفعة الأولى الآن:
                      </span>
                      <div className="flex items-center gap-1">
                        {INITIAL_BATCH_PRESETS.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setInitialBatchCount(b);
                            }}
                            className={`px-2.5 py-1 rounded-lg border font-mono-nums text-[11px] font-extrabold cursor-pointer ${
                              initialBatchCount === b
                                ? 'border-[#00B050] bg-[#00B050]/15 text-[#00c85b]'
                                : 'border-[var(--pline)] bg-[var(--panel)] text-[var(--ptxt)]'
                            }`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-[var(--pmuted)]">
                      تُجهز أول {effectiveInitialBatch} حلقات فوراً ثم تستكمل الباقي من داخل السلسلة بنقرة واحدة.
                    </p>
                  </div>
                )}
              </div>

              {/* Scenes per Episode (Custom or Auto) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[var(--ptxt)]">
                    عدد المشاهد في كل حلقة
                  </span>
                  <span className="text-[11px] font-mono-nums text-[var(--gold)] font-bold">
                    {scenesPerEpisode === 0 ? 'تلقائي حسب المدة' : `${scenesPerEpisode} مشهد/حلقة`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {SCENE_PRESETS.map((opt) => {
                    const active = scenesPerEpisode === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setScenesPerEpisode(opt.val);
                        }}
                        aria-pressed={active}
                        className={`px-3 min-h-[38px] rounded-lg border text-xs font-extrabold font-mono-nums transition-colors cursor-pointer ${
                          active
                            ? 'border-[#00B050] bg-[#00B050]/15 text-[#00c85b]'
                            : 'border-[var(--pline)] bg-[var(--panel)] text-[var(--ptxt)] hover:border-[var(--gold)]/60'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                  <label className="flex items-center gap-1.5 mr-auto">
                    <span className="text-[11px] text-[var(--pmuted)] font-bold">مخصص:</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={scenesPerEpisode}
                      onChange={(e) =>
                        setScenesPerEpisode(
                          Math.max(0, Math.min(30, Number(e.target.value) || 0))
                        )
                      }
                      aria-label="عدد المشاهد المخصص لكل حلقة"
                      className="w-16 min-h-[38px] px-2 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs font-mono-nums font-extrabold text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B050]"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-[var(--pmuted)]">
                  اختر (0) للتوزيع التلقائي أو حدد من 1 إلى 30 مشهداً للحلقة، مع إمكانية إضافة مشاهد يدوياً لاحقاً بلا حد.
                </p>
              </div>
            </div>

            {/* Essential Choices Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {/* Language */}
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-[var(--pmuted)]">لغة السلسلة</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as SeriesLanguage)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm text-[var(--ptxt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B050]"
                >
                  {SERIES_LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Audience */}
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-[var(--pmuted)]">الجمهور المستهدف</span>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as SeriesAudience)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm text-[var(--ptxt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B050]"
                >
                  {SERIES_AUDIENCE_OPTIONS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Duration */}
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-[var(--pmuted)]">مدة الحلقة التقريبية</span>
                <select
                  value={targetDurationSec}
                  onChange={(e) => setTargetDurationSec(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm text-[var(--ptxt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B050]"
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d.sec} value={d.sec}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Brand Identity */}
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-[var(--pmuted)] flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>الهوية البصرية</span>
                </span>
                <select
                  value={selectedBrandId}
                  onChange={(e) => setSelectedBrandId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm text-[var(--ptxt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B050]"
                >
                  {brandPresets.map((bp) => (
                    <option key={bp.id} value={bp.id}>
                      {bp.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Aspect Ratio Format */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-[var(--pmuted)] block">مقاس الفيديو</span>
              <div className="grid grid-cols-3 gap-2.5">
                {(['9:16', '16:9', '1:1'] as SeriesFormat[]).map((fmt) => {
                  const active = format === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setFormat(fmt);
                      }}
                      aria-pressed={active}
                      className={`min-h-[44px] px-3 rounded-xl border text-center transition-colors cursor-pointer ${
                        active
                          ? 'border-[#00B050] bg-[#00B050]/15 text-[#00c85b]'
                          : 'border-[var(--pline)] bg-[var(--surface)] text-[var(--ptxt)] hover:border-[var(--gold)]/60'
                      }`}
                    >
                      <div className="text-xs font-mono-nums font-extrabold">{fmt}</div>
                      <div className="text-[10px] text-[var(--pmuted)]">
                        {FORMAT_LABELS[fmt].ratioHint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {submitError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl border border-rose-500/45 bg-rose-500/10 text-xs sm:text-sm font-bold text-rose-200"
              >
                {submitError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[var(--pline)]">
              <p className="text-xs text-[var(--pmuted)] font-mono-nums">
                {isOpenEnded
                  ? `سلسلة مفتوحة (الدفعة الأولى ${effectiveInitialBatch} حلقات)`
                  : episodeCount > 10
                    ? `${episodeCount} حلقة (نبدأ بالدفعة الأولى ${effectiveInitialBatch} حلقات)`
                    : `${episodeCount} حلقات`}
                {' · '}
                {scenesPerEpisode > 0 ? `${scenesPerEpisode} مشاهد/حلقة` : 'مشاهد تلقائية'}
                {' · '}
                ~{formatDurationSeconds(targetDurationSec)} · {format}
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-[#00B050] hover:bg-[#00c85b] disabled:opacity-60 text-white text-sm sm:text-base font-extrabold transition-colors cursor-pointer shrink-0"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جارٍ إطلاق خطة السلسلة...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>توليد السلسلة الآن</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Secondary Column: Recent Series + Full Classic Studio Projects */}
          <aside className="space-y-5">
            {/* Recent Series */}
            <section className="rounded-2xl border border-[var(--pline)] bg-[var(--panel)] p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--gold)]" />
                  <h2 className="text-sm font-extrabold">السلاسل الأخيرة</h2>
                </div>
                <span className="text-xs font-mono-nums text-[var(--pmuted)]">
                  {recentSeries.length}
                </span>
              </div>

              {loadingLibraries ? (
                <div className="space-y-2.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-xl border border-[var(--pline)] bg-[var(--surface)]/70 animate-pulse"
                    />
                  ))}
                </div>
              ) : recentSeries.length === 0 ? (
                <p className="text-xs text-[var(--pmuted)] py-4 text-center">
                  لا توجد سلاسل محفوظة بعد. ابدأ بإنشاء أول سلسلة لك من النموذج المجاور.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {recentSeries.slice(0, 8).map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl border border-[var(--pline)] bg-[var(--surface)] hover:border-[var(--gold)]/60 transition-colors flex items-start justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          onNavigate(`/series/${encodeURIComponent(s.id)}`);
                        }}
                        className="flex-1 text-right min-w-0 cursor-pointer space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-extrabold truncate">
                            {s.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--pmuted)] font-mono-nums">
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${STATUS_TEXT_CLASS[s.status]}`}
                          >
                            {STATUS_ARABIC_LABEL[s.status]}
                          </span>
                          <span>
                            · {s.episodes.length}
                            {s.isOpenEnded
                              ? ' حلقة (مفتوحة)'
                              : s.episodeCount > s.episodes.length
                                ? `/${s.episodeCount} حلقة`
                                : ' حلقات'}
                          </span>
                          <span>· {s.format}</span>
                          <span>· {getStyleLabel(s.stylePreset)}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteSeries(s.id)}
                        aria-label={`حذف سلسلة ${s.name}`}
                        className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg text-[var(--pmuted)] hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Full Studio Direct Access + Saved Projects */}
            <section className="rounded-2xl border border-[var(--pline)] bg-[var(--panel)] p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-[#00c85b]" />
                  <h2 className="text-sm font-extrabold">الاستوديو الكامل ومشاريعه</h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/advanced')}
                  className="text-xs font-bold text-[#00c85b] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>فتح الاستوديو</span>
                  <ArrowLeft className="w-3 h-3" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onNavigate('/advanced');
                }}
                className="w-full p-3 rounded-xl border border-[#00B050]/45 bg-[#00B050]/10 hover:bg-[#00B050]/18 text-right transition-colors flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-extrabold text-[#00c85b]">
                    بدء مشروع مباشر في الاستوديو الكامل
                  </div>
                  <div className="text-[11px] text-[var(--pmuted)]">
                    بنك الأسئلة، المذيع الذكي، القوالب، والتصدير المتقدم
                  </div>
                </div>
                <SlidersHorizontal className="w-4 h-4 text-[#00c85b] shrink-0" />
              </button>

              {recentProjects.length > 0 && (
                <div className="space-y-2">
                  {recentProjects.slice(0, 5).map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        onNavigate(`/advanced/${encodeURIComponent(proj.id)}`);
                      }}
                      className="w-full p-2.5 rounded-xl border border-[var(--pline)] bg-[var(--surface)] hover:border-[#00B050]/60 text-right transition-colors flex items-center justify-between gap-2 cursor-pointer min-h-[44px]"
                    >
                      <span className="text-xs font-bold truncate">{proj.name}</span>
                      <span className="text-[11px] font-mono-nums text-[var(--pmuted)] shrink-0">
                        {proj.slideCount} شرائح · {proj.aspectRatio}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
};
