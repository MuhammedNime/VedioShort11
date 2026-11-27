import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  Eye,
  Factory,
  FolderSync,
  ImagePlus,
  Layers,
  Palette,
  RefreshCw,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import {
  CustomTemplatePreset,
  deleteCustomPresetAsync,
  loadCustomPresets,
  loadCustomPresetsAsync,
  saveCustomPresetAsync,
  updateCustomPresetAsync,
} from '../storage/customPresets';
import {
  applyThemeToLibraryProjectsBatch,
  readFileAsDataUrl,
} from '../storage/projectStore';
import {
  BackgroundMotion,
  BoxBorderStyle,
  BoxShapeStyle,
  DEFAULT_TEMPLATE,
  OptionLayoutMode,
  PRESET_BACKDROPS,
  PresetId,
  RevealStyle,
  SlideTransitionStyle,
  TemplateSettings,
  TimerStyle,
  applyCustomTemplateSettings,
  applyStudioThemePreset,
  resetThemeToPresetOriginal,
} from '../types/quiz';
import {
  THEME_CATEGORIES,
  ThemeCategoryId,
  ThemeLibraryEntry,
  getThemeLibraryEntries,
} from '../types/themesCatalog';

export type ThemesLibraryMode = 'studio' | 'factory';

interface ThemesLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: ThemesLibraryMode;
  currentTemplate: TemplateSettings;
  activeProjectId?: string;
  seriesLabel?: string;
  onApplyToCurrent?: (nextTemplate: TemplateSettings, notice?: string) => void;
  onPreviewOnStage?: (previewTemplate: TemplateSettings | null) => void;
  onApplyForFactory?: (
    selectedTemplate: TemplateSettings,
    meta: { label: string; customPresetId?: string; presetId: PresetId }
  ) => void;
}

type LibraryViewTab = 'library' | 'saved' | 'builder';
type PreviewPhase = 'question' | 'reveal';

const BOX_STYLES: { id: BoxShapeStyle; label: string }[] = [
  { id: 'flat', label: 'قياسي' },
  { id: 'bevel3d', label: 'بارز 3D' },
  { id: 'glass', label: 'زجاجي' },
  { id: 'neon', label: 'نيون' },
  { id: 'millionaireHex', label: 'سداسي TV' },
  { id: 'chamfer', label: 'مشطوف' },
  { id: 'layeredCard', label: 'بطاقة طبقية' },
  { id: 'broadcastBar', label: 'شريط بث' },
  { id: 'ticket', label: 'تذكرة/ورق' },
  { id: 'minimalOutline', label: 'بسيط Minimal' },
  { id: 'inset', label: 'غائر كلاسيكي' },
];

const BORDER_STYLES: { id: BoxBorderStyle; label: string }[] = [
  { id: 'solid', label: 'صلب' },
  { id: 'double', label: 'مزدوج' },
  { id: 'gradientGold', label: 'ذهبي متدرج' },
  { id: 'gradientNeon', label: 'نيون متدرج' },
  { id: 'metallicSilver', label: 'معدني فضي' },
  { id: 'gradientSunset', label: 'غروب متدرج' },
  { id: 'dashedGold', label: 'متقطع Vintage' },
  { id: 'cornerBrackets', label: 'زوايا HUD' },
];

const TIMER_STYLES: { id: TimerStyle; label: string }[] = [
  { id: 'circle', label: 'دائري' },
  { id: 'neonRing', label: 'حلقة نيون' },
  { id: 'hexBadge', label: 'سداسي' },
  { id: 'pillCountdown', label: 'كبسولة TV' },
  { id: 'channelBox', label: 'مربع القناة' },
  { id: 'bar', label: 'شريط تقدم' },
];

const TRANSITIONS: { id: SlideTransitionStyle; label: string }[] = [
  { id: 'fade', label: 'تلاشي ناعم' },
  { id: 'zoomFade', label: 'زوم وتلاشي' },
  { id: 'wipeGold', label: 'مسح ذهبي' },
  { id: 'slideLeft', label: 'انزلاق يسار' },
  { id: 'slideRight', label: 'انزلاق يمين' },
  { id: 'none', label: 'بدون انتقال' },
];

interface MiniThemePreviewProps {
  template: TemplateSettings;
  phase?: PreviewPhase;
  compact?: boolean;
  showHandle?: boolean;
}

