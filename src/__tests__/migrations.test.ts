import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BRAND_PRESET,
  migrateBrandPresetSchema,
  migrateEpisodeSchema,
  migrateSceneSchema,
  migrateSeriesSchema,
} from '../series/migrations';
import { CURRENT_SERIES_SCHEMA_VERSION } from '../types/series';

describe('series schema migrations', () => {
  it('migrates partial legacy brand preset safely with defaults', () => {
    const migrated = migrateBrandPresetSchema({
      id: 'custom-brand-1',
      name: 'هوية مخصصة',
      typography: { fontFamily: 'UnknownFont', headingWeight: 950 },
      narrator: { voice: 'InvalidVoice' },
    });

    expect(migrated.id).toBe('custom-brand-1');
    expect(migrated.typography.fontFamily).toBe(DEFAULT_BRAND_PRESET.typography.fontFamily);
    expect(migrated.typography.headingWeight).toBe(900); // clamped max
    expect(migrated.narrator.voice).toBe(DEFAULT_BRAND_PRESET.narrator.voice);
  });

  it('migrates scene schema from multiline string onScreenText and clamps duration', () => {
    const sc = migrateSceneSchema(
      {
        narration: '  معلومة علمية مركزة  ',
        onScreenText: 'سطر أول\nسطر ثاني\n',
        duration: 500,
        transition: 'unknownTransition',
        factCheck: { status: 'needs_review', confidence: 0.68, flagReason: 'تحتاج مراجعة تاريخية' },
      },
      25
    );

    expect(sc.index).toBe(25);
    expect(sc.narration).toBe('معلومة علمية مركزة');
    expect(sc.onScreenText).toEqual(['سطر أول', 'سطر ثاني']);
    expect(sc.duration).toBe(180); // clamped to max 180s
    expect(sc.transition).toBe('fade');
    expect(sc.factCheck?.status).toBe('needs_review');
  });

  it('migrates legacy series document to current schemaVersion and preserves open-ended 100-episode metadata', () => {
    const legacySeries = migrateSeriesSchema({
      id: 'legacy_001',
      topic: 'رحلة في تاريخ الطب',
      format: '1:1',
      stylePreset: 'educational',
      episodeCount: 100,
      isOpenEnded: true,
      scenesPerEpisode: 12,
      targetDurationSec: 180,
      episodes: [
        {
          title: 'الحلقة الأولى',
          scenes: [
            {
              narration: 'مشهد موثق',
              factCheck: { status: 'verified', confidence: 0.94 },
            },
            {
              narration: 'ادعاء غير مؤكد يحتاج مراجعة',
              factCheck: { status: 'flagged', confidence: 0.35, flagReason: 'رقم بدون مصدر' },
            },
          ],
        },
      ],
    });

    expect(legacySeries.schemaVersion).toBe(CURRENT_SERIES_SCHEMA_VERSION);
    expect(legacySeries.format).toBe('1:1');
    expect(legacySeries.episodeCount).toBe(100);
    expect(legacySeries.isOpenEnded).toBe(true);
    expect(legacySeries.scenesPerEpisode).toBe(12);
    expect(legacySeries.targetDurationSec).toBe(180);
    expect(legacySeries.episodes).toHaveLength(1);
    expect(legacySeries.episodes[0].exportSettings.aspectRatio).toBe('1:1');
    expect(legacySeries.episodes[0].factReviewSummary?.verifiedCount).toBe(1);
    expect(legacySeries.episodes[0].factReviewSummary?.flaggedCount).toBe(1);
    expect(legacySeries.episodes[0].factReviewSummary?.flaggedClaims).toContain('رقم بدون مصدر');
  });

  it('migrates episode with missing titleOptions and thumbnails cleanly', () => {
    const ep = migrateEpisodeSchema({}, 'series-x', 1, '16:9');
    expect(ep.seriesId).toBe('series-x');
    expect(ep.title).toBe('الحلقة 2');
    expect(ep.titleOptions).toEqual(['الحلقة 2']);
    expect(ep.thumbnailConcepts.length).toBeGreaterThan(0);
    expect(ep.exportSettings.aspectRatio).toBe('16:9');
  });
});
