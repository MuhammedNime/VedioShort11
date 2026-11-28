import {
  Episode,
  SERIES_AUDIENCE_OPTIONS,
  SERIES_LANGUAGE_OPTIONS,
  SERIES_STYLE_OPTIONS,
  SceneAnimation,
  SceneMood,
  Series,
  SeriesFormat,
  SeriesStatus,
} from '../../types/series';
import { SlideTransitionStyle } from '../../types/quiz';

export const STATUS_ARABIC_LABEL: Record<SeriesStatus, string> = {
  queued: 'في قائمة الانتظار',
  generating: 'جارٍ التوليد',
  reviewing: 'بحاجة لمراجعة',
  ready: 'جاهز',
  exporting: 'جارٍ التصدير',
  failed: 'فشل التوليد',
};

export const STATUS_TEXT_CLASS: Record<SeriesStatus, string> = {
  queued: 'text-[var(--pmuted)] border-[var(--pline)] bg-[var(--surface)]',
  generating: 'text-[var(--gold)] border-[var(--gold)]/45 bg-[var(--gold)]/10',
  reviewing: 'text-amber-300 border-amber-400/50 bg-amber-500/10',
  ready: 'text-[#00c85b] border-[#00B050]/50 bg-[#00B050]/10',
  exporting: 'text-sky-300 border-sky-400/50 bg-sky-500/10',
  failed: 'text-rose-300 border-rose-500/50 bg-rose-500/10',
};

export const FORMAT_LABELS: Record<SeriesFormat, { title: string; ratioHint: string }> = {
  '9:16': { title: 'عمودي 9:16', ratioHint: 'شورتس وريلز' },
  '16:9': { title: 'أفقي 16:9', ratioHint: 'يوتيوب عريض' },
  '1:1': { title: 'مربع 1:1', ratioHint: 'منشورات اجتماعية' },
};

export const TRANSITION_OPTIONS: Array<{ id: SlideTransitionStyle; label: string }> = [
  { id: 'fade', label: 'تلاشي ناعم' },
  { id: 'slideLeft', label: 'انزلاق لليسار' },
  { id: 'slideRight', label: 'انزلاق لليمين' },
  { id: 'zoomFade', label: 'تكبير وتلاشي' },
  { id: 'wipeGold', label: 'مسح ذهبي' },
  { id: 'none', label: 'بدون انتقال' },
];

export const SCENE_ANIMATION_OPTIONS: Array<{ id: SceneAnimation; label: string }> = [
  { id: 'zoomIn', label: 'تقريب سينمائي' },
  { id: 'panLeft', label: 'تحريك أفقي يسار' },
  { id: 'panRight', label: 'تحريك أفقي يمين' },
  { id: 'pop', label: 'ظهور نبضي' },
  { id: 'pulse', label: 'توهج هادئ' },
  { id: 'fadeIn', label: 'ظهور متدرج' },
];

export const SCENE_MOOD_OPTIONS: Array<{ id: SceneMood; label: string }> = [
  { id: 'energetic', label: 'حماسي' },
  { id: 'curious', label: 'فضولي' },
  { id: 'dramatic', label: 'درامي' },
  { id: 'calm', label: 'هادئ' },
  { id: 'triumphant', label: 'احتفالي' },
];

export function getStyleLabel(styleId: Series['stylePreset']): string {
  return SERIES_STYLE_OPTIONS.find((s) => s.id === styleId)?.label || styleId;
}

export function getAudienceLabel(audienceId: Series['audience']): string {
  return SERIES_AUDIENCE_OPTIONS.find((a) => a.id === audienceId)?.label || audienceId;
}

export function getLanguageLabel(langId: Series['language']): string {
  return SERIES_LANGUAGE_OPTIONS.find((l) => l.id === langId)?.label || langId;
}

export function formatDurationSeconds(sec: number): string {
  const safe = Math.max(0, Math.round(Number(sec) || 0));
  if (safe < 60) return `${safe} ث`;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return s === 0 ? `${m} د` : `${m} د ${s} ث`;
}

export function countFlaggedClaimsInEpisode(ep: Episode): number {
  return ep.scenes.filter(
    (sc) => sc.factCheck && (sc.factCheck.status === 'flagged' || sc.factCheck.status === 'needs_review')
  ).length;
}

export function buildSeriesPublishBundleText(series: Series, episodes: Episode[]): string {
  const lines: string[] = [
    `حزمة النشر الكاملة — ${series.name}`,
    `الموضوع: ${series.topic}`,
    `الأسلوب: ${getStyleLabel(series.stylePreset)} | الأبعاد: ${series.format}`,
    '====================================================',
    '',
  ];

  for (const ep of episodes) {
    lines.push(`الحلقة ${ep.index + 1}: ${ep.publishKit.title || ep.title}`);
    lines.push(`الخطاف (أول 3 ثوانٍ): ${ep.hook}`);
    lines.push(`نص الصورة المصغرة: ${ep.thumbnail.visibleText}`);
    lines.push(`الوصف:\n${ep.publishKit.description}`);
    lines.push(`الوسوم: ${ep.publishKit.tags.join('، ')}`);
    lines.push(`الهاشتاغات: ${ep.publishKit.hashtags.join(' ')}`);
    lines.push(`التعليق المثبت: ${ep.publishKit.pinnedComment}`);
    lines.push('----------------------------------------------------');
    lines.push('');
  }

  return lines.join('\n');
}
