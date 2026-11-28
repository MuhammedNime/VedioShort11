import { describe, expect, it } from 'vitest';
import {
  buildEpisodeDetailPrompt,
  buildSceneRegeneratePrompt,
  buildSeriesPlanPrompt,
  evaluateFactConfidenceHeuristic,
} from '../series/promptBuilder';
import { CreateSeriesRequest } from '../types/series';

describe('series promptBuilder', () => {
  const sampleReq: CreateSeriesRequest = {
    topic: 'أسرار الحضارة الأندلسية',
    stylePreset: 'documentary',
    language: 'ar',
    audience: 'general',
    targetDurationSec: 45,
    episodeCount: 4,
    format: '9:16',
  };

  it('builds a coherent series plan prompt with 3-second hook directive and avoid topics', () => {
    const res = buildSeriesPlanPrompt(sampleReq, ['عباس بن فرناس']);
    expect(res.systemInstruction).toContain('أول 3 ثوانٍ');
    expect(res.userPrompt).toContain('4 حلقات');
    expect(res.userPrompt).toContain('أسرار الحضارة الأندلسية');
    expect(res.userPrompt).toContain('عباس بن فرناس');
    expect(res.userPrompt).toContain('9:16');
  });

  it('supports continuation batches for open-ended and 100-episode series', () => {
    const openReq: CreateSeriesRequest = {
      ...sampleReq,
      topic: 'سلسلة السيرة النبوية',
      episodeCount: 100,
      isOpenEnded: true,
      scenesPerEpisode: 12,
    };
    const res = buildSeriesPlanPrompt(openReq, ['الهجرة إلى المدينة'], {
      startIndex: 10,
      batchCount: 5,
      continuationFocus: 'المرحلة المدنية وبناء المجتمع',
    });
    expect(res.userPrompt).toContain('5 حلقات');
    expect(res.userPrompt).toContain('11');
    expect(res.userPrompt).toContain('المرحلة المدنية وبناء المجتمع');
    expect(res.userPrompt).toContain('مفتوحة ومستمرة');
  });

  it('includes sibling episode titles/angles to avoid repeating facts and adds quiz instructions for quizChallenge', () => {
    const quizReq: CreateSeriesRequest = {
      ...sampleReq,
      stylePreset: 'quizChallenge',
      language: 'bilingual',
      audience: 'youth',
      scenesPerEpisode: 12,
    };
    const outlines = [
      { index: 0, title: 'عواصم أوروبية', angle: 'مدن تاريخية', hookIdea: 'هل تعرف؟', keyTakeaway: 'ملخص' },
      { index: 1, title: 'عواصم آسيوية', angle: 'مدن حديثة', hookIdea: 'تحدى نفسك', keyTakeaway: 'نهاية' },
    ];
    const res = buildEpisodeDetailPrompt(quizReq, outlines[0], outlines);
    expect(res.userPrompt).toContain('عواصم آسيوية');
    expect(res.userPrompt).toContain('12 مشاهد');
    expect(res.userPrompt).toContain('quizQuestion');
    expect(res.userPrompt).toContain('titleOptions');
    expect(res.userPrompt).toContain('thumbnailConcepts');
    expect(res.systemInstruction).toContain('factCheck');
  });

  it('builds single-scene regeneration prompt incorporating creator instruction', () => {
    const res = buildSceneRegeneratePrompt(
      { topic: 'علوم الفضاء', language: 'ar', audience: 'students', stylePreset: 'educational', format: '16:9' },
      { title: 'ثقوب سوداء', hook: 'ماذا يحدث لو اقتربت؟' },
      {
        id: 'sc-1',
        index: 1,
        narration: 'الجاذبية تزداد بشكل هائل',
        onScreenText: ['الجاذبية القصوى'],
        visualPrompt: 'ثقب أسود دوار',
        visualType: 'svg',
        duration: 8,
        transition: 'fade',
        animation: 'zoomIn',
        mood: 'dramatic',
      },
      'اجعل المثال أبسط لطلاب الثانوي'
    );
    expect(res.userPrompt).toContain('اجعل المثال أبسط لطلاب الثانوي');
    expect(res.userPrompt).toContain('المشهد رقم 2');
  });

  it('flags unsafe or unverified medical/financial/absolute claims via heuristic', () => {
    const medicalFlag = evaluateFactConfidenceHeuristic('هذه وصفة سحرية تعطي علاج نهائي لجميع الأمراض');
    expect(medicalFlag.status).toBe('flagged');
    expect(medicalFlag.confidence).toBeLessThan(0.5);
    expect(medicalFlag.flagReason).toBeTruthy();

    const financeFlag = evaluateFactConfidenceHeuristic('استثمر الآن لتحصل على أرباح مضمونة وثراء سريع');
    expect(financeFlag.status).toBe('flagged');

    const safe = evaluateFactConfidenceHeuristic('يقع مرصد الزهراوي التاريخي ضمن إرث قرطبة الطبي', {
      status: 'verified',
      confidence: 0.93,
    });
    expect(safe.status).toBe('verified');
    expect(safe.confidence).toBe(0.93);
  });
});