export const MiniThemeStagePreview: React.FC<MiniThemePreviewProps> = ({
  template,
  phase = 'reveal',
  compact = false,
  showHandle = true,
}) => {
  const backdrop = PRESET_BACKDROPS.find((p) => p.id === template.presetId);
  const bgStyle: React.CSSProperties =
    template.backgroundType === 'color'
      ? { backgroundColor: template.solidBgColor || '#0c0c0c' }
      : template.backgroundType === 'custom' && template.customBgDataUrl
        ? {
            backgroundImage: `url(${template.customBgDataUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : backdrop?.src
          ? {
              backgroundImage: `url(${backdrop.src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : backdrop?.gradientInner && backdrop?.gradientOuter
            ? {
                background: `radial-gradient(circle at 50% 34%, ${backdrop.gradientInner}, ${backdrop.gradientOuter} 78%)`,
              }
            : { backgroundColor: template.solidBgColor || '#0f172a' };

  const isWide = template.aspectRatio === '16:9';
  const fontFamilyCSS =
    template.fontFamily === 'Amiri'
      ? "'Amiri', serif"
      : template.fontFamily === 'Tajawal'
        ? "'Tajawal', sans-serif"
        : "'Cairo', sans-serif";

  const qRadius = Math.min(14, Math.max(4, Math.round((template.questionBorderRadius || 24) * 0.25)));
  const oRadius = Math.min(12, Math.max(4, Math.round((template.optionBorderRadius || 20) * 0.25)));

  const timerShapeClass =
    template.timerStyle === 'circle' || template.timerStyle === 'neonRing'
      ? 'rounded-full w-6 h-6'
      : template.timerStyle === 'pillCountdown'
        ? 'rounded-full px-2.5 py-0.5'
        : 'rounded-md px-2 py-0.5';

  const expBg = template.explanationBgColor?.trim() || template.correctColor || '#00B050';
  const expText = template.explanationTextColor?.trim() || '#FFFFFF';

  return (
    <div
      className={`relative w-full overflow-hidden select-none ${
        isWide ? 'aspect-video' : 'aspect-[9/16]'
      }`}
      style={{ ...bgStyle, fontFamily: fontFamilyCSS }}
      dir="rtl"
    >
      {/* Dim overlay */}
      {template.bgDimOpacity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: `rgba(0,0,0,${Math.min(0.75, template.bgDimOpacity)})` }}
        />
      )}

      {/* Subtle border decor preview */}
      {(template.borderStyle === 'double' ||
        template.borderStyle === 'gradientGold' ||
        template.borderStyle === 'dashedGold' ||
        template.borderStyle === 'cornerBrackets') && (
        <div
          className="absolute inset-1.5 pointer-events-none rounded-md"
          style={{
            border:
              template.borderStyle === 'dashedGold'
                ? '1px dashed rgba(217,119,6,0.45)'
                : template.borderStyle === 'gradientGold'
                  ? '1px solid rgba(212,175,55,0.4)'
                  : '1px solid rgba(255,255,255,0.22)',
          }}
        />
      )}

      {/* Stage content */}
      <div
        className={`relative z-10 h-full w-full flex flex-col justify-between ${
          compact ? 'p-2 gap-1' : 'p-3.5 gap-2'
        }`}
      >
        {/* Top bar: handle + badge */}
        <div className="flex items-center justify-between gap-1 min-h-[14px]">
          {showHandle && (template.brandHandleText || !compact) ? (
            <span
              className={`${compact ? 'text-[7px]' : 'text-[10px]'} font-bold truncate opacity-85`}
              style={{ color: template.questionTextColor }}
            >
              {template.brandHandleText || '@Channel'}
            </span>
          ) : (
            <span />
          )}
          <span
            className={`${compact ? 'text-[7px] px-1.5 py-0.5' : 'text-[10px] px-2.5 py-0.5'} font-extrabold rounded-full truncate`}
            style={{
              backgroundColor: template.badgeBgColor || '#d4a73a',
              color: template.badgeTextColor || '#000000',
            }}
          >
            {compact ? '1/3' : 'السؤال 1 / 3'}
          </span>
        </div>

        {/* Question card */}
        <div
          className={`flex items-center justify-center text-center font-extrabold leading-snug ${
            compact ? 'px-2 py-2 text-[8.5px]' : 'px-3 py-3.5 text-xs'
          }`}
          style={{
            backgroundColor: template.questionBoxColor,
            color: template.questionTextColor,
            borderColor: template.questionBorderColor,
            borderWidth: compact ? 1.5 : 2,
            borderStyle: 'solid',
            borderRadius: qRadius,
            opacity: template.questionBoxOpacity ?? 1,
            boxShadow:
              (template.glowIntensity ?? 0) > 0.3
                ? `0 0 12px ${template.questionBorderColor}55`
                : '0 4px 10px rgba(0,0,0,0.28)',
          }}
        >
          {compact ? 'ما هو الكوكب الأقرب للشمس؟' : 'ما هو أقرب كوكب إلى الشمس في مجموعتنا؟'}
        </div>

        {/* Timer */}
        <div className="flex justify-center">
          <div
            className={`flex items-center justify-center font-extrabold tabular-nums border ${timerShapeClass} ${
              compact ? 'text-[8px]' : 'text-[11px] min-w-[30px]'
            }`}
            style={{
              backgroundColor: template.timerBgColor,
              color: template.timerColor,
              borderColor:
                template.timerStyle === 'neonRing'
                  ? template.timerColor
                  : template.questionBorderColor,
            }}
          >
            {phase === 'reveal' ? '0' : '5'}
          </div>
        </div>

        {/* Options 2x2 */}
        <div className={`grid grid-cols-2 ${compact ? 'gap-1' : 'gap-1.5'}`}>
          {[
            { label: 'أ', text: 'الزهرة', state: phase === 'reveal' ? 'wrong' : 'idle' },
            { label: 'ب', text: 'عطارد', state: phase === 'reveal' ? 'correct' : 'idle' },
            { label: 'ج', text: 'المريخ', state: 'idle' },
            { label: 'د', text: 'زحل', state: 'idle' },
          ].map((opt, idx) => {
            const isCorrect = opt.state === 'correct';
            const isWrong =
              opt.state === 'wrong' && template.revealStyle === 'redWrongGreenCorrect';
            const bg = isCorrect
              ? template.correctColor
              : isWrong
                ? template.wrongColor
                : template.optionBoxColor;
            const fg = isCorrect || isWrong ? '#FFFFFF' : template.optionTextColor;
            const bCol = isCorrect
              ? template.correctColor
              : isWrong
                ? template.wrongColor
                : template.optionBorderColor;
            return (
              <div
                key={idx}
                className={`flex items-center justify-center gap-1 text-center font-bold border ${
                  compact ? 'px-1 py-1 text-[7.5px]' : 'px-2 py-2 text-[10.5px]'
                }`}
                style={{
                  backgroundColor: bg,
                  color: fg,
                  borderColor: bCol,
                  borderRadius: oRadius,
                  opacity:
                    phase === 'reveal' && template.revealStyle === 'dimOthers' && !isCorrect
                      ? 0.45
                      : template.optionBoxOpacity ?? 1,
                }}
              >
                {template.optionLabelStyle !== 'none' && (
                  <span
                    className={`rounded font-extrabold shrink-0 ${
                      compact ? 'px-1 text-[6.5px]' : 'px-1.5 text-[9px]'
                    }`}
                    style={{
                      backgroundColor: isCorrect
                        ? 'rgba(255,255,255,0.22)'
                        : template.optionLabelBgColor,
                      color: isCorrect ? '#FFFFFF' : template.optionLabelTextColor,
                    }}
                  >
                    {opt.label}
                  </span>
                )}
                <span className="truncate">{opt.text}</span>
              </div>
            );
          })}
        </div>

        {/* Explanation card preview when reveal phase or enabled */}
        {(phase === 'reveal' || template.showExplanationOnReveal) && (
          <div
            className={`text-center font-bold rounded-md truncate ${
              compact ? 'px-1.5 py-0.5 text-[7px]' : 'px-2.5 py-1 text-[9.5px]'
            }`}
            style={{
              backgroundColor: expBg,
              color: expText,
            }}
          >
            {compact ? 'المعلومة: عطارد أقرب كوكب' : 'الدليل: عطارد يبعد 58 مليون كم فقط'}
          </div>
        )}
      </div>
    </div>
  );
};

