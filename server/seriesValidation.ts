import {
  AppendEpisodesRequest,
  CreateSeriesRequest,
  SeriesAudience,
  SeriesFormat,
  SeriesLanguage,
  SeriesStylePreset,
} from '../src/types/series';
import { migrateBrandPresetSchema } from '../src/series/migrations';

const VALID_STYLES = new Set<SeriesStylePreset>([
  'educational',
  'documentary',
  'storytelling',
  'quizChallenge',
  'fastFacts',
  'mythBuster',
]);

const VALID_LANGUAGES = new Set<SeriesLanguage>(['ar', 'en', 'bilingual']);

const VALID_AUDIENCES = new Set<SeriesAudience>([
  'general',
  'youth',
  'kids',
  'professionals',
  'students',
]);

const VALID_FORMATS = new Set<SeriesFormat>(['9:16', '16:9', '1:1']);

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function validateSeriesIdParam(raw: unknown): ValidationResult<string> {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'معرّف السلسلة غير صالح.' };
  }
  const clean = raw.trim();
  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(clean)) {
    return { ok: false, error: 'تنسيق معرّف السلسلة غير مقبول.' };
  }
  return { ok: true, value: clean };
}

export function validateCreateSeriesInput(body: unknown): ValidationResult<CreateSeriesRequest> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'بيانات الطلب مفقودة أو غير صالحة.' };
  }

  const raw = body as Record<string, unknown>;
  const topic = typeof raw.topic === 'string' ? raw.topic.trim() : '';
  if (topic.length < 3) {
    return { ok: false, error: 'يرجى كتابة موضوع واضح للسلسلة (3 أحرف على الأقل).' };
  }
  if (topic.length > 400) {
    return { ok: false, error: 'وصف الموضوع طويل جداً (الحد الأقصى 400 حرف).' };
  }

  const stylePreset =
    typeof raw.stylePreset === 'string' && VALID_STYLES.has(raw.stylePreset as SeriesStylePreset)
      ? (raw.stylePreset as SeriesStylePreset)
      : 'educational';

  const language =
    typeof raw.language === 'string' && VALID_LANGUAGES.has(raw.language as SeriesLanguage)
      ? (raw.language as SeriesLanguage)
      : 'ar';

  const audience =
    typeof raw.audience === 'string' && VALID_AUDIENCES.has(raw.audience as SeriesAudience)
      ? (raw.audience as SeriesAudience)
      : 'general';

  const format =
    typeof raw.format === 'string' && VALID_FORMATS.has(raw.format as SeriesFormat)
      ? (raw.format as SeriesFormat)
      : '9:16';

  const isOpenEnded = Boolean(raw.isOpenEnded);

  const rawEpisodes = Number(raw.episodeCount);
  if (raw.episodeCount !== undefined && (!Number.isFinite(rawEpisodes) || rawEpisodes < 1 || rawEpisodes > 500)) {
    return { ok: false, error: 'عدد الحلقات يجب أن يكون بين 1 و 500 حلقة (أو اختر سلسلة مفتوحة).' };
  }
  const episodeCount = Number.isFinite(rawEpisodes)
    ? Math.max(1, Math.min(500, Math.round(rawEpisodes)))
    : isOpenEnded
      ? 5
      : 3;

  const rawInitialBatch = Number(raw.initialBatchCount);
  if (
    raw.initialBatchCount !== undefined &&
    (!Number.isFinite(rawInitialBatch) || rawInitialBatch < 1 || rawInitialBatch > 20)
  ) {
    return { ok: false, error: 'حجم الدفعة الأولى يجب أن يكون بين 1 و 20 حلقة.' };
  }
  const initialBatchCount = Number.isFinite(rawInitialBatch)
    ? Math.max(1, Math.min(20, Math.round(rawInitialBatch)))
    : Math.min(episodeCount, 8);

  const rawScenesPerEp = Number(raw.scenesPerEpisode);
  if (
    raw.scenesPerEpisode !== undefined &&
    (!Number.isFinite(rawScenesPerEp) || rawScenesPerEp < 0 || rawScenesPerEp > 30)
  ) {
    return { ok: false, error: 'عدد المشاهد لكل حلقة يجب أن يكون بين 1 و 30 (أو 0 للتلقائي).' };
  }
  const scenesPerEpisode = Number.isFinite(rawScenesPerEp)
    ? Math.max(0, Math.min(30, Math.round(rawScenesPerEp)))
    : 0;

  const rawDur = Number(raw.targetDurationSec);
  if (raw.targetDurationSec !== undefined && (!Number.isFinite(rawDur) || rawDur < 15 || rawDur > 600)) {
    return { ok: false, error: 'مدة الحلقة يجب أن تكون بين 15 و 600 ثانية.' };
  }
  const targetDurationSec = Number.isFinite(rawDur)
    ? Math.max(15, Math.min(600, Math.round(rawDur)))
    : 45;

  const brandPresetId =
    typeof raw.brandPresetId === 'string' && /^[a-zA-Z0-9_-]{2,128}$/.test(raw.brandPresetId.trim())
      ? raw.brandPresetId.trim()
      : undefined;

  const brandPreset =
    raw.brandPreset && typeof raw.brandPreset === 'object'
      ? migrateBrandPresetSchema(raw.brandPreset)
      : undefined;

  return {
    ok: true,
    value: {
      topic,
      stylePreset,
      language,
      audience,
      targetDurationSec,
      episodeCount,
      isOpenEnded,
      scenesPerEpisode,
      initialBatchCount,
      format,
      brandPresetId,
      brandPreset,
    },
  };
}

