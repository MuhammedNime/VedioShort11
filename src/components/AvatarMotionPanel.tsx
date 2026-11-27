import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
  Volume2,
  Wand2,
} from 'lucide-react';
import {
  CLAWATAR_CAMERA_PRESETS,
  CLAWATAR_EXPRESSIONS,
  CLAWATAR_MODELS,
  CLAWATAR_STATE_PRESETS,
  ClawatarAnimationEntry,
  FEATURED_CLAWATAR_ANIMATIONS,
  fetchVerifiedClawatarAnimations,
} from '../clawatar/catalog';
import {
  AvatarAutoBehaviors,
  AvatarManualStateId,
  AvatarMotionMode,
  ClawatarBgMode,
  ClawatarCameraPreset,
  ClawatarExpression,
  DEFAULT_AVATAR_AUTO_BEHAVIORS,
  PresenterLipSyncMode,
  PresenterPoseId,
  TemplateSettings,
} from '../types/quiz';
import { triggerHaptic } from '../utils/haptics';

interface AvatarMotionPanelProps {
  template: TemplateSettings;
  onChange: (next: TemplateSettings, immediate?: boolean) => void;
}

const STATE_TO_DEMO_POSE: Record<AvatarManualStateId, PresenterPoseId> = {
  idle: 'explain',
  talking: 'waveSpeak',
  thinking: 'thinkForehead',
  explaining: 'explain',
  greeting: 'waveSpeak',
  happy: 'celebrate',
  surprised: 'leanSuspense',
  confused: 'thinkChin',
};

const STATE_DESCRIPTIONS: Record<AvatarManualStateId, { shortTitle: string; hint: string; icon: string }> = {
  idle: { shortTitle: 'سكون ووقفة طبيعية', hint: 'وقفة هادئة قبل بدء الكلام', icon: '🧍' },
  greeting: { shortTitle: 'ترحيب وتلويح', hint: 'تحية للمشاهدين قبل السؤال', icon: '👋' },
  explaining: { shortTitle: 'شرح وتقديم', hint: 'وضعية تقديم وشرح للخيارات', icon: '🤲' },
  thinking: { shortTitle: 'تفكير وتركيز', hint: 'وقفة تأمل وتفكير في اللغز', icon: '🤔' },
  talking: { shortTitle: 'تحدث متفاعل', hint: 'تأهب للحوار مع الشفاه', icon: '🎙️' },
  happy: { shortTitle: 'فرح واحتفال', hint: 'ابتسامة وتشجيع وتصفيق', icon: '🙌' },
  surprised: { shortTitle: 'تشويق ودهشة', hint: 'نظرة ترقب وجذب الانتباه', icon: '😮' },
  confused: { shortTitle: 'تساؤل وحيرة', hint: 'تعجب وتحفيز للتخمين', icon: '🧐' },
};

const AUTO_BEHAVIOR_ITEMS: {
  key: keyof Required<AvatarAutoBehaviors>;
  title: string;
  desc: string;
  emoji: string;
}[] = [
  {
    key: 'lipSyncWithVoice',
    title: 'مزامنة الشفاه تلقائياً مع الصوت',
    desc: 'تحريك الشفاه ومخارج الحروف لحظياً مع الصوت الفعلي ونبرة الكلام',
    emoji: '👄',
  },
  {
    key: 'headAndHandsWhileTalking',
    title: 'إيماءات الرأس واليدين عند الحكي',
    desc: 'إيماءة رأس خفيفة وحركة يدين طبيعية متناغمة مع الكلام',
    emoji: '🗣️',
  },
  {
    key: 'autoAwareThinking',
    title: 'واعية التفكير والعد التنازلي',
    desc: 'حالة تفكير تلقائية عند بدء المؤقت ثم تنبيه الوقت في آخر ثانيتين',
    emoji: '🤔',
  },
  {
    key: 'autoAwareCorrectReveal',
    title: 'واعية الجواب الصحيح والاحتفال',
    desc: 'تصفيق وفرح تلقائي لحظة كشف الإجابة الصحيحة أو جاهزية حل الذكاء',
    emoji: '🎉',
  },
  {
    key: 'autoAwareSuspense',
    title: 'واعية التشويق ولحظة الحسم',
    desc: 'تعبير ترقّب وتركيز قبيل إعلان الجواب الصحيح مباشرة',
    emoji: '⏳',
  },
  {
    key: 'autoAwareIntroOutro',
    title: 'واعية الترحيب بالمقدمة والخاتمة',
    desc: 'تلويح ترحيبي في البداية وإشارة شكر/اشتراك في نهاية الفيديو',
    emoji: '👋',
  },
  {
    key: 'naturalBlinkAndBreathing',
    title: 'رمش العينين والتنفس الطبيعي',
    desc: 'حركة تنفس هادئة ورمش طبيعي غير منتظم لحيوية مستمرة',
    emoji: '👀',
  },
  {
    key: 'autoMicroExpressions',
    title: 'تعابير الوجه والحواجب التلقائية',
    desc: 'تغيير الابتسامة والحواجب ونظرة العين تلقائياً مع كل مرحلة',
    emoji: '✨',
  },
];

