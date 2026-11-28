import React, { useEffect, useState } from 'react';
import { Check, Palette, RotateCcw, Upload, X } from 'lucide-react';
import { BrandPreset } from '../../types/series';
import { PresetId, TemplateSettings } from '../../types/quiz';
import { BUILTIN_BRAND_PRESETS, migrateBrandPresetSchema } from '../../series/migrations';
import { readFileAsDataUrl } from '../../storage/projectStore';
import { triggerHaptic } from '../../utils/haptics';

interface BrandIdentityDrawerProps {
  isOpen: boolean;
  brandPreset: BrandPreset;
  onClose: () => void;
  onApplyToSeries: (nextBrand: BrandPreset) => void;
}

const THEME_PRESET_CHOICES: Array<{ id: PresetId; label: string }> = [
  { id: 'darkCinematic', label: 'داكن سينمائي' },
  { id: 'luxuryGold', label: 'ذهبي فاخر' },
  { id: 'quizProSignature', label: 'هوية كويز برو' },
  { id: 'natureEmerald', label: 'زمردي معرفي' },
  { id: 'techBlue', label: 'تقني أزرق' },
  { id: 'islamicAndalusian', label: 'أندلسي تراثي' },
  { id: 'scienceLab', label: 'مختبر العلوم' },
  { id: 'neonCyber', label: 'نيون عصري' },
];

const FONT_CHOICES: Array<{ id: TemplateSettings['fontFamily']; label: string }> = [
  { id: 'Cairo', label: 'Cairo — حديث وواضح' },
  { id: 'Tajawal', label: 'Tajawal — ناعم وسريع' },
  { id: 'Amiri', label: 'Amiri — كلاسيكي رصين' },
];

const VOICE_CHOICES: Array<{ id: BrandPreset['narrator']['voice']; label: string }> = [
  { id: 'Kore', label: 'Kore (واضح ومتزن)' },
  { id: 'Charon', label: 'Charon (وثائقي عميق)' },
  { id: 'Puck', label: 'Puck (شبابي سريع)' },
  { id: 'Fenrir', label: 'Fenrir (حماسي قوي)' },
  { id: 'Zephyr', label: 'Zephyr (هادئ ولطيف)' },
];