export const ThemesLibraryModal: React.FC<ThemesLibraryModalProps> = ({
  isOpen,
  onClose,
  mode = 'studio',
  currentTemplate,
  activeProjectId,
  seriesLabel,
  onApplyToCurrent,
  onPreviewOnStage,
  onApplyForFactory,
}) => {
  const [viewTab, setViewTab] = useState<LibraryViewTab>('library');
  const [activeCategory, setActiveCategory] = useState<ThemeCategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftTemplate, setDraftTemplate] = useState<TemplateSettings>(() => ({
    ...currentTemplate,
  }));
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>('reveal');
  const [preserveBrandIdentity, setPreserveBrandIdentity] = useState(true);
  const [preserveLayoutPositions, setPreserveLayoutPositions] = useState(true);
  const [isPreviewingOnStage, setIsPreviewingOnStage] = useState(false);

  const [savedCustomThemes, setSavedCustomThemes] = useState<CustomTemplatePreset[]>(() =>
    loadCustomPresets()
  );
  const [customThemeName, setCustomThemeName] = useState('');
  const [includeMediaOnSave, setIncludeMediaOnSave] = useState(true);
  const [batchBusy, setBatchBusy] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const bgUploadRef = useRef<HTMLInputElement | null>(null);
  const logoUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraftTemplate({ ...currentTemplate });
    setSelectedCustomId(null);
    setStatusNotice(null);
    setIsPreviewingOnStage(false);
    void loadCustomPresetsAsync().then(setSavedCustomThemes).catch(() => {});
  }, [isOpen, currentTemplate]);

  useEffect(() => {
    const onRefresh = () => {
      void loadCustomPresetsAsync().then(setSavedCustomThemes).catch(() => {});
    };
    window.addEventListener('shorts-studio-presets-updated', onRefresh);
    return () => window.removeEventListener('shorts-studio-presets-updated', onRefresh);
  }, []);

  const allEntries = useMemo(
    () => getThemeLibraryEntries(currentTemplate.aspectRatio || '9:16'),
    [currentTemplate.aspectRatio]
  );

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEntries.filter((entry) => {
      if (activeCategory !== 'all' && entry.meta.category !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return (
        entry.meta.name.toLowerCase().includes(q) ||
        entry.meta.subtitle.toLowerCase().includes(q) ||
        entry.meta.decorSummary.toLowerCase().includes(q) ||
        entry.id.toLowerCase().includes(q)
      );
    });
  }, [allEntries, activeCategory, searchQuery]);

  const selectedEntry: ThemeLibraryEntry = useMemo(() => {
    return allEntries.find((e) => e.id === draftTemplate.presetId) ?? allEntries[0];
  }, [allEntries, draftTemplate.presetId]);

  if (!isOpen) return null;

  const updateDraftAndMaybeStagePreview = (next: TemplateSettings) => {
    setDraftTemplate(next);
    if (isPreviewingOnStage && onPreviewOnStage) {
      onPreviewOnStage(next);
    }
  };

  const handleSelectBuiltInEntry = (entry: ThemeLibraryEntry) => {
    setSelectedCustomId(null);
    const base = preserveBrandIdentity
      ? applyStudioThemePreset(currentTemplate, entry.id)
      : applyStudioThemePreset({ ...DEFAULT_TEMPLATE, aspectRatio: currentTemplate.aspectRatio }, entry.id);
    if (preserveLayoutPositions) {
      base.questionX = currentTemplate.questionX;
      base.questionY = currentTemplate.questionY;
      base.questionWidth = currentTemplate.questionWidth;
      base.optionsX = currentTemplate.optionsX;
      base.optionsStartY = currentTemplate.optionsStartY;
      base.optionsWidth = currentTemplate.optionsWidth;
      base.timerX = currentTemplate.timerX;
      base.timerY = currentTemplate.timerY;
      base.badgeX = currentTemplate.badgeX;
      base.badgeY = currentTemplate.badgeY;
    }
    updateDraftAndMaybeStagePreview(base);
    setStatusNotice(null);
  };

  const handleSelectSavedCustom = (cp: CustomTemplatePreset) => {
    setSelectedCustomId(cp.id);
    const next = applyCustomTemplateSettings(currentTemplate, cp.template, {
      preserveChannelIdentity: preserveBrandIdentity,
      preserveLayoutPositions,
    });
    updateDraftAndMaybeStagePreview(next);
    setStatusNotice(null);
  };

  const patchDraft = (partial: Partial<TemplateSettings>) => {
    updateDraftAndMaybeStagePreview({
      ...draftTemplate,
      ...partial,
    });
  };

  const handleResetToOriginal = () => {
    const clean = resetThemeToPresetOriginal(draftTemplate, preserveBrandIdentity);
    setSelectedCustomId(null);
    updateDraftAndMaybeStagePreview(clean);
    setStatusNotice({ type: 'ok', text: 'تمت إعادة الثيم إلى إعداداته الأصلية بالكامل.' });
  };

  const handleToggleStagePreview = () => {
    if (!onPreviewOnStage) return;
    if (isPreviewingOnStage) {
      onPreviewOnStage(null);
      setIsPreviewingOnStage(false);
    } else {
      onPreviewOnStage(draftTemplate);
      setIsPreviewingOnStage(true);
    }
  };

  const handleCloseModal = () => {
    if (isPreviewingOnStage && onPreviewOnStage) {
      onPreviewOnStage(null);
    }
    onClose();
  };

  const handleSaveAsCustomTheme = async () => {
    const name =
      customThemeName.trim() ||
      `ثيم ${selectedEntry.meta.name} (${savedCustomThemes.length + 1})`;
    const res = await saveCustomPresetAsync(name, draftTemplate, {
      includeBrandAndBg: includeMediaOnSave,
    });
    setSavedCustomThemes(res.list);
    setSelectedCustomId(res.created.id);
    setCustomThemeName('');
    window.dispatchEvent(new Event('shorts-studio-presets-updated'));
    setStatusNotice({ type: 'ok', text: `تم حفظ الثيم المخصص «${res.created.name}» بنجاح!` });
  };

  const handleUpdateExistingCustomTheme = async () => {
    if (!selectedCustomId) return;
    const list = await updateCustomPresetAsync(selectedCustomId, draftTemplate, {
      includeBrandAndBg: includeMediaOnSave,
    });
    setSavedCustomThemes(list);
    window.dispatchEvent(new Event('shorts-studio-presets-updated'));
    setStatusNotice({ type: 'ok', text: 'تم تحديث الثيم المخصص المحفوظ بالتعديلات الجديدة.' });
  };

  const handleDeleteCustom = async (id: string) => {
    const list = await deleteCustomPresetAsync(id);
    setSavedCustomThemes(list);
    if (selectedCustomId === id) setSelectedCustomId(null);
    window.dispatchEvent(new Event('shorts-studio-presets-updated'));
  };

  const handleApplyBatchScope = async (scope: 'factoryOnly' | 'allProjects' | 'prefix') => {
    if (batchBusy) return;
    setBatchBusy(true);
    setStatusNotice(null);
    try {
      const res = await applyThemeToLibraryProjectsBatch(draftTemplate, scope, {
        preserveChannelIdentity: preserveBrandIdentity,
        preserveLayoutPositions,
        seriesPrefix: seriesLabel,
        activeProjectId,
      });
      if (res.updatedCount === 0) {
        setStatusNotice({
          type: 'err',
          text:
            scope === 'factoryOnly'
              ? 'لا توجد مشاريع مولّدة من مصنع الشورتس بعد في المكتبة. يمكنك توليد حلقات من المصنع أولاً أو تطبيق الثيم على السلسلة.'
              : 'لم يتم العثور على مشاريع مطابقة في المكتبة.',
        });
      } else {
        setStatusNotice({
          type: 'ok',
          text: `تم تطبيق الثيم بنجاح على ${res.updatedCount} مشروعاً في ${
            scope === 'factoryOnly'
              ? 'مصنع الشورتس'
              : scope === 'prefix'
                ? `سلسلة «${seriesLabel}»`
                : 'مكتبة المشاريع بالكامل'
          }!`,
        });
      }
    } catch {
      setStatusNotice({ type: 'err', text: 'تعذر تطبيق الثيم على المشاريع المتعددة.' });
    } finally {
      setBatchBusy(false);
    }
  };

  const handleUploadCustomBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      patchDraft({
        backgroundType: 'custom',
        customBgDataUrl: dataUrl,
        customBgName: file.name,
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleUploadBrandLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      patchDraft({
        brandLogoDataUrl: dataUrl,
        brandLogoName: file.name,
      });
    } finally {
      e.target.value = '';
    }
  };

  const selectedTitle =
    selectedCustomId && savedCustomThemes.find((c) => c.id === selectedCustomId)?.name
      ? savedCustomThemes.find((c) => c.id === selectedCustomId)!.name
      : selectedEntry.meta.name;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/82 backdrop-blur-sm p-2 sm:p-4"
      dir="rtl"
    >
      <div className="w-full max-w-6xl h-[92dvh] rounded-2xl bg-[var(--panel)] border border-[var(--pline)] shadow-2xl overflow-hidden text-[var(--ptxt)] flex flex-col">
        {/* Clean Header Bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--pline)] bg-[var(--surface)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Palette className="w-5 h-5 text-[#00B050] shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold truncate">
                مكتبة الثيمات البصرية ومنشئ الثيم المخصص
              </h2>
              <p className="text-[11px] text-[var(--pmuted)] truncate">
                {allEntries.length} ثيماً احترافياً · {savedCustomThemes.length} ثيم مخصص محفوظ · توافق كامل مع 9:16 و 16:9
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Segmented Mode Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--panel)] border border-[var(--pline)]">
              {(
                [
                  { id: 'library', label: 'المكتبة الجاهزة', icon: Layers },
                  { id: 'saved', label: `ثيماتي (${savedCustomThemes.length})`, icon: Sparkles },
                  { id: 'builder', label: 'تخصيص وإنشاء ثيم', icon: Sliders },
                ] as { id: LibraryViewTab; label: string; icon: React.ElementType }[]
              ).map((tab) => {
                const Icon = tab.icon;
                const active = viewTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#00B050] text-white'
                        : 'text-[var(--pmuted)] hover:text-[var(--ptxt)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleCloseModal}
              aria-label="إغلاق"
              className="p-2 rounded-lg bg-[var(--panel)] border border-[var(--pline)] text-[var(--pmuted)] hover:text-rose-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main 2-Column Body: Catalog/Builder + Live Preview & Scopes */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_350px]">
          {/* Left Workspace Column */}
          <div className="flex flex-col min-h-0 border-b lg:border-b-0 lg:border-l border-[var(--pline)] overflow-hidden">
            {viewTab === 'library' && (
              <>
                {/* Search + Category Filter Strip */}
                <div className="p-3 border-b border-[var(--pline)] bg-[var(--surface)]/60 flex flex-col gap-2.5 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--pmuted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث بالاسم أو الأسلوب (سينمائي، نيون، إسلامي، علمي، ألعاب، بسيط...)"
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-[var(--panel)] border border-[var(--pline)] text-xs text-[var(--ptxt)] placeholder:text-[var(--pmuted)] focus:border-[#00B050] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {THEME_CATEGORIES.map((cat) => {
                      const active = activeCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setActiveCategory(cat.id)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#00B050] border-[#00B050] text-white'
                              : 'bg-[var(--panel)] border-[var(--pline)] text-[var(--pmuted)] hover:text-[var(--ptxt)] hover:border-[var(--gold)]'
                          }`}
                        >
                          <span>{cat.emoji}</span>
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Themes Grid with Live Mini Card Previews */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3.5">
                  {filteredEntries.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center gap-2 text-xs text-[var(--pmuted)] border border-dashed border-[var(--pline)] rounded-xl">
                      <span>لا توجد ثيمات مطابقة للبحث الحالي.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCategory('all');
                          setSearchQuery('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#00B050] text-white font-bold cursor-pointer"
                      >
                        عرض جميع الثيمات
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {filteredEntries.map((entry) => {
                        const isSelected =
                          !selectedCustomId && draftTemplate.presetId === entry.id;
                        const catMeta = THEME_CATEGORIES.find(
                          (c) => c.id === entry.meta.category
                        );
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => handleSelectBuiltInEntry(entry)}
                            className={`group flex flex-col rounded-xl overflow-hidden border text-right transition-all cursor-pointer bg-[var(--surface)] ${
                              isSelected
                                ? 'border-[#00B050] ring-2 ring-[#00B050]/45'
                                : 'border-[var(--pline)] hover:border-[var(--gold)]'
                            }`}
                          >
                            <div className="relative w-full overflow-hidden">
                              <MiniThemeStagePreview
                                template={entry.previewTemplate}
                                phase={previewPhase}
                                compact
                                showHandle={false}
                              />
                              {isSelected && (
                                <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-[#00B050] text-white flex items-center justify-center shadow">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            <div className="p-2 flex flex-col gap-0.5">
                              <div className="text-xs font-extrabold text-[var(--ptxt)] truncate">
                                {entry.meta.emoji} {entry.meta.name}
                              </div>
                              <div className="text-[10px] text-[var(--pmuted)] truncate">
                                {catMeta?.label || 'عام'} · {entry.previewTemplate.fontFamily}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {viewTab === 'saved' && (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold">ثيماتك المخصصة المحفوظة</h3>
                    <p className="text-[11px] text-[var(--pmuted)]">
                      يمكنك تطبيق أي ثيم مخصص هنا على الفيديو الحالي أو حلقات مصنع الشورتس.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewTab('builder')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00B050] text-white text-xs font-bold cursor-pointer shrink-0"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>إنشاء ثيم جديد</span>
                  </button>
                </div>

                {savedCustomThemes.length === 0 ? (
                  <div className="py-14 flex flex-col items-center justify-center gap-3 text-center border border-dashed border-[var(--pline)] rounded-xl">
                    <Sparkles className="w-8 h-8 text-[var(--gold)] opacity-80" />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold">لا توجد ثيمات مخصصة محفوظة بعد</span>
                      <span className="text-[11px] text-[var(--pmuted)]">
                        اختر ثيماً جاهزاً ثم عدّل ألوانه أو افتح «تخصيص وإنشاء ثيم» لحفظه هنا دائماً.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewTab('builder')}
                      className="px-4 py-2 rounded-xl bg-[#00B050] text-white text-xs font-bold cursor-pointer"
                    >
                      ابدأ تصميم ثيم مخصص
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {savedCustomThemes.map((cp) => {
                      const previewTpl: TemplateSettings = {
                        ...DEFAULT_TEMPLATE,
                        ...cp.template,
                      };
                      const isSelected = selectedCustomId === cp.id;
                      return (
                        <div
                          key={cp.id}
                          className={`flex flex-col rounded-xl overflow-hidden border bg-[var(--surface)] transition-all ${
                            isSelected
                              ? 'border-[#00B050] ring-2 ring-[#00B050]/45'
                              : 'border-[var(--pline)] hover:border-[var(--gold)]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectSavedCustom(cp)}
                            className="relative w-full text-right cursor-pointer"
                          >
                            <MiniThemeStagePreview
                              template={previewTpl}
                              phase={previewPhase}
                              compact
                            />
                            {isSelected && (
                              <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-[#00B050] text-white flex items-center justify-center shadow">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                          </button>
                          <div className="p-2 flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => handleSelectSavedCustom(cp)}
                              className="min-w-0 flex-1 text-right cursor-pointer"
                            >
                              <div className="text-xs font-extrabold truncate">{cp.name}</div>
                              <div className="text-[10px] text-[var(--pmuted)] truncate">
                                {previewTpl.fontFamily} · {previewTpl.boxStyle || 'flat'}
                              </div>
                            </button>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectSavedCustom(cp);
                                  setViewTab('builder');
                                }}
                                title="تعديل في المنشئ"
                                className="p-1.5 rounded-md text-[var(--pmuted)] hover:text-[#00B050] cursor-pointer"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteCustom(cp.id)}
                                title="حذف الثيم المخصص"
                                className="p-1.5 rounded-md text-[var(--pmuted)] hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {viewTab === 'builder' && (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
                {/* 1. Background & Atmosphere */}
                <section className="flex flex-col gap-2.5 pb-3 border-b border-[var(--pline)]">
                  <h3 className="text-xs font-extrabold text-[var(--gold)]">
                    1. الخلفية والأجواء البصرية
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--pmuted)]">خلفية أساس من المكتبة</span>
                      <select
                        value={draftTemplate.presetId}
                        onChange={(e) => {
                          const pid = e.target.value as PresetId;
                          const matched = allEntries.find((x) => x.id === pid);
                          if (matched) handleSelectBuiltInEntry(matched);
                        }}
                        className="px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs text-[var(--ptxt)]"
                      >
                        {PRESET_BACKDROPS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--pmuted)]">حركة الخلفية</span>
                      <select
                        value={draftTemplate.bgMotion || 'none'}
                        onChange={(e) => patchDraft({ bgMotion: e.target.value as BackgroundMotion })}
                        className="px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs text-[var(--ptxt)]"
                      >
                        <option value="none">ثابت</option>
                        <option value="slowZoom">زوم سينمائي بطيء</option>
                        <option value="particles">جزيئات ضوئية</option>
                        <option value="zoomAndParticles">زوم + جزيئات معاً</option>
                      </select>
                    </label>

                    <div className="flex items-end gap-2">
                      <input
                        ref={bgUploadRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUploadCustomBg}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => bgUploadRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] hover:border-[#00B050] text-xs font-bold cursor-pointer"
                      >
                        <ImagePlus className="w-3.5 h-3.5 text-[#00B050]" />
                        <span>رفع خلفية</span>
                      </button>
                      <input
                        type="color"
                        value={draftTemplate.solidBgColor}
                        onChange={(e) =>
                          patchDraft({ backgroundType: 'color', solidBgColor: e.target.value })
                        }
                        title="لون خلفية ثابت"
                        className="w-9 h-9 rounded-lg border border-[var(--pline)] bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                </section>

                {/* 2. Colors Palette */}
                <section className="flex flex-col gap-2.5 pb-3 border-b border-[var(--pline)]">
                  <h3 className="text-xs font-extrabold text-[var(--gold)]">
                    2. ألوان البطاقات والصح والخطأ وبطاقة الدليل
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    {(
                      [
                        { key: 'questionBoxColor', label: 'خلفية السؤال' },
                        { key: 'questionTextColor', label: 'نص السؤال' },
                        { key: 'questionBorderColor', label: 'إطار السؤال' },
                        { key: 'optionBoxColor', label: 'خلفية الخيار' },
                        { key: 'optionTextColor', label: 'نص الخيار' },
                        { key: 'optionBorderColor', label: 'إطار الخيار' },
                        { key: 'optionLabelBgColor', label: 'شارة الخيار' },
                        { key: 'correctColor', label: 'لون الإجابة الصح' },
                        { key: 'wrongColor', label: 'لون الإجابة الخطأ' },
                        { key: 'timerBgColor', label: 'خلفية العداد' },
                        { key: 'timerColor', label: 'رقم العداد' },
                        { key: 'explanationBgColor', label: 'خلفية الدليل/التوضيح' },
                        { key: 'explanationTextColor', label: 'نص الدليل' },
                        { key: 'badgeBgColor', label: 'خلفية الشارة' },
                      ] as { key: keyof TemplateSettings; label: string }[]
                    ).map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)]"
                      >
                        <span className="truncate font-semibold">{item.label}</span>
                        <input
                          type="color"
                          value={
                            (draftTemplate[item.key] as string) ||
                            (item.key === 'explanationBgColor'
                              ? draftTemplate.correctColor
                              : '#ffffff')
                          }
                          onChange={(e) => patchDraft({ [item.key]: e.target.value })}
                          className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0"
                        />
                      </label>
                    ))}
                  </div>
                </section>

                {/* 3. Typography, Frames, Shadows & Transitions */}
                <section className="flex flex-col gap-2.5 pb-3 border-b border-[var(--pline)]">
                  <h3 className="text-xs font-extrabold text-[var(--gold)]">
                    3. الخطوط والإطارات والظلال والانتقالات
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--pmuted)]">نوع الخط</span>
                      <select
                        value={draftTemplate.fontFamily}
                        onChange={(e) =>
                          patchDraft({ fontFamily: e.target.value as TemplateSettings['fontFamily'] })
                        }
                        className="px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs"
                      >
                        <option value="Cairo">القاهرة (Cairo)</option>
                        <option value="Tajawal">تجوال (Tajawal)</option>
                        <option value="Amiri">أميري (Amiri)</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--pmuted)]">شكل البطاقات</span>
                      <select
                        value={draftTemplate.boxStyle || 'flat'}
                        onChange={(e) => patchDraft({ boxStyle: e.target.value as BoxShapeStyle })}
                        className="px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs"
                      >
                        {BOX_STYLES.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--pmuted)]">نمط الإطار</span>
                      <select
                        value={draftTemplate.borderStyle || 'solid'}
                        onChange={(e) =>
                          patchDraft({ borderStyle: e.target.value as BoxBorderStyle })
                        }
                        className="px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs"
                      >
                        {BORDER_STYLES.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--pmuted)]">تأثير الانتقال</span>
                      <select
                        value={draftTemplate.slideTransition || 'fade'}
                        onChange={(e) =>
                          patchDraft({ slideTransition: e.target.value as SlideTransitionStyle })
                        }
                        className="px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs"
                      >
                        {TRANSITIONS.map((tr) => (
                          <option key={tr.id} value={tr.id}>
                            {tr.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <label className="flex flex-col gap-1 px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)]">
                      <div className="flex justify-between text-[10px]">
                        <span>تدوير السؤال</span>
                        <span className="tabular-nums">{draftTemplate.questionBorderRadius}px</span>
                      </div>
                      <input
                        type="range"
                        min={6}
                        max={60}
                        value={draftTemplate.questionBorderRadius}
                        onChange={(e) =>
                          patchDraft({ questionBorderRadius: parseInt(e.target.value, 10) })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)]">
                      <div className="flex justify-between text-[10px]">
                        <span>تدوير الخيارات</span>
                        <span className="tabular-nums">{draftTemplate.optionBorderRadius}px</span>
                      </div>
                      <input
                        type="range"
                        min={6}
                        max={52}
                        value={draftTemplate.optionBorderRadius}
                        onChange={(e) =>
                          patchDraft({ optionBorderRadius: parseInt(e.target.value, 10) })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)]">
                      <div className="flex justify-between text-[10px]">
                        <span>شدة الظل</span>
                        <span className="tabular-nums">
                          {Math.round((draftTemplate.shadowIntensity ?? 1) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.1}
                        value={draftTemplate.shadowIntensity ?? 1}
                        onChange={(e) =>
                          patchDraft({ shadowIntensity: parseFloat(e.target.value) })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)]">
                      <div className="flex justify-between text-[10px]">
                        <span>التوهج المضيء</span>
                        <span className="tabular-nums">
                          {Math.round((draftTemplate.glowIntensity ?? 0) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={draftTemplate.glowIntensity ?? 0}
                        onChange={(e) =>
                          patchDraft({ glowIntensity: parseFloat(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                </section>

                {/* 4. Timer, Options, Positions & Channel Brand */}
                <section className="flex flex-col gap-2.5 pb-3 border-b border-[var(--pline)]">
                  <h3 className="text-xs font-extrabold text-[var(--gold)]">
                    4. العداد والتخطيط ومواضع العناصر وهوية القناة
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--pmuted)]">تصميم العداد</span>
                      <select
                        value={draftTemplate.timerStyle}
                        onChange={(e) => patchDraft({ timerStyle: e.target.value as TimerStyle })}
                        className="px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs"
                      >
                        {TIMER_STYLES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--pmuted)]">ترتيب الخيارات</span>
                      <select
                        value={draftTemplate.optionsLayout}
                        onChange={(e) =>
                          patchDraft({ optionsLayout: e.target.value as OptionLayoutMode })
                        }
                        className="px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs"
                      >
                        <option value="channel2x2">شبكة قناة 2×2</option>
                        <option value="grid2x2">شبكة متقاربة 2×2</option>
                        <option value="vertical">قائمة عمودية 1×4</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--pmuted)]">أسلوب كشف الإجابة</span>
                      <select
                        value={draftTemplate.revealStyle}
                        onChange={(e) =>
                          patchDraft({ revealStyle: e.target.value as RevealStyle })
                        }
                        className="px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs"
                      >
                        <option value="highlightGlow">توهج أخضر للإجابة</option>
                        <option value="redWrongGreenCorrect">أحمر للخطأ وأخضر للصح</option>
                        <option value="dimOthers">تعتيم الخيارات الأخرى</option>
                        <option value="scaleCheck">تكبير وعلامة صح</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--pmuted)]">معرّف القناة (@Handle)</span>
                      <input
                        type="text"
                        value={draftTemplate.brandHandleText || ''}
                        onChange={(e) => patchDraft({ brandHandleText: e.target.value })}
                        placeholder="@MyQuizChannel"
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-xs"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-center">
                    <label className="flex flex-col gap-1 px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)]">
                      <div className="flex justify-between text-[10px]">
                        <span>موضع السؤال Y</span>
                        <span className="tabular-nums">{draftTemplate.questionY}%</span>
                      </div>
                      <input
                        type="range"
                        min={15}
                        max={45}
                        value={draftTemplate.questionY}
                        onChange={(e) =>
                          patchDraft({ questionY: parseInt(e.target.value, 10) })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)]">
                      <div className="flex justify-between text-[10px]">
                        <span>موضع الخيارات Y</span>
                        <span className="tabular-nums">{draftTemplate.optionsStartY}%</span>
                      </div>
                      <input
                        type="range"
                        min={38}
                        max={72}
                        value={draftTemplate.optionsStartY}
                        onChange={(e) =>
                          patchDraft({ optionsStartY: parseInt(e.target.value, 10) })
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-[11px] font-bold cursor-pointer">
                      <span>كشف الدليل عند الإجابة</span>
                      <input
                        type="checkbox"
                        checked={Boolean(draftTemplate.showExplanationOnReveal)}
                        onChange={(e) =>
                          patchDraft({ showExplanationOnReveal: e.target.checked })
                        }
                        className="w-4 h-4 accent-[#00B050]"
                      />
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={logoUploadRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUploadBrandLogo}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => logoUploadRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] hover:border-[#00B050] text-[11px] font-bold cursor-pointer"
                      >
                        <ImagePlus className="w-3.5 h-3.5 text-[#00B050]" />
                        <span>شعار القناة</span>
                      </button>
                    </div>
                  </div>
                </section>

                {/* 5. Save Custom Theme Bar */}
                <section className="flex flex-col gap-2 p-3 rounded-xl bg-[var(--surface)] border border-[var(--pline)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={customThemeName}
                      onChange={(e) => setCustomThemeName(e.target.value)}
                      placeholder="اسم الثيم المخصص (مثال: ثيم قناتي الليلي)"
                      className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--pline)] text-xs focus:border-[#00B050] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveAsCustomTheme()}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#00B050] hover:bg-[#00c85b] text-white text-xs font-bold cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>حفظ كثيم مخصص جديد</span>
                    </button>
                    {selectedCustomId && (
                      <button
                        type="button"
                        onClick={() => void handleUpdateExistingCustomTheme()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[#00B050] text-[#00B050] text-xs font-bold cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>تحديث المخصص</span>
                      </button>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-[var(--pmuted)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeMediaOnSave}
                      onChange={(e) => setIncludeMediaOnSave(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#00B050]"
                    />
                    <span>تضمين صورة الخلفية وشعار القناة داخل الثيم المحفوظ</span>
                  </label>
                </section>
              </div>
            )}
          </div>

          {/* Right Column: Live Stage Preview + Quick Tweaks + Apply Scopes */}
          <aside className="flex flex-col justify-between gap-3 p-3.5 bg-[var(--surface)] overflow-y-auto">
            <div className="flex flex-col gap-2.5">
              {/* Preview Top Row */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-xs font-extrabold truncate">{selectedTitle}</h3>
                  <p className="text-[10px] text-[var(--pmuted)] truncate">
                    {selectedEntry.meta.decorSummary}
                  </p>
                </div>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--panel)] border border-[var(--pline)] shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewPhase('question')}
                    className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                      previewPhase === 'question'
                        ? 'bg-[#00B050] text-white'
                        : 'text-[var(--pmuted)]'
                    }`}
                  >
                    السؤال
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPhase('reveal')}
                    className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                      previewPhase === 'reveal'
                        ? 'bg-[#00B050] text-white'
                        : 'text-[var(--pmuted)]'
                    }`}
                  >
                    الحل والدليل
                  </button>
                </div>
              </div>

              {/* Scaled Phone/Video Live Preview */}
              <div className="mx-auto w-full max-w-[196px] rounded-xl overflow-hidden border border-[var(--pline)] shadow-lg bg-black">
                <MiniThemeStagePreview
                  template={draftTemplate}
                  phase={previewPhase}
                  compact={false}
                />
              </div>

              {/* Quick Inline Tweaks after choosing theme */}
              <div className="p-2.5 rounded-xl bg-[var(--panel)] border border-[var(--pline)] flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>تعديل سريع للألوان والخط</span>
                  <button
                    type="button"
                    onClick={handleResetToOriginal}
                    className="flex items-center gap-1 text-[10px] text-[var(--gold)] hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>إعادة للأصل</span>
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <label className="flex flex-col items-center gap-0.5 text-[9px] text-[var(--pmuted)]">
                    <span>السؤال</span>
                    <input
                      type="color"
                      value={draftTemplate.questionBoxColor}
                      onChange={(e) => patchDraft({ questionBoxColor: e.target.value })}
                      className="w-7 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex flex-col items-center gap-0.5 text-[9px] text-[var(--pmuted)]">
                    <span>الخيارات</span>
                    <input
                      type="color"
                      value={draftTemplate.optionBoxColor}
                      onChange={(e) => patchDraft({ optionBoxColor: e.target.value })}
                      className="w-7 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex flex-col items-center gap-0.5 text-[9px] text-[var(--pmuted)]">
                    <span>الإطار</span>
                    <input
                      type="color"
                      value={draftTemplate.questionBorderColor}
                      onChange={(e) =>
                        patchDraft({
                          questionBorderColor: e.target.value,
                          optionBorderColor: e.target.value,
                        })
                      }
                      className="w-7 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex flex-col items-center gap-0.5 text-[9px] text-[var(--pmuted)]">
                    <span>العداد</span>
                    <input
                      type="color"
                      value={draftTemplate.timerBgColor}
                      onChange={(e) => patchDraft({ timerBgColor: e.target.value })}
                      className="w-7 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={draftTemplate.fontFamily}
                    onChange={(e) =>
                      patchDraft({ fontFamily: e.target.value as TemplateSettings['fontFamily'] })
                    }
                    className="px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-[11px] font-bold"
                  >
                    <option value="Cairo">خط القاهرة</option>
                    <option value="Tajawal">خط تجوال</option>
                    <option value="Amiri">خط أميري</option>
                  </select>
                  <select
                    value={draftTemplate.timerStyle}
                    onChange={(e) => patchDraft({ timerStyle: e.target.value as TimerStyle })}
                    className="px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--pline)] text-[11px] font-bold"
                  >
                    {TIMER_STYLES.map((ts) => (
                      <option key={ts.id} value={ts.id}>
                        {ts.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preservation Checkboxes */}
              <div className="flex flex-col gap-1.5 text-[11px]">
                <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--pline)] cursor-pointer">
                  <span>الحفاظ على شعار القناة والمعرّف</span>
                  <input
                    type="checkbox"
                    checked={preserveBrandIdentity}
                    onChange={(e) => setPreserveBrandIdentity(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#00B050]"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--pline)] cursor-pointer">
                  <span>الحفاظ على مواضع العناصر الحالية</span>
                  <input
                    type="checkbox"
                    checked={preserveLayoutPositions}
                    onChange={(e) => setPreserveLayoutPositions(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#00B050]"
                  />
                </label>
              </div>
            </div>

            {statusNotice && (
              <div
                className={`px-3 py-2 rounded-xl text-[11px] font-bold border ${
                  statusNotice.type === 'ok'
                    ? 'bg-[#00B050]/12 border-[#00B050]/45 text-[#00B050] dark:text-[#6ee7b7]'
                    : 'bg-rose-500/12 border-rose-500/40 text-rose-400'
                }`}
              >
                {statusNotice.text}
              </div>
            )}

            {/* Action Buttons: Preview on Stage + Apply Scopes */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[var(--pline)]">
              {onPreviewOnStage && (
                <button
                  type="button"
                  onClick={handleToggleStagePreview}
                  className={`flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                    isPreviewingOnStage
                      ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)]'
                      : 'bg-[var(--panel)] border-[var(--pline)] hover:border-[var(--gold)] text-[var(--ptxt)]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>
                    {isPreviewingOnStage ? 'إيقاف المعاينة الحية والعودة' : 'معاينة الثيم على مسرح الاستوديو'}
                  </span>
                </button>
              )}

              {mode === 'factory' && onApplyForFactory ? (
                <button
                  type="button"
                  onClick={() => {
                    onApplyForFactory(draftTemplate, {
                      label: selectedTitle,
                      customPresetId: selectedCustomId || undefined,
                      presetId: draftTemplate.presetId,
                    });
                    onClose();
                  }}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl bg-[#00B050] hover:bg-[#00c85b] text-white text-xs font-extrabold cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>اعتماد هذا الثيم لحلقات السلسلة الحالية</span>
                </button>
              ) : (
                onApplyToCurrent && (
                  <button
                    type="button"
                    onClick={() => {
                      const applied = applyCustomTemplateSettings(currentTemplate, draftTemplate, {
                        preserveChannelIdentity: preserveBrandIdentity,
                        preserveLayoutPositions,
                      });
                      onApplyToCurrent(applied, `تم تطبيق ثيم «${selectedTitle}» على الفيديو الحالي!`);
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl bg-[#00B050] hover:bg-[#00c85b] text-white text-xs font-extrabold cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>تطبيق الثيم على الفيديو الحالي</span>
                  </button>
                )
              )}

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={batchBusy}
                  onClick={() => void handleApplyBatchScope('factoryOnly')}
                  className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-[var(--panel)] border border-[var(--pline)] hover:border-[#00B050] text-[11px] font-bold cursor-pointer disabled:opacity-50"
                >
                  <Factory className="w-3.5 h-3.5 text-[#00B050] shrink-0" />
                  <span className="truncate">مصنع الشورتس بالكامل</span>
                </button>
                <button
                  type="button"
                  disabled={batchBusy}
                  onClick={() => void handleApplyBatchScope('allProjects')}
                  className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-[var(--panel)] border border-[var(--pline)] hover:border-[var(--gold)] text-[11px] font-bold cursor-pointer disabled:opacity-50"
                >
                  <FolderSync className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                  <span className="truncate">جميع المشاريع بالمكتبة</span>
                </button>
              </div>
              {seriesLabel && (
                <button
                  type="button"
                  disabled={batchBusy}
                  onClick={() => void handleApplyBatchScope('prefix')}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 px-2.5 rounded-xl bg-[var(--panel)] border border-[var(--pline)] hover:border-[#00B050] text-[11px] font-bold cursor-pointer disabled:opacity-50"
                >
                  <Layers className="w-3.5 h-3.5 text-[#00B050]" />
                  <span className="truncate">تطبيق على جميع حلقات سلسلة «{seriesLabel}»</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
