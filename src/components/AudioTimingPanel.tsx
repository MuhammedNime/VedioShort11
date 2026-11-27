import React, { useRef } from 'react';
import { Clock, Music, Play, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react';
import { BUILTIN_SFX_OPTIONS, soundEngine } from '../audio/soundEngine';
import { readFileAsDataUrl } from '../storage/projectStore';
import {
  AudioSettings,
  AudioSlotConfig,
  AudioSlotId,
  BuiltInSfxId,
  DEFAULT_TIMING,
  TemplateSettings,
  TimerPlacement,
  TimerStyle,
  TimerUnitSuffix,
  TimerUrgentColorMode,
  TimingSettings,
} from '../types/quiz';
import { triggerHaptic } from '../utils/haptics';

interface AudioTimingPanelProps {
  audio: AudioSettings;
  timing: TimingSettings;
  template?: TemplateSettings;
  onAudioChange: (next: AudioSettings) => void;
  onTimingChange: (next: TimingSettings) => void;
  onTemplateChange?: (next: TemplateSettings, immediate?: boolean) => void;
}

const AUDIO_CHANNELS: { id: AudioSlotId; title: string; subtitle: string; isBg?: boolean }[] = [
  {
    id: 'questionEnter',
    title: 'صوت دخول السؤال',
    subtitle: 'يبدأ تلقائياً مع ظهور السؤال (ما لم تحدد صوتاً خاصاً للسؤال)',
  },
  {
    id: 'optionEnter',
    title: 'صوت ظهور كل خيار',
    subtitle: 'يبدأ مع كل خيار (ما لم تحدد صوتاً خاصاً للخيار)',
  },
  {
    id: 'countdownTick',
    title: 'صوت العداد (كل ثانية)',
    subtitle: 'يتكرر كل ثانية أثناء عمل المؤقت',
  },
  {
    id: 'suspense',
    title: 'صوت التشويق قبل الجواب',
    subtitle: 'يعمل فور انتهاء العد التنازلي مع نبض الخيارات قبل التلوين بالأخضر',
  },
  {
    id: 'correctReveal',
    title: 'صوت الجواب الصحيح',
    subtitle: 'يبدأ عند اختفاء المؤقت وتلوين الإجابة الصحيحة بالأخضر',
  },
  {
    id: 'bgMusic',
    title: 'موسيقى أو خلفية صوتية',
    subtitle: 'تعمل بشكل متواصل طوال الفيديو (اختياري)',
    isBg: true,
  },
];

export const AudioTimingPanel: React.FC<AudioTimingPanelProps> = ({
  audio,
  timing,
  template,
  onAudioChange,
  onTimingChange,
  onTemplateChange,
}) => {
  const fileInputsRef = useRef<Partial<Record<AudioSlotId, HTMLInputElement | null>>>({});

  const updateSlot = (slotId: AudioSlotId, partial: Partial<AudioSlotConfig>) => {
    onAudioChange({
      ...audio,
      [slotId]: { ...audio[slotId], ...partial },
    });
  };

  const handleUploadAudio = async (
    slotId: AudioSlotId,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    const duration = await soundEngine.getAudioDuration(dataUrl);
    updateSlot(slotId, {
      sourceType: 'custom',
      customFileName: file.name,
      customDataUrl: dataUrl,
      duration,
    });
    e.target.value = '';
  };

  const handleTestPlay = async (slotId: AudioSlotId) => {
    triggerHaptic('light');
    soundEngine.getContext();
    const cfg = audio[slotId];
    await soundEngine.playSlot(cfg);
  };

  const patchTiming = (partial: Partial<TimingSettings>) => {
    onTimingChange({ ...timing, ...partial });
  };

  const patchTemplate = (partial: Partial<TemplateSettings>, immediate = true) => {
    if (!template || !onTemplateChange) return;
    onTemplateChange({ ...template, ...partial }, immediate);
  };

  const triggerTimerPreview = () => {
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('shortvedio:preview-jump-play', { detail: { phase: 'timer' } })
      );
    }, 45);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Auto-Sync Audio Timing Toggle */}
      <section className="flex flex-col gap-3 p-3.5 rounded-xl bg-[#00B050]/12 border border-[#00B050]/40">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={timing.autoSyncWithAudio}
            onChange={(e) => patchTiming({ autoSyncWithAudio: e.target.checked })}
            className="mt-1 w-4 h-4 accent-[#00B050] rounded cursor-pointer shrink-0"
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-[#00B050] dark:text-[#6ee7b7]">
              انتقال تلقائي عند انتهاء الصوت (تزامن مع التعليق الصوتي)
            </span>
            <span className="text-[11px] text-[var(--pmuted)] leading-relaxed">
              يبدأ الصوت تلقائياً مع السؤال أو الخيار، وعند انتهاء الملف الصوتي ينتقل
              للمرحلة التي تليه دون تداخل.
            </span>
          </div>
        </label>

        {timing.autoSyncWithAudio && (
          <label className="flex flex-col gap-1 pt-1 border-t border-[#00B050]/25">
            <div className="flex items-center justify-between text-xs text-[var(--ptxt)]">
              <span>مهلة قصيرة بعد انتهاء كل صوت</span>
              <span className="font-mono-nums text-[#00B050] dark:text-[#6ee7b7]">
                {(timing.audioEndGap ?? 0.15).toFixed(2)} ث
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.0}
              step={0.05}
              value={timing.audioEndGap ?? 0.15}
              onChange={(e) => patchTiming({ audioEndGap: parseFloat(e.target.value) })}
              className="w-full"
            />
          </label>
        )}

        <div className="pt-2 border-t border-[#00B050]/25 flex flex-col gap-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={timing.autoDuckMusic !== false}
              onChange={(e) => patchTiming({ autoDuckMusic: e.target.checked })}
              className="mt-0.5 w-4 h-4 accent-[#00B050] rounded cursor-pointer shrink-0"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-[var(--ptxt)]">
                خفض موسيقى الخلفية تلقائياً أثناء كلام المذيع (Auto-Ducking)
              </span>
              <span className="text-[11px] text-[var(--pmuted)]">
                تخف الموسيقى تلقائياً عند نطق السؤال والخيارات ثم تعود طبيعياً.
              </span>
            </div>
          </label>

          {timing.autoDuckMusic !== false && (
            <label className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-[var(--ptxt)]">
                <span>مستوى الموسيقى أثناء الكلام</span>
                <span className="font-mono-nums text-[#00B050] dark:text-[#6ee7b7]">
                  {Math.round((timing.bgMusicDuckRatio ?? 0.22) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.65}
                step={0.05}
                value={timing.bgMusicDuckRatio ?? 0.22}
                onChange={(e) =>
                  patchTiming({ bgMusicDuckRatio: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </label>
          )}
        </div>
      </section>

      {/* 1. Audio Channels (Matches attached HTML 5 channels + BG Music) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--ptxt)]">
            1. الأصوات (ارفع ملفاتك أو اختر الافتراضي)
          </h2>
          <span className="text-[11px] text-[var(--pmuted)]">MP3 · WAV · OGG</span>
        </div>

        <div className="flex flex-col gap-3">
          {AUDIO_CHANNELS.map((ch) => {
            const cfg = audio[ch.id];
            const isCustom = cfg?.sourceType === 'custom' && !!cfg.customDataUrl;

            return (
              <div
                key={ch.id}
                className="flex flex-col gap-2.5 p-3 rounded-xl bg-[var(--surface)] border border-[var(--pline)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-[var(--ptxt)]">{ch.title}</div>
                    <div className="text-[11px] text-[var(--pmuted)] mt-0.5">{ch.subtitle}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleTestPlay(ch.id)}
                    title="تجربة الصوت"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--panel)] hover:border-[var(--gold)] border border-[var(--pline)] text-[#00B050] dark:text-[#6ee7b7] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>اختبار</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {!ch.isBg && !isCustom ? (
                    <select
                      value={cfg.builtinId}
                      onChange={(e) =>
                        updateSlot(ch.id, {
                          sourceType: 'builtin',
                          builtinId: e.target.value as BuiltInSfxId,
                        })
                      }
                      className="flex-1 px-2.5 py-2 rounded-lg bg-[var(--panel)] border border-[var(--pline)] text-xs text-[var(--ptxt)] focus:border-[#00B050] focus:outline-none"
                    >
                      {BUILTIN_SFX_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--panel)] border border-[var(--pline)] text-xs text-[var(--ptxt)] truncate">
                      <Music className="w-3.5 h-3.5 text-[#00B050] shrink-0" />
                      <span className="truncate">
                        {isCustom
                          ? `✓ مرفوع: ${cfg.customFileName || 'ملف صوتي'}${
                              cfg.duration ? ` (${cfg.duration.toFixed(1)} ث)` : ''
                            }`
                          : 'بدون موسيقى خلفية'}
                      </span>
                    </div>
                  )}

                  <input
                    ref={(el) => {
                      fileInputsRef.current[ch.id] = el;
                    }}
                    type="file"
                    accept="audio/*"
                    onChange={(e) => void handleUploadAudio(ch.id, e)}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputsRef.current[ch.id]?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00B050]/15 hover:bg-[#00B050]/25 text-[#00B050] dark:text-[#6ee7b7] border border-[#00B050]/35 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isCustom ? 'تغيير' : 'رفع صوت'}</span>
                  </button>

                  {isCustom && (
                    <button
                      type="button"
                      onClick={() =>
                        updateSlot(ch.id, {
                          sourceType: 'builtin',
                          customDataUrl: undefined,
                          customFileName: undefined,
                          duration: undefined,
                        })
                      }
                      title="إزالة الملف المخصص"
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-3">
                  <span className="text-[11px] text-[var(--pmuted)] whitespace-nowrap">مستوى الصوت</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={cfg.volume}
                    onChange={(e) =>
                      updateSlot(ch.id, { volume: parseFloat(e.target.value) })
                    }
                    className="flex-1 h-1"
                  />
                  <span className="font-mono-nums text-[11px] text-[var(--ptxt)] w-9 text-left">
                    {Math.round(cfg.volume * 100)}%
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Animation Timing Controls */}
      <section className="flex flex-col gap-3 border-t border-[var(--pline)] pt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[var(--ptxt)]">
            2. التوقيت والعداد (ثانية)
          </h2>
          <button
            type="button"
            onClick={() => onTimingChange({ ...DEFAULT_TIMING })}
            title="استعادة أوقات التوقيت الافتراضية"
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--surface)] border border-[var(--pline)] hover:border-[#00B050] text-[11px] font-bold text-[var(--ptxt)] cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-[#00B050]" />
            <span>استعادة الافتراضي</span>
          </button>
        </div>

        {/* 1-Click Retention & Speed Presets */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-[var(--pmuted)]">
            أوضاع التوقيت الجاهزة (ضغطة واحدة):
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              {
                id: 'fastShorts',
                label: 'شورتس سريع ⚡',
                sub: '3.5ث عداد · مشاهدات عالية',
                values: {
                  introHold: 0,
                  questionReadDelay: 0.7,
                  optionStaggerDelay: 0.25,
                  thinkingDuration: 3.5,
                  suspenseDuration: 0.8,
                  revealHoldDuration: 2.0,
                  transitionGap: 0.2,
                },
              },
              {
                id: 'balanced',
                label: 'متوازن ⚖️',
                sub: '5ث عداد · قياسي',
                values: {
                  introHold: DEFAULT_TIMING.introHold,
                  questionReadDelay: DEFAULT_TIMING.questionReadDelay,
                  optionStaggerDelay: DEFAULT_TIMING.optionStaggerDelay,
                  thinkingDuration: DEFAULT_TIMING.thinkingDuration,
                  suspenseDuration: DEFAULT_TIMING.suspenseDuration,
                  revealHoldDuration: DEFAULT_TIMING.revealHoldDuration,
                  transitionGap: DEFAULT_TIMING.transitionGap,
                },
              },
              {
                id: 'deepChallenge',
                label: 'تحدي عميق 🧮',
                sub: '8ث عداد · رياضيات/ألغاز',
                values: {
                  introHold: 0.2,
                  questionReadDelay: 1.4,
                  optionStaggerDelay: 0.45,
                  thinkingDuration: 8.0,
                  suspenseDuration: 1.2,
                  revealHoldDuration: 3.25,
                  transitionGap: 0.4,
                },
              },
            ].map((preset) => {
              const isSelected =
                Math.abs((timing.thinkingDuration ?? 0) - preset.values.thinkingDuration) < 0.05 &&
                Math.abs((timing.suspenseDuration ?? 0) - preset.values.suspenseDuration) < 0.05 &&
                Math.abs((timing.revealHoldDuration ?? 0) - preset.values.revealHoldDuration) < 0.05;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => patchTiming(preset.values)}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg border text-center transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#00B050]/15 border-[#00B050] text-[#00B050] dark:text-[#6ee7b7]'
                      : 'bg-[var(--surface)] border-[var(--pline)] hover:border-[var(--gold)] text-[var(--ptxt)]'
                  }`}
                >
                  <span className="text-[11px] font-bold whitespace-nowrap">{preset.label}</span>
                  <span className="text-[9.5px] text-[var(--pmuted)] leading-tight">
                    {preset.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {[
            {
              key: 'introHold' as const,
              label: 'مهلة قبل ظهور السؤال (0 = فوري مع الصوت)',
              min: 0,
              max: 4.0,
              step: 0.05,
            },
            {
              key: 'questionReadDelay' as const,
              label: 'مهلة السؤال قبل الخيار الأول',
              min: 0.1,
              max: 8.0,
              step: 0.1,
            },
            {
              key: 'optionStaggerDelay' as const,
              label: 'الفاصل بين كل خيار وآخر',
              min: 0.1,
              max: 4.0,
              step: 0.05,
            },
            {
              key: 'thinkingDuration' as const,
              label: 'مدة العداد في المنتصف (5 ث لعداد الفيديو)',
              min: 1.0,
              max: 20.0,
              step: 0.5,
            },
            {
              key: 'suspenseDuration' as const,
              label: 'مدة التشويق والنبض قبل كشف الجواب',
              min: 0,
              max: 5.0,
              step: 0.2,
            },
            {
              key: 'revealHoldDuration' as const,
              label: 'مدة بقاء الناتج الصحيح بالأخضر',
              min: 0.5,
              max: 12.0,
              step: 0.25,
            },
            {
              key: 'transitionGap' as const,
              label: 'فاصل بين الشرائح',
              min: 0,
              max: 4.0,
              step: 0.1,
            },
          ].map((item) => (
            <label key={item.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-[var(--ptxt)]">
                <span>{item.label}</span>
                <span className="font-mono-nums text-[#00B050] dark:text-[#6ee7b7] font-bold">
                  {(timing[item.key] ?? 0).toFixed(2)} ث
                </span>
              </div>
              <input
                type="range"
                min={item.min}
                max={item.max}
                step={item.step}
                value={timing[item.key] ?? 0}
                onChange={(e) =>
                  patchTiming({ [item.key]: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </label>
          ))}
        </div>

        {/* Escalating Speed / Progressive Difficulty */}
        <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-[var(--surface)] border border-[var(--pline)]">
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-[var(--ptxt)]">
                تسريع العداد تصاعدياً في الأسئلة الأخيرة ⚡
              </div>
              <div className="text-[11px] text-[var(--pmuted)] mt-0.5">
                يقصر وقت التفكير تدريجياً مع كل سؤال لرفع الحماس ومنع الملل
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(timing.escalatingSpeed)}
              onChange={(e) => patchTiming({ escalatingSpeed: e.target.checked })}
              className="w-4 h-4 accent-[#00B050] rounded cursor-pointer shrink-0"
            />
          </label>

          {timing.escalatingSpeed && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--pline)]">
              <label className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] text-[var(--ptxt)]">
                  <span>نقص لكل سؤال</span>
                  <span className="font-mono-nums font-bold text-[#00B050]">
                    -{(timing.escalatingStepSeconds ?? 0.5).toFixed(2)} ث
                  </span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={2.0}
                  step={0.25}
                  value={timing.escalatingStepSeconds ?? 0.5}
                  onChange={(e) =>
                    patchTiming({ escalatingStepSeconds: parseFloat(e.target.value) })
                  }
                />
              </label>

              <label className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] text-[var(--ptxt)]">
                  <span>أقل وقت مسموح</span>
                  <span className="font-mono-nums font-bold text-[var(--gold)]">
                    {(timing.escalatingMinSeconds ?? 2.0).toFixed(1)} ث
                  </span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={5.0}
                  step={0.5}
                  value={timing.escalatingMinSeconds ?? 2.0}
                  onChange={(e) =>
                    patchTiming({ escalatingMinSeconds: parseFloat(e.target.value) })
                  }
                />
              </label>
            </div>
          )}
        </div>
      </section>

      {/* 3. Countdown Timer Design & Live Visual Sync */}
      {template && onTemplateChange && (
        <section className="flex flex-col gap-3 border-t border-[var(--pline)] pt-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#00B050]" />
              <h2 className="text-sm font-bold text-[var(--ptxt)]">
                3. أنماط عرض المؤقت وتأثير اقتراب الانتهاء
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  triggerTimerPreview();
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#00B050]/15 hover:bg-[#00B050]/25 text-[#00B050] dark:text-[#6ee7b7] border border-[#00B050]/35 text-[10.5px] font-bold transition-colors cursor-pointer"
                title="تشغيل المعاينة بدءاً من لحظة المؤقت"
              >
                <Play className="w-2.5 h-2.5" />
                <span>معاينة المؤقت</span>
              </button>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--surface)] text-[var(--ptxt)] border border-[var(--pline)] font-mono-nums">
                {Math.ceil(timing.thinkingDuration || 5)}
                {template.timerUnitSuffix ?? ''}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(
              [
                {
                  id: 'circle',
                  label: 'عداد دائري',
                  hint: 'حلقة دائرية',
                  icon: (
                    <svg viewBox="0 0 32 32" className="w-6 h-6">
                      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
                      <path d="M16 5 A11 11 0 1 1 6 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      <text x="16" y="19.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="currentColor">5</text>
                    </svg>
                  ),
                },
                {
                  id: 'bar',
                  label: 'شريط تناقص',
                  hint: 'تقدم أفقي متناقص',
                  icon: (
                    <svg viewBox="0 0 32 32" className="w-6 h-6">
                      <text x="16" y="12" textAnchor="middle" fontSize="9" fontWeight="900" fill="currentColor">5</text>
                      <rect x="3" y="17" width="26" height="6" rx="3" fill="currentColor" fillOpacity="0.2" />
                      <rect x="11" y="17" width="18" height="6" rx="3" fill="currentColor" />
                    </svg>
                  ),
                },
                {
                  id: 'digits',
                  label: 'مؤقت رقمي كبير',
                  hint: 'أرقام بارزة واضحة',
                  icon: (
                    <svg viewBox="0 0 32 32" className="w-6 h-6">
                      <text x="16" y="22.5" textAnchor="middle" fontSize="19" fontWeight="900" fill="currentColor">05</text>
                    </svg>
                  ),
                },
                {
                  id: 'neonRing',
                  label: 'حلقة نيون',
                  hint: 'إطار دائري مضيء',
                  icon: (
                    <svg viewBox="0 0 32 32" className="w-6 h-6">
                      <circle cx="16" cy="16" r="11" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2.8" strokeDasharray="48 16" />
                      <text x="16" y="19.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="currentColor">5</text>
                    </svg>
                  ),
                },
                {
                  id: 'pillCountdown',
                  label: 'كبسولة رقمية',
                  hint: 'حبة + شريط تناقص',
                  icon: (
                    <svg viewBox="0 0 32 32" className="w-6 h-6">
                      <rect x="3" y="7" width="26" height="18" rx="9" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2" />
                      <text x="16" y="17" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="currentColor">5s</text>
                      <rect x="8" y="20" width="16" height="2.5" rx="1.2" fill="currentColor" />
                    </svg>
                  ),
                },
                {
                  id: 'channelBox',
                  label: 'مربع القناة',
                  hint: 'صندوق تلفزيوني',
                  icon: (
                    <svg viewBox="0 0 32 32" className="w-6 h-6">
                      <rect x="5" y="6" width="22" height="20" rx="5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2.2" />
                      <text x="16" y="19.5" textAnchor="middle" fontSize="11" fontWeight="900" fill="currentColor">5</text>
                    </svg>
                  ),
                },
                {
                  id: 'hexBadge',
                  label: 'شارة سداسية',
                  hint: 'أسلوب المسابقات',
                  icon: (
                    <svg viewBox="0 0 32 32" className="w-6 h-6">
                      <polygon points="8,7 24,7 29,16 24,25 8,25 3,16" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2" />
                      <text x="16" y="19.5" textAnchor="middle" fontSize="10.5" fontWeight="900" fill="currentColor">5</text>
                    </svg>
                  ),
                },
                {
                  id: 'none',
                  label: 'إخفاء العداد',
                  hint: 'بدون مؤقت مرئي',
                  icon: (
                    <svg viewBox="0 0 32 32" className="w-6 h-6">
                      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
                      <line x1="8" y1="8" x2="24" y2="24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  ),
                },
              ] as Array<{ id: TimerStyle; label: string; hint: string; icon: React.ReactNode }>
            ).map((st) => {
              const active = template.timerStyle === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    patchTemplate({ timerStyle: st.id });
                    if (st.id !== 'none') triggerTimerPreview();
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-center transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#00B050]/15 border-[#00B050] text-[#00B050] dark:text-[#6ee7b7]'
                      : 'bg-[var(--surface)] border-[var(--pline)] hover:border-[var(--gold)] text-[var(--ptxt)]'
                  }`}
                >
                  <div className={active ? 'text-[#00B050] dark:text-[#6ee7b7]' : 'text-[var(--pmuted)]'}>
                    {st.icon}
                  </div>
                  <span className="text-[11px] font-bold leading-tight">{st.label}</span>
                  <span className="text-[9.5px] text-[var(--pmuted)] leading-tight">{st.hint}</span>
                </button>
              );
            })}
          </div>

          {template.timerStyle !== 'none' && (
            <div className="flex flex-col gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--pline)]">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-[var(--ptxt)]">مكان ظهور العداد</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'aboveOptions', label: 'فوق الخيارات' },
                      { id: 'aroundQuestion', label: 'يحيط بالسؤال' },
                      { id: 'centerOfOptions', label: 'وسط الخيارات' },
                      { id: 'belowOptions', label: 'أسفل الخيارات' },
                      { id: 'free', label: 'حُر (X / Y)' },
                    ] as Array<{ id: TimerPlacement; label: string }>
                  ).map((pl) => {
                    const active = (template.timerPlacement || 'aboveOptions') === pl.id;
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic('selection');
                          patchTemplate({ timerPlacement: pl.id });
                        }}
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#00B050]/15 border-[#00B050] text-[#00B050] dark:text-[#6ee7b7]'
                            : 'bg-[var(--panel)] border-[var(--pline)] text-[var(--ptxt)] hover:border-[var(--gold)]'
                        }`}
                      >
                        {pl.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] text-[var(--ptxt)]">
                    <span>حجم العداد</span>
                    <span className="font-mono-nums font-bold text-[#00B050]">
                      {Math.round((template.timerScale ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={1.6}
                    step={0.05}
                    value={template.timerScale ?? 1}
                    onChange={(e) =>
                      patchTemplate({ timerScale: parseFloat(e.target.value) }, false)
                    }
                    className="w-full"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] text-[var(--ptxt)]">
                    <span>مدة العد التنازلي</span>
                    <span className="font-mono-nums font-bold text-[#00B050]">
                      {(timing.thinkingDuration ?? 5).toFixed(1)} ث
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={20.0}
                    step={0.5}
                    value={timing.thinkingDuration ?? 5}
                    onChange={(e) =>
                      patchTiming({ thinkingDuration: parseFloat(e.target.value) })
                    }
                    className="w-full"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-[var(--pmuted)]">لون الرقم / الشريط الأساسي</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={template.timerColor || '#00B050'}
                      onChange={(e) =>
                        patchTemplate({
                          timerColor: e.target.value,
                          timerMatchBackground: false,
                        })
                      }
                      className="w-8 h-7 rounded cursor-pointer border border-[var(--pline)]"
                    />
                    <span className="text-[10px] font-mono-nums text-[var(--pmuted)]">
                      {template.timerColor}
                    </span>
                  </div>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-[var(--pmuted)]">لون خلفية العداد</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={template.timerBgColor || '#F2E3BA'}
                      onChange={(e) =>
                        patchTemplate({
                          timerBgColor: e.target.value,
                          timerMatchBackground: false,
                        })
                      }
                      className="w-8 h-7 rounded cursor-pointer border border-[var(--pline)]"
                    />
                    <span className="text-[10px] font-mono-nums text-[var(--pmuted)]">
                      {template.timerBgColor}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--pline)]">
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-[var(--ptxt)]">
                  <input
                    type="checkbox"
                    checked={template.timerMatchBackground !== false}
                    onChange={(e) => {
                      triggerHaptic('selection');
                      patchTemplate({ timerMatchBackground: e.target.checked });
                    }}
                    className="w-3.5 h-3.5 accent-[#00B050]"
                  />
                  <span>مطابقة خلفية العداد مع بطاقة السؤال تلقائياً</span>
                </label>

                <select
                  value={template.timerUnitSuffix ?? ''}
                  onChange={(e) =>
                    patchTemplate({ timerUnitSuffix: e.target.value as TimerUnitSuffix })
                  }
                  className="px-2 py-1 rounded-lg bg-[var(--panel)] border border-[var(--pline)] text-[11px] text-[var(--ptxt)]"
                >
                  <option value="">رقم صافي (5)</option>
                  <option value=" ث">مع وحدة عربي (5 ث)</option>
                  <option value="s">مع وحدة إنجليزي (5s)</option>
                </select>
              </div>

              {/* Dedicated Urgent End-of-Time Color Shift & Alert Controls */}
              <div className="flex flex-col gap-2.5 p-2.5 rounded-xl bg-rose-500/8 border border-rose-500/25">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <div>
                      <div className="text-[11.5px] font-bold text-[var(--ptxt)]">
                        تأثير تغيير اللون عند اقتراب الوقت من الانتهاء
                      </div>
                      <div className="text-[10px] text-[var(--pmuted)]">
                        يبدّل لون العداد ونبضه تلقائياً في الثواني الأخيرة لجذب انتباه المشاهد
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={template.timerUrgentPulse !== false}
                    onChange={(e) => {
                      triggerHaptic('selection');
                      patchTemplate({ timerUrgentPulse: e.target.checked });
                      if (e.target.checked) triggerTimerPreview();
                    }}
                    className="w-4 h-4 accent-rose-500 rounded cursor-pointer shrink-0"
                  />
                </label>

                {template.timerUrgentPulse !== false && (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-rose-500/20">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-bold text-[var(--ptxt)]">
                        طريقة تغيير اللون
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: 'instant', label: 'تحوّل فوري', hint: 'لون ثابت + نبض' },
                            { id: 'gradual', label: 'تدرج لوني', hint: 'يتصاعد للنهاية' },
                            { id: 'flash', label: 'وميض تحذيري', hint: 'تناوب لوني سريع' },
                          ] as Array<{ id: TimerUrgentColorMode; label: string; hint: string }>
                        ).map((m) => {
                          const active = (template.timerUrgentColorMode || 'instant') === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                triggerHaptic('selection');
                                patchTemplate({ timerUrgentColorMode: m.id });
                                triggerTimerPreview();
                              }}
                              className={`flex flex-col items-center justify-center px-1.5 py-1.5 rounded-lg border text-center transition-colors cursor-pointer ${
                                active
                                  ? 'bg-rose-500/20 border-rose-500 text-rose-600 dark:text-rose-300'
                                  : 'bg-[var(--panel)] border-[var(--pline)] text-[var(--ptxt)] hover:border-rose-400'
                              }`}
                            >
                              <span className="text-[10.5px] font-bold">{m.label}</span>
                              <span className="text-[9px] text-[var(--pmuted)]">{m.hint}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                      <label className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10.5px] text-[var(--ptxt)]">
                          <span>يبدأ تغيير اللون قبل النهاية بـ</span>
                          <span className="font-mono-nums font-bold text-rose-500">
                            {Math.min(8, Math.max(1, template.timerUrgentThreshold ?? 3))} ث
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={8}
                          step={1}
                          value={Math.min(8, Math.max(1, template.timerUrgentThreshold ?? 3))}
                          onChange={(e) =>
                            patchTemplate({ timerUrgentThreshold: parseInt(e.target.value, 10) })
                          }
                          className="w-full accent-rose-500"
                        />
                      </label>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] text-[var(--ptxt)]">لون التحذير النهائي</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {['#EF4444', '#F97316', '#EC4899', '#FACC15', '#22D3EE'].map((hex) => {
                            const selected =
                              (template.timerUrgentColor || '#EF4444').toUpperCase() === hex;
                            return (
                              <button
                                key={hex}
                                type="button"
                                onClick={() => {
                                  triggerHaptic('selection');
                                  patchTemplate({ timerUrgentColor: hex });
                                }}
                                title={hex}
                                className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                                  selected
                                    ? 'border-white scale-110 ring-2 ring-rose-500'
                                    : 'border-[var(--pline)] hover:scale-105'
                                }`}
                                style={{ backgroundColor: hex }}
                              />
                            );
                          })}
                          <input
                            type="color"
                            value={template.timerUrgentColor || '#EF4444'}
                            onChange={(e) => patchTemplate({ timerUrgentColor: e.target.value })}
                            title="لون تحذير مخصص"
                            className="w-7 h-6 rounded cursor-pointer border border-[var(--pline)]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-rose-500/20">
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-[var(--ptxt)]">
                        <input
                          type="checkbox"
                          checked={Boolean(template.timerUrgentRushBanner)}
                          onChange={(e) => {
                            triggerHaptic('selection');
                            patchTemplate({ timerUrgentRushBanner: e.target.checked });
                          }}
                          className="w-3.5 h-3.5 accent-rose-500"
                        />
                        <span>إظهار شارة «الوقت ينفد! 🔥» النابضة في الثواني الأخيرة</span>
                      </label>

                      {template.timerUrgentRushBanner && (
                        <input
                          type="text"
                          value={template.timerUrgentRushText ?? 'الوقت ينفد! 🔥'}
                          onChange={(e) => patchTemplate({ timerUrgentRushText: e.target.value })}
                          placeholder="الوقت ينفد! 🔥"
                          className="px-2.5 py-1 rounded-lg bg-[var(--panel)] border border-[var(--pline)] text-[11px] text-[var(--ptxt)]"
                        />
                      )}

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-[var(--ptxt)]">
                        <input
                          type="checkbox"
                          checked={Boolean(template.timerUrgentDoubleBeat)}
                          onChange={(e) => {
                            triggerHaptic('selection');
                            patchTemplate({ timerUrgentDoubleBeat: e.target.checked });
                          }}
                          className="w-3.5 h-3.5 accent-rose-500"
                        />
                        <span>مضاعفة نبضات التكتكة (كل نصف ثانية) في الثواني الأخيرة ⚡</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
