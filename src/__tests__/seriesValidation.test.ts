import { describe, expect, it } from 'vitest';
import {
  sanitizeSvgToDataUrl,
  validateAppendEpisodesInput,
  validateCreateSeriesInput,
  validateRegenerateSceneInput,
  validateSeriesIdParam,
} from '../../server/seriesValidation';
import { SlidingWindowRateLimiter } from '../../server/rateLimiter';

describe('server series API validation & rate limiting', () => {
  it('rejects empty/short topics and out-of-range episode counts or durations', () => {
    expect(validateCreateSeriesInput(null).ok).toBe(false);
    expect(validateCreateSeriesInput({ topic: 'أب' }).ok).toBe(false);
    expect(validateCreateSeriesInput({ topic: 'موضوع صالح', episodeCount: 0 }).ok).toBe(false);
    expect(validateCreateSeriesInput({ topic: 'موضوع صالح', episodeCount: 600 }).ok).toBe(false);
    expect(validateCreateSeriesInput({ topic: 'موضوع صالح', targetDurationSec: 5 }).ok).toBe(false);
    expect(validateCreateSeriesInput({ topic: 'موضوع صالح', scenesPerEpisode: 45 }).ok).toBe(false);
  });

  it('normalizes valid series creation input with 1:1 format, 100-episode series, and open-ended mode', () => {
    const res = validateCreateSeriesInput({
      topic: '  أسرار الفلك للمبتدئين  ',
      stylePreset: 'documentary',
      language: 'ar',
      audience: 'students',
      targetDurationSec: 60,
      episodeCount: 4,
      format: '1:1',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.topic).toBe('أسرار الفلك للمبتدئين');
      expect(res.value.format).toBe('1:1');
      expect(res.value.episodeCount).toBe(4);
      expect(res.value.targetDurationSec).toBe(60);
    }

    const longSeries = validateCreateSeriesInput({
      topic: 'السيرة النبوية والدروس المستفادة',
      episodeCount: 100,
      isOpenEnded: true,
      scenesPerEpisode: 12,
      initialBatchCount: 8,
      targetDurationSec: 180,
      format: '16:9',
    });

    expect(longSeries.ok).toBe(true);
    if (longSeries.ok) {
      expect(longSeries.value.episodeCount).toBe(100);
      expect(longSeries.value.isOpenEnded).toBe(true);
      expect(longSeries.value.scenesPerEpisode).toBe(12);
      expect(longSeries.value.initialBatchCount).toBe(8);
      expect(longSeries.value.targetDurationSec).toBe(180);
    }
  });

  it('validates append episodes requests for continuation batches', () => {
    expect(validateAppendEpisodesInput(null).ok).toBe(false);
    expect(validateAppendEpisodesInput({ count: 25 }).ok).toBe(false);

    const res = validateAppendEpisodesInput({
      count: 6,
      focusTopic: 'غزوة بدر والدروس التنظيمية',
      scenesPerEpisode: 14,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.count).toBe(6);
      expect(res.value.focusTopic).toBe('غزوة بدر والدروس التنظيمية');
      expect(res.value.scenesPerEpisode).toBe(14);
    }
  });

  it('validates route IDs strictly against traversal or injection characters', () => {
    expect(validateSeriesIdParam('series-abc_123').ok).toBe(true);
    expect(validateSeriesIdParam('../etc/passwd').ok).toBe(false);
    expect(validateSeriesIdParam('ab').ok).toBe(false);
  });

  it('validates scene regeneration instruction', () => {
    expect(validateRegenerateSceneInput({ instruction: 123 }).ok).toBe(false);
    const ok = validateRegenerateSceneInput({ instruction: 'اجعل الخطاف أقوى' });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.instruction).toBe('اجعل الخطاف أقوى');
    }
  });

  it('strips script tags and inline handlers from generated SVGs', () => {
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="alert(1)"><script>evil()</script><foreignObject><div>x</div></foreignObject><rect width="100" height="100" fill="#00B050"/></svg>';
    const dataUrl = sanitizeSvgToDataUrl(dirty);
    expect(dataUrl).toBeTruthy();
    const decoded = decodeURIComponent(dataUrl!.replace('data:image/svg+xml;utf8,', ''));
    expect(decoded).not.toContain('<script');
    expect(decoded).not.toContain('onload=');
    expect(decoded).not.toContain('<foreignObject');
    expect(decoded).toContain('<rect');
  });

  it('enforces sliding window rate limits cleanly', () => {
    const limiter = new SlidingWindowRateLimiter({ windowMs: 10_000, maxRequests: 2 });
    const t0 = 1_000_000;
    expect(limiter.check('ip:1', t0).allowed).toBe(true);
    expect(limiter.check('ip:1', t0 + 100).allowed).toBe(true);
    const blocked = limiter.check('ip:1', t0 + 200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(limiter.check('ip:1', t0 + 11_000).allowed).toBe(true);
  });
});