export const BrandIdentityDrawer: React.FC<BrandIdentityDrawerProps> = ({
  isOpen,
  brandPreset,
  onClose,
  onApplyToSeries,
}) => {
  const [draft, setDraft] = useState<BrandPreset>(() => migrateBrandPresetSchema(brandPreset));
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(migrateBrandPresetSchema(brandPreset));
      setSavedNotice(false);
    }
  }, [isOpen, brandPreset]);

  if (!isOpen) return null;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setDraft((prev) => ({
        ...prev,
        logo: { ...prev.logo, dataUrl, name: file.name },
      }));
    } catch {
      // ignore read failure
    }
  };

  const handleApply = () => {
    triggerHaptic('medium');
    onApplyToSeries(migrateBrandPresetSchema(draft));
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 550);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brand-identity-drawer-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--pline)] bg-[var(--panel)] text-[var(--ptxt)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--pline)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-[var(--gold)]" />
            <div>
              <h2 id="brand-identity-drawer-title" className="text-base font-extrabold">
                الهوية البصرية الموحدة للسلسلة
              </h2>
              <p className="text-xs text-[var(--pmuted)]">
                تُطبّق هذه الهوية على جميع حلقات السلسلة والمشاريع المرتبطة بها
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الهوية الموحدة"
            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg border border-[var(--pline)] hover:bg-[var(--panel)] text-[var(--pmuted)] hover:text-[var(--ptxt)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick builtin templates */}
          <div>
            <p className="text-xs font-bold text-[var(--pmuted)] mb-2">قوالب هوية جاهزة</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {BUILTIN_BRAND_PRESETS.map((preset) => {
                const active = draft.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDraft(migrateBrandPresetSchema(preset));
                    }}
                    className={`p-3 rounded-xl border text-right transition-colors cursor-pointer min-h-[44px] ${
                      active
                        ? 'border-[#00B050] bg-[#00B050]/10'
                        : 'border-[var(--pline)] bg-[var(--surface)] hover:border-[var(--gold)]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold truncate">{preset.name}</span>
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                        style={{ backgroundColor: preset.primaryColors.accent }}
                      />
                    </div>
                    <p className="text-[11px] text-[var(--pmuted)] mt-1 truncate">
                      {preset.lowerThirdStyle.channelName}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Channel & Visual Base */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--pmuted)]">اسم القناة / العلامة</span>
              <input
                type="text"
                value={draft.lowerThirdStyle.channelName}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    lowerThirdStyle: { ...prev.lowerThirdStyle, channelName: e.target.value },
                  }))
                }
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm text-[var(--ptxt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B050]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--pmuted)]">معرّف القناة (@handle)</span>
              <input
                type="text"
                dir="ltr"
                value={draft.lowerThirdStyle.handleText}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    lowerThirdStyle: { ...prev.lowerThirdStyle, handleText: e.target.value },
                  }))
                }
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm font-mono-nums text-[var(--ptxt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B050]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--pmuted)]">الثيم البصري الأساسي</span>
              <select
                value={draft.presetId}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, presetId: e.target.value as PresetId }))
                }
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm text-[var(--ptxt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B050]"
              >
                {THEME_PRESET_CHOICES.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--pmuted)]">الخط الرئيسي</span>
              <select
                value={draft.typography.fontFamily}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    typography: {
                      ...prev.typography,
                      fontFamily: e.target.value as TemplateSettings['fontFamily'],
                    },
                  }))
                }
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm text-[var(--ptxt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B050]"
              >
                {FONT_CHOICES.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Colors & Voice & Logo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--pmuted)]">لون التمييز الأساسي</span>
              <div className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl border border-[var(--pline)] bg-[var(--surface)]">
                <input
                  type="color"
                  value={draft.primaryColors.accent}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      primaryColors: { ...prev.primaryColors, accent: e.target.value },
                      lowerThirdStyle: { ...prev.lowerThirdStyle, accentColor: e.target.value },
                    }))
                  }
                  className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-xs font-mono-nums">{draft.primaryColors.accent}</span>
              </div>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--pmuted)]">لون الخلفية</span>
              <div className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl border border-[var(--pline)] bg-[var(--surface)]">
                <input
                  type="color"
                  value={draft.primaryColors.bg}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      primaryColors: { ...prev.primaryColors, bg: e.target.value },
                    }))
                  }
                  className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-xs font-mono-nums">{draft.primaryColors.bg}</span>
              </div>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--pmuted)]">المعلق الصوتي الافتراضي</span>
              <select
                value={draft.narrator.voice}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    narrator: {
                      ...prev.narrator,
                      voice: e.target.value as BrandPreset['narrator']['voice'],
                    },
                  }))
                }
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-sm text-[var(--ptxt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B050]"
              >
                {VOICE_CHOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Logo upload */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--pline)] bg-[var(--surface)]">
            <div className="flex items-center gap-3 min-w-0">
              {draft.logo.dataUrl ? (
                <img
                  src={draft.logo.dataUrl}
                  alt="شعار القناة"
                  className="w-11 h-11 rounded-lg object-contain border border-[var(--pline)] bg-black/40 p-1"
                />
              ) : (
                <div className="w-11 h-11 rounded-lg border border-dashed border-[var(--pline)] flex items-center justify-center text-xs text-[var(--pmuted)]">
                  شعار
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold">شعار العلامة التجارية</p>
                <p className="text-[11px] text-[var(--pmuted)] truncate">
                  {draft.logo.name || 'اختياري — يظهر في زاوية جميع الحلقات'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-[var(--pline)] hover:border-[#00B050] text-xs font-bold cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#00B050]" />
                <span>رفع شعار</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
              {draft.logo.dataUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      logo: { ...prev.logo, dataUrl: undefined, name: undefined },
                    }))
                  }
                  className="px-2.5 py-2 min-h-[40px] rounded-lg border border-[var(--pline)] text-xs text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                >
                  إزالة
                </button>
              )}
            </div>
          </div>

          {/* Intro / Outro & Subtitles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-[var(--pline)] bg-[var(--surface)] space-y-2.5">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs font-bold">تفعيل بطاقة المقدمة (Intro)</span>
                <input
                  type="checkbox"
                  checked={draft.intro.enabled}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      intro: { ...prev.intro, enabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-[#00B050]"
                />
              </label>
              <input
                type="text"
                value={draft.intro.text}
                placeholder="عنوان المقدمة..."
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    intro: { ...prev.intro, text: e.target.value },
                  }))
                }
                className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs text-[var(--ptxt)]"
              />
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--pline)] bg-[var(--surface)] space-y-2.5">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs font-bold">تفعيل الخاتمة والدعوة (Outro CTA)</span>
                <input
                  type="checkbox"
                  checked={draft.outro.enabled}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      outro: { ...prev.outro, enabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-[#00B050]"
                />
              </label>
              <input
                type="text"
                value={draft.outro.ctaText}
                placeholder="نص الدعوة للاشتراك..."
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    outro: { ...prev.outro, ctaText: e.target.value },
                  }))
                }
                className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-[var(--pline)] bg-[var(--panel)] text-xs text-[var(--ptxt)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <label className="flex items-center justify-between gap-2 p-3.5 rounded-xl border border-[var(--pline)] bg-[var(--surface)] cursor-pointer">
              <span className="text-xs font-bold">ترجمة نصية ديناميكية على الشاشة</span>
              <input
                type="checkbox"
                checked={draft.subtitleStyle.enabled}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    subtitleStyle: { ...prev.subtitleStyle, enabled: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-[#00B050]"
              />
            </label>

            <select
              value={draft.subtitleStyle.style}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  subtitleStyle: {
                    ...prev.subtitleStyle,
                    style: e.target.value as BrandPreset['subtitleStyle']['style'],
                  },
                }))
              }
              aria-label="نمط الترجمة على الشاشة"
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-xs text-[var(--ptxt)]"
            >
              <option value="pillKaraoke">كاريوكي متدرج</option>
              <option value="boldYellow">نص عريض أصفر</option>
              <option value="cleanGlass">زجاجي أنيق</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-[var(--pline)] bg-[var(--surface)]">
          <button
            type="button"
            onClick={() => setDraft(migrateBrandPresetSchema(BUILTIN_BRAND_PRESETS[0]))}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[42px] rounded-xl border border-[var(--pline)] text-xs font-bold text-[var(--pmuted)] hover:text-[var(--ptxt)] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#00B050] hover:bg-[#00c85b] text-white text-sm font-extrabold transition-colors cursor-pointer"
          >
            {savedNotice ? <Check className="w-4 h-4" /> : null}
            <span>{savedNotice ? 'تم التطبيق على السلسلة ✓' : 'تطبيق الهوية على كل الحلقات'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
