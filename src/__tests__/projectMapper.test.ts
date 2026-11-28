import { describe, expect, it } from 'vitest';
import {
  brandPresetToTemplatePatch,
  mapEpisodeToQuizProject,
  mapSceneToQuizSlide,
  syncEpisodeFromQuizProject,
} from '../series/projectMapper';
import { DEFAULT_BRAND_PRESET, migrateSeriesSchema } from '../series/migrations';
import { createDefaultProject } from '../types/quiz';

describe('series-to-QuizProject mapper', () => {
  const sampleSeries = migrateSeriesSchema({
    id: 'series-map-1',
    name: 'روائع الفيزياء',
    topic: 'قوانين الفيزياء اليومية',
    format: '1:1',
    stylePreset: 'quizChallenge',
    brandPreset: {
      ...DEFAULT_BRAND_PRESET,
      lowerThirdStyle: {
        showChannelName: true,
        channelName: 'قناة الفيزياء',
        handleText: '@PhysicsAr',
        accentColor: '#d4a73a',
      },
    },
    episodes: [
      {
        id: 'ep-map-1',
        index: 0,
        title: 'سر الجاذبية',
        hook: 'لماذا لا نطير عن الأرض رغم دورانها؟',
        scenes: [
          {
            id: 'sc-map-1',
            index: 0,
            narration: 'تسارع الجاذبية الأرضية يقارب 9.8 متر في الثانية المربعة.',
            onScreenText: ['الجاذبية الأرضية', '9.8 م/ث²'],
            visualPrompt: 'رسم توضيحي للكرة الأرضية',
            visualAssetUrl: 'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E',
            quizQuestion: 'كم يبلغ تسارع الجاذبية الأرضية تقريباً؟',
            quizOptions: ['9.8 م/ث²', '2.5 م/ث²', '25 م/ث²', '100 م/ث²'],
            quizCorrectIndex: 0,
            quizExplanation: 'القيمة القياسية على سطح الأرض هي 9.81 م/ث²',
          },
        ],
      },
    ],
  });

  it('applies BrandPreset identity and 1:1 aspect ratio onto TemplateSettings', () => {
    const tpl = brandPresetToTemplatePatch(sampleSeries.brandPreset, '1:1');
    expect(tpl.aspectRatio).toBe('1:1');
    expect(tpl.brandChannelName).toBe('قناة الفيزياء');
    expect(tpl.brandHandleText).toBe('@PhysicsAr');
  });

  it('maps quiz scenes and preserves visual asset URL onto QuestionSlide', () => {
    const ep = sampleSeries.episodes[0];
    const slide = mapSceneToQuizSlide(ep.scenes[0], ep, sampleSeries, 0);
    expect(slide.slideType).toBe('multiple');
    expect(slide.question).toBe('كم يبلغ تسارع الجاذبية الأرضية تقريباً؟');
    expect(slide.options).toEqual(['9.8 م/ث²', '2.5 م/ث²', '25 م/ث²', '100 م/ث²']);
    expect(slide.correctIndex).toBe(0);
    expect(slide.imageDataUrl).toContain('data:image/svg+xml');
    expect(slide.category).toBe('science');
  });

  it('converts Episode to QuizProject while preserving existing project timing and custom slide media', () => {
    const ep = sampleSeries.episodes[0];
    const existing = createDefaultProject();
    existing.id = 'existing-proj-99';
    existing.timing = { ...existing.timing, thinkingDuration: 9 };
    existing.slides[0] = {
      ...existing.slides[0],
      id: 'scene-slide-sc-map-1',
      imageDataUrl: 'data:image/png;base64,CUSTOM',
    };

    const mapped = mapEpisodeToQuizProject(ep, sampleSeries, existing);
    expect(mapped.id).toBe('existing-proj-99');
    expect(mapped.timing.thinkingDuration).toBe(9);
    expect(mapped.template.aspectRatio).toBe('1:1');
    expect(mapped.slides[0].question).toBe('كم يبلغ تسارع الجاذبية الأرضية تقريباً؟');

    // Syncing back preserves edits made inside Advanced Studio
    mapped.slides[0].question = 'سؤال محدث من الاستوديو المتقدم؟';
    const syncedEp = syncEpisodeFromQuizProject(ep, mapped);
    expect(syncedEp.projectRef).toBe('existing-proj-99');
    expect(syncedEp.scenes[0].quizQuestion).toBe('سؤال محدث من الاستوديو المتقدم؟');
  });
});