export const AvatarMotionPanel: React.FC<AvatarMotionPanelProps> = ({
  template,
  onChange,
}) => {
  const vrmInputRef = useRef<HTMLInputElement | null>(null);
  const demoTimerRef = useRef<number | null>(null);
  const [clawatarAnimations, setClawatarAnimations] = useState<ClawatarAnimationEntry[]>(
    FEATURED_CLAWATAR_ANIMATIONS
  );
  const [previewingState, setPreviewingState] = useState<AvatarManualStateId | null>(null);

  useEffect(() => {
    void fetchVerifiedClawatarAnimations().then((list) => {
      if (list.length > 0) setClawatarAnimations(list);
    });
    return () => {
      if (demoTimerRef.current) window.clearTimeout(demoTimerRef.current);
    };
  }, []);

  const patch = (partial: Partial<TemplateSettings>, immediate = true) => {
    onChange({ ...template, ...partial }, immediate);
  };

  const motionMode: AvatarMotionMode = template.avatarMotionMode || 'manualThenAuto';
  const manualState: AvatarManualStateId = template.avatarManualState || 'greeting';
  const behaviors: Required<AvatarAutoBehaviors> = {
    ...DEFAULT_AVATAR_AUTO_BEHAVIORS,
    ...(template.avatarAutoBehaviors ?? {}),
  };
  const isEnabled = Boolean(template.presenterEnabled);
  const isClawatar = (template.presenterStyle || 'clawatar3d') === 'clawatar3d';

  const triggerStatePreview = (stateId: AvatarManualStateId) => {
    triggerHaptic('light');
    setPreviewingState(stateId);
    if (demoTimerRef.current) window.clearTimeout(demoTimerRef.current);
    window.dispatchEvent(
      new CustomEvent('shortvedio:presenter-demo', {
        detail: {
          pose: STATE_TO_DEMO_POSE[stateId],
          clawatarStateId: stateId,
        },
      })
    );
    demoTimerRef.current = window.setTimeout(() => {
      setPreviewingState(null);
    }, 2600);
  };

  const selectManualState = (stateId: AvatarManualStateId) => {
    triggerHaptic('selection');
    const preset = CLAWATAR_STATE_PRESETS.find((s) => s.stateId === stateId);
    patch({
      presenterEnabled: true,
      presenterStyle: template.presenterStyle || 'clawatar3d',
      avatarManualState: stateId,
      avatarMotionMode: motionMode === 'autoSmart' ? 'manualThenAuto' : motionMode,
      clawatarDefaultAction:
        motionMode === 'manualLocked' && preset ? preset.actionId : 'auto',
      clawatarExpression: 'auto',
    });
    triggerStatePreview(stateId);
  };

  const setMotionMode = (mode: AvatarMotionMode) => {
    triggerHaptic('selection');
    const preset = CLAWATAR_STATE_PRESETS.find((s) => s.stateId === manualState);
    patch({
      presenterEnabled: true,
      avatarMotionMode: mode,
      clawatarDefaultAction: mode === 'manualLocked' && preset ? preset.actionId : 'auto',
    });
  };

  const toggleBehavior = (key: keyof Required<AvatarAutoBehaviors>) => {
    triggerHaptic('selection');
    const nextVal = !behaviors[key];
    const nextBehaviors: Required<AvatarAutoBehaviors> = {
      ...behaviors,
      [key]: nextVal,
    };
    const extra: Partial<TemplateSettings> = {};
    if (key === 'lipSyncWithVoice') {
      extra.presenterContinuousTalk = nextVal;
      if (!nextVal) {
        extra.presenterLipSyncMode = 'audioOnly';
      }
    }
    patch({
      avatarAutoBehaviors: nextBehaviors,
      ...extra,
    });
  };

  const enableAllAutoBehaviors = () => {
    triggerHaptic('success');
    patch({
      presenterEnabled: true,
      avatarMotionMode: 'manualThenAuto',
      avatarAutoBehaviors: { ...DEFAULT_AVATAR_AUTO_BEHAVIORS },
      presenterLipSyncMode: 'audioAndReading',
      presenterContinuousTalk: true,
      presenterTalkIntensity: Math.max(75, template.presenterTalkIntensity ?? 75),
      presenterExpressiveness: Math.max(105, template.presenterExpressiveness ?? 105),
      clawatarDefaultAction: 'auto',
      clawatarExpression: 'auto',
    });
    triggerStatePreview(manualState);
  };

  const activeLipMode: PresenterLipSyncMode =
    template.presenterLipSyncMode ??
    (template.presenterContinuousTalk === false ? 'audioOnly' : 'audioAndReading');

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={vrmInputRef}
        type="file"
        accept=".vrm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : '';
            if (dataUrl) {
              patch({
                presenterEnabled: true,
                presenterStyle: 'clawatar3d',
                clawatarModelId: 'custom',
                clawatarCustomModelUrl: dataUrl,
                clawatarCustomModelName: file.name,
              });
            }
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }}
      />

      {/* 1. Header Activation & Character Quick Picker */}
      <section className="p-3 rounded-xl bg-[var(--card)] border border-[var(--pline)] flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#00B050]/15 border border-[#00B050]/35 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-[#00B050]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-[var(--ptxt)] truncate">
                تحركات الأفاتار والذكاء التفاعلي
              </h2>
              <p className="text-[10px] text-[var(--pmuted)] truncate">
                اختر الحالة المبدئية يدوياً قبل البدء، وتفاعل تلقائياً مع الصوت والإجابات
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => patch({ presenterEnabled: !isEnabled })}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
              isEnabled
                ? 'bg-[#00B050]/18 border-[#00B050] text-[#00B050] dark:text-[#6ee7b7]'
                : 'bg-[var(--surface)] border-[var(--pline)] text-[var(--pmuted)]'
            }`}
          >
            {isEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{isEnabled ? 'ظاهر' : 'مخفي'}</span>
          </button>
        </div>

        {/* Switch between Clawatar 3D and Studio 3D */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() =>
              patch({
                presenterEnabled: true,
                presenterStyle: 'clawatar3d',
              })
            }
            className={`px-2.5 py-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
              isClawatar
                ? 'bg-[#00B050]/18 border-[#00B050] text-[#00B050] dark:text-[#6ee7b7]'
                : 'bg-[var(--surface)] border-[var(--pline)] text-[var(--ptxt)]'
            }`}
          >
            ✨ أفاتار Clawatar 3D (VRM)
          </button>
          <button
            type="button"
            onClick={() =>
              patch({
                presenterEnabled: true,
                presenterStyle: 'stylized3d',
              })
            }
            className={`px-2.5 py-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
              !isClawatar
                ? 'bg-[#00B050]/18 border-[#00B050] text-[#00B050] dark:text-[#6ee7b7]'
                : 'bg-[var(--surface)] border-[var(--pline)] text-[var(--ptxt)]'
            }`}
          >
            🎙️ مذيع الاستوديو المدمج
          </button>
        </div>

        {isClawatar && (
          <div className="flex flex-col gap-2 pt-1 border-t border-[var(--pline)]/70">
            <div className="flex items-center gap-1.5">
              <select
                value={template.clawatarModelId || 'base_female.vrm'}
                onChange={(e) =>
                  patch({
                    presenterEnabled: true,
                    presenterStyle: 'clawatar3d',
                    clawatarModelId: e.target.value,
                  })
                }
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-[11px] font-bold text-[var(--ptxt)]"
              >
                {template.clawatarCustomModelUrl && (
                  <option value="custom">
                    🧬 مخصص: {template.clawatarCustomModelName || 'Custom.vrm'}
                  </option>
                )}
                {CLAWATAR_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.emoji} {m.nameAr} ({m.sizeMB}MB)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => vrmInputRef.current?.click()}
                title="رفع ملف VRM من جهازك"
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] hover:border-[#00B050] text-[11px] font-bold cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#00B050]" />
                <span>.vrm</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[var(--pmuted)]">خلفية الأفاتار</span>
                <select
                  value={template.clawatarBgMode || 'transparent'}
                  onChange={(e) =>
                    patch({ clawatarBgMode: e.target.value as ClawatarBgMode })
                  }
                  className="px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-[11px] font-bold"
                >
                  <option value="transparent">بدون خلفية (شفاف تماماً)</option>
                  <option value="white">خلفية بيضاء نقية</option>
                  <option value="studio">استوديو احترافي</option>
                  <option value="sakura">ساكورا 🌸</option>
                  <option value="cyber">سايبر ⚡</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[var(--pmuted)]">زاوية الكاميرا</span>
                <select
                  value={template.clawatarCameraPreset || 'upperBody'}
                  onChange={(e) =>
                    patch({
                      clawatarCameraPreset: e.target.value as ClawatarCameraPreset,
                    })
                  }
                  className="px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-[11px] font-bold"
                >
                  {CLAWATAR_CAMERA_PRESETS.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.labelAr}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
      </section>

      {/* 2. Motion Mode: Manual Before Start -> Auto With Audio */}
      <section className="p-3 rounded-xl bg-[var(--card)] border border-[var(--pline)] flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-[var(--ptxt)]">
            نظام تشغيل الحركة (يدوي قبل البدء ← تلقائي)
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {(
            [
              {
                id: 'manualThenAuto',
                title: 'يدوي قبل البدء ← تلقائي مع الصوت والمراحل ⚡',
                desc: 'تختار الحالة المبدئية يدوياً الآن، وعند الضغط على تشغيل ينتقل الأفاتار تلقائياً لمزامنة الشفاه والتفكير والإجابة.',
              },
              {
                id: 'autoSmart',
                title: 'تلقائي ذكي بالكامل في كل وقت 🤖',
                desc: 'يتبع مراحل السؤال والصوت تلقائياً حتى أثناء التوقف والتنقل بين الشرائح.',
              },
              {
                id: 'manualLocked',
                title: 'تثبيت الحالة اليدوية المختارة دائماً 📌',
                desc: 'يُبقي الشخصية في الحالة التي اخترتها طوال الفيديو مع استمرار مزامنة الشفاه مع الصوت.',
              },
            ] as { id: AvatarMotionMode; title: string; desc: string }[]
          ).map((m) => {
            const active = motionMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMotionMode(m.id)}
                className={`p-2.5 rounded-lg border text-right cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#00B050]/14 border-[#00B050] text-[var(--ptxt)]'
                    : 'bg-[var(--surface)] border-[var(--pline)] text-[var(--pmuted)] hover:border-[#00B050]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold text-[var(--ptxt)]">{m.title}</span>
                  {active && <CheckCircle2 className="w-3.5 h-3.5 text-[#00B050] shrink-0" />}
                </div>
                <p className="text-[10px] text-[var(--pmuted)] mt-0.5 leading-relaxed">
                  {m.desc}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Manual Initial State Selection (Before Playback) */}
      <section className="p-3 rounded-xl bg-[var(--card)] border border-[#00B050]/40 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-extrabold text-[var(--ptxt)]">
              {motionMode === 'manualLocked'
                ? 'الحالة المثبتة للشخصية:'
                : 'اختر حالة الشخصية يدوياً قبل البدء:'}
            </h3>
            <p className="text-[10px] text-[var(--pmuted)]">
              اضغط على أي حالة لتثبيتها قبل البدء ومعاينتها مباشرة لمدة 2.6 ثانية على المسرح
            </p>
          </div>
          <button
            type="button"
            onClick={() => triggerStatePreview(manualState)}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#00B050] hover:bg-[#00c85b] text-white text-[10px] font-bold cursor-pointer"
          >
            <Play className="w-3 h-3" />
            <span>معاينة</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {CLAWATAR_STATE_PRESETS.map((st) => {
            const meta = STATE_DESCRIPTIONS[st.stateId];
            const selected = manualState === st.stateId && motionMode !== 'autoSmart';
            const isPreviewing = previewingState === st.stateId;
            return (
              <button
                key={st.stateId}
                type="button"
                onClick={() => selectManualState(st.stateId)}
                className={`p-2.5 rounded-xl border text-right cursor-pointer transition-all flex flex-col gap-0.5 ${
                  selected
                    ? 'bg-[#00B050]/18 border-[#00B050] shadow-sm'
                    : 'bg-[var(--surface)] border-[var(--pline)] hover:border-[#00B050]/55'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold text-[var(--ptxt)] flex items-center gap-1.5">
                    <span>{meta.icon}</span>
                    <span>{meta.shortTitle}</span>
                  </span>
                  {isPreviewing && (
                    <span className="w-2 h-2 rounded-full bg-[#00B050] animate-ping shrink-0" />
                  )}
                </div>
                <span className="text-[10px] text-[var(--pmuted)] leading-snug">
                  {meta.hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Automatic Smart Voice, Thinking & Answer Awareness */}
      <section className="p-3 rounded-xl bg-[var(--card)] border border-[var(--pline)] flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Wand2 className="w-4 h-4 text-[#00B050] shrink-0" />
            <div>
              <h3 className="text-xs font-extrabold text-[var(--ptxt)]">
                السلوك التلقائي الذكي (مع الصوت والأسئلة)
              </h3>
              <p className="text-[10px] text-[var(--pmuted)]">
                مزامنة شفاه + وعي التفكير + وعي الإجابة الصحيحة تلقائياً
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={enableAllAutoBehaviors}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-[#00B050]/15 border border-[#00B050]/50 text-[#00B050] dark:text-[#6ee7b7] text-[10px] font-extrabold cursor-pointer hover:bg-[#00B050]/25"
          >
            <RotateCcw className="w-3 h-3" />
            <span>تفعيل الكل</span>
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {AUTO_BEHAVIOR_ITEMS.map((item) => {
            const checked = behaviors[item.key] !== false;
            return (
              <label
                key={item.key}
                className={`flex items-start justify-between gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                  checked
                    ? 'bg-[#00B050]/8 border-[#00B050]/45'
                    : 'bg-[var(--surface)] border-[var(--pline)] opacity-75'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-sm leading-none mt-0.5">{item.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-[var(--ptxt)]">{item.title}</div>
                    <div className="text-[10px] text-[var(--pmuted)] leading-snug">
                      {item.desc}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleBehavior(item.key)}
                  className="w-4 h-4 mt-0.5 accent-[#00B050] rounded cursor-pointer shrink-0"
                />
              </label>
            );
          })}
        </div>

        {/* Lip Sync Driver & Intensity Fine Controls */}
        <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[var(--ptxt)]">
            <Volume2 className="w-3.5 h-3.5 text-[#00B050]" />
            <span>إعدادات مزامنة الشفاه والحيوية</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { id: 'audioOnly', label: 'مع الصوت الحقيقي فقط 🎙️' },
                { id: 'audioAndReading', label: 'مع الصوت + تلقائي عند القراءة' },
              ] as { id: PresenterLipSyncMode; label: string }[]
            ).map((lm) => (
              <button
                key={lm.id}
                type="button"
                onClick={() =>
                  patch({
                    presenterLipSyncMode: lm.id,
                    presenterContinuousTalk: lm.id === 'audioAndReading',
                  })
                }
                className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                  activeLipMode === lm.id
                    ? 'bg-[#00B050]/18 border-[#00B050] text-[#00B050] dark:text-[#6ee7b7]'
                    : 'bg-[var(--card)] border-[var(--pline)] text-[var(--ptxt)]'
                }`}
              >
                {lm.label}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-[var(--ptxt)]">
              <span>حجم حركة الشفاه والفم</span>
              <span className="font-mono-nums">
                {Math.round(template.presenterTalkIntensity ?? 70)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={template.presenterTalkIntensity ?? 70}
              onChange={(e) =>
                patch({ presenterTalkIntensity: parseFloat(e.target.value) }, false)
              }
            />
          </label>

          <label className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-[var(--ptxt)]">
              <span>تفاعل الرأس والتعابير</span>
              <span className="font-mono-nums">
                {Math.round(template.presenterExpressiveness ?? 100)}%
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={150}
              step={5}
              value={template.presenterExpressiveness ?? 100}
              onChange={(e) =>
                patch({ presenterExpressiveness: parseFloat(e.target.value) }, false)
              }
            />
          </label>
        </div>
      </section>

      {/* 5. Advanced: Expressions, Zoom/Yaw & 132 VRMA Clips per Phase */}
      {isClawatar && (
        <details className="p-3 rounded-xl bg-[var(--card)] border border-[var(--pline)]">
          <summary className="text-xs font-extrabold text-[var(--ptxt)] cursor-pointer select-none flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00B050]" />
            <span>خيارات متقدمة (تعابير الوجه + مكتبة 132 حركة VRMA لكل مرحلة)</span>
          </summary>

          <div className="flex flex-col gap-2.5 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[var(--pmuted)]">تعبير الوجه العام</span>
                <select
                  value={template.clawatarExpression || 'auto'}
                  onChange={(e) =>
                    patch({ clawatarExpression: e.target.value as ClawatarExpression })
                  }
                  className="px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-[11px] font-bold"
                >
                  <option value="auto">🤖 تلقائي حسب المرحلة</option>
                  {CLAWATAR_EXPRESSIONS.map((exp) => (
                    <option key={exp.id} value={exp.id}>
                      {exp.emoji} {exp.labelAr}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[var(--pmuted)]">تقريب الكاميرا</span>
                <input
                  type="range"
                  min={0.7}
                  max={1.55}
                  step={0.05}
                  value={template.clawatarScaleZoom ?? 1}
                  onChange={(e) => patch({ clawatarScaleZoom: Number(e.target.value) })}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: 'intro', label: 'المقدمة (Hook)' },
                  { key: 'readingQuestion', label: 'قراءة السؤال' },
                  { key: 'readingOptions', label: 'قراءة الخيارات' },
                  { key: 'thinking', label: 'التفكير' },
                  { key: 'suspense', label: 'التشويق' },
                  { key: 'reveal', label: 'كشف الإجابة' },
                  { key: 'outro', label: 'الخاتمة' },
                ] as const
              ).map((ph) => (
                <label
                  key={ph.key}
                  className={`flex flex-col gap-1 ${ph.key === 'outro' ? 'col-span-2' : ''}`}
                >
                  <span className="text-[10px] text-[var(--pmuted)]">{ph.label}</span>
                  <select
                    value={template.clawatarPhaseActions?.[ph.key] || 'auto'}
                    onChange={(e) =>
                      patch({
                        clawatarPhaseActions: {
                          ...(template.clawatarPhaseActions ?? {}),
                          [ph.key]: e.target.value,
                        },
                      })
                    }
                    className="px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-[10px] font-bold"
                  >
                    <option value="auto">تلقائي ذكي حسب المرحلة</option>
                    {clawatarAnimations.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.labelAr || a.id} ({a.id})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
};