export function validateAppendEpisodesInput(body: unknown): ValidationResult<AppendEpisodesRequest> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'بيانات الدفعة الإضافية غير صالحة.' };
  }
  const raw = body as Record<string, unknown>;
  const rawCount = raw.count === undefined ? 5 : Number(raw.count);
  if (!Number.isFinite(rawCount) || rawCount < 1 || rawCount > 20) {
    return { ok: false, error: 'عدد الحلقات المضافة في الدفعة يجب أن يكون بين 1 و 20 حلقة.' };
  }
  const count = Math.max(1, Math.min(20, Math.round(rawCount)));

  if (raw.focusTopic !== undefined && typeof raw.focusTopic !== 'string') {
    return { ok: false, error: 'محور الدفعة يجب أن يكون نصاً.' };
  }
  const focusTopic =
    typeof raw.focusTopic === 'string' ? raw.focusTopic.trim().slice(0, 240) : undefined;

  const rawScenesPerEp = Number(raw.scenesPerEpisode);
  if (
    raw.scenesPerEpisode !== undefined &&
    (!Number.isFinite(rawScenesPerEp) || rawScenesPerEp < 0 || rawScenesPerEp > 30)
  ) {
    return { ok: false, error: 'عدد المشاهد لكل حلقة يجب أن يكون بين 1 و 30 (أو 0 للتلقائي).' };
  }
  const scenesPerEpisode = Number.isFinite(rawScenesPerEp)
    ? Math.max(0, Math.min(30, Math.round(rawScenesPerEp)))
    : undefined;

  return {
    ok: true,
    value: {
      count,
      focusTopic: focusTopic || undefined,
      scenesPerEpisode,
    },
  };
}

export function validateRegenerateSceneInput(
  body: unknown
): ValidationResult<{ instruction?: string }> {
  if (!body || typeof body !== 'object') {
    return { ok: true, value: {} };
  }
  const raw = body as Record<string, unknown>;
  if (raw.instruction !== undefined && typeof raw.instruction !== 'string') {
    return { ok: false, error: 'تعليمة إعادة التوليد يجب أن تكون نصاً.' };
  }
  const instruction =
    typeof raw.instruction === 'string' ? raw.instruction.trim().slice(0, 240) : undefined;
  return { ok: true, value: { instruction: instruction || undefined } };
}

export function sanitizeSvgToDataUrl(rawSvg: string): string | null {
  const match = rawSvg.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return null;
  let svg = match[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/javascript:/gi, '')
    .trim();

  if (svg.length < 30 || svg.length > 48_000) return null;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
