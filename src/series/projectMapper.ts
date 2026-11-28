import {
  DEFAULT_TEMPLATE,
  DEFAULT_TIMING,
  QuestionSlide,
  QuizCategory,
  QuizProject,
  TemplateSettings,
  applyStudioThemePreset,
  cloneAudioSettings,
  createDefaultProject,
} from '../types/quiz';
import { BrandPreset, Episode, Scene, Series, SeriesFormat } from '../types/series';

export function brandPresetToTemplatePatch(
  brand: BrandPreset,
  format: SeriesFormat,
  baseTemplate?: TemplateSettings
): TemplateSettings {
  const seed = baseTemplate
    ? { ...baseTemplate }
    : applyStudioThemePreset({ ...DEFAULT_TEMPLATE, aspectRatio: format }, brand.presetId);

  return {
    ...seed,
    aspectRatio: format,
    fontFamily: brand.typography.fontFamily,
    brandLogoDataUrl: brand.logo.dataUrl ?? seed.brandLogoDataUrl,
    brandLogoName: brand.logo.name ?? seed.brandLogoName,
    brandLogoPosition: brand.logo.position,
    brandLogoSize: brand.logo.size,
    brandChannelName: brand.lowerThirdStyle.channelName,
    showChannelName: brand.lowerThirdStyle.showChannelName,
    brandHandleText: brand.lowerThirdStyle.handleText,
    brandAccentColor: brand.lowerThirdStyle.accentColor || brand.primaryColors.accent,
    correctColor: brand.secondaryColors.correct,
    wrongColor: brand.secondaryColors.wrong,
    questionBorderColor: brand.secondaryColors.border,
    optionBorderColor: brand.secondaryColors.border,
    showIntroHook: brand.intro.enabled,
    introHookText: brand.intro.text,
    introHookDuration: brand.intro.duration,
    introHookStyle: brand.intro.style,
    showEndCard: brand.outro.enabled,
    endCardText: brand.outro.text,
    endCtaText: brand.outro.ctaText,
    showEndSubscribeCta: brand.outro.enabled,
    showDynamicCaptions: brand.subtitleStyle.enabled,
    dynamicCaptionStyle: brand.subtitleStyle.style,
    dynamicCaptionY: brand.subtitleStyle.yPct,
  };
}

function inferCategoryFromTopic(topic: string): QuizCategory {
  const t = topic.toLowerCase();
  if (/تاريخ|أندلس|فرعون|حضارة|history/.test(t)) return 'history';
  if (/فضاء|كوكب|علوم|طب|جسم|فيزياء|كيمياء|science/.test(t)) return 'science';
  if (/عواصم|دولة|خريطة|نهر|جغراف|geography/.test(t)) return 'geography';
  if (/ذكاء|برمجة|تقنية|كمبيوتر|ai|tech/.test(t)) return 'technology';
  if (/رياضة|كرة|كأس|ملعب|sport/.test(t)) return 'sports';
  if (/قرآن|نبي|سيرة|إسلام|رمضان/.test(t)) return 'islamic';
  if (/أدب|شعر|لغة|رواية/.test(t)) return 'literature';
  if (/حساب|رياضيات|هندسة|جبر/.test(t)) return 'math';
  return 'general';
}

export function mapSceneToQuizSlide(
  scene: Scene,
  episode: Episode,
  series: Series,
  sceneIndex: number,
  existingSlide?: QuestionSlide
): QuestionSlide {
  const category = inferCategoryFromTopic(series.topic);
  const hasExplicitQuiz =
    Boolean(scene.quizQuestion?.trim()) &&
    Array.isArray(scene.quizOptions) &&
    scene.quizOptions.filter((o) => o.trim().length > 0).length >= 2;

  const badgeText = `${episode.title.slice(0, 26)} · مشهد ${sceneIndex + 1}`;
  const headline = hasExplicitQuiz
    ? scene.quizQuestion!.trim()
    : scene.onScreenText[0]?.trim() || scene.narration.slice(0, 80).trim();

  const fallbackOptions: [string, string, string, string] = hasExplicitQuiz
    ? [
        scene.quizOptions![0] || 'الخيار الأول',
        scene.quizOptions![1] || 'الخيار الثاني',
        scene.quizOptions![2] || 'الخيار الثالث',
        scene.quizOptions![3] || 'الخيار الرابع',
      ]
    : [
        scene.onScreenText[1] || 'نقطة رئيسية أولى',
        scene.onScreenText[2] || 'حقيقة داعمة',
        scene.onScreenText[3] || 'تطبيق عملي',
        'خلاصة المشهد',
      ];

  return {
    ...existingSlide,
    id: existingSlide?.id || `scene-slide-${scene.id}`,
    slideType: hasExplicitQuiz ? 'multiple' : 'multiple3',
    category,
    badgeText,
    question: headline,
    imageDataUrl: scene.visualAssetUrl || existingSlide?.imageDataUrl,
    imageName: scene.visualAssetUrl ? `scene-${sceneIndex + 1}` : existingSlide?.imageName,
    imagePlacement: scene.visualAssetUrl || existingSlide?.imageDataUrl ? 'aboveBox' : undefined,
    options: fallbackOptions,
    correctIndex: hasExplicitQuiz ? (scene.quizCorrectIndex ?? 0) : 0,
    explanationText:
      scene.quizExplanation?.trim() ||
      scene.narration.trim().slice(0, 150) ||
      existingSlide?.explanationText ||
      '',
    spokenQuestion: scene.narration.trim() || headline,
    spokenAnswer: scene.quizExplanation?.trim() || scene.onScreenText[1] || '',
    episodeCliffhanger:
      sceneIndex === episode.scenes.length - 1 ? episode.publishKit.pinnedComment : undefined,
  };
}

export function mapEpisodeToQuizProject(
  episode: Episode,
  series: Series,
  existingProject?: QuizProject
): QuizProject {
  const base = existingProject ? { ...existingProject } : createDefaultProject();
  const existingSlideById = new Map((existingProject?.slides || []).map((s) => [s.id, s]));

  const slides: QuestionSlide[] =
    episode.scenes.length > 0
      ? episode.scenes.map((scene, idx) =>
          mapSceneToQuizSlide(
            scene,
            episode,
            series,
            idx,
            existingSlideById.get(`scene-slide-${scene.id}`) || existingProject?.slides[idx]
          )
        )
      : base.slides;

  const template = brandPresetToTemplatePatch(
    series.brandPreset,
    series.format,
    existingProject?.template
  );

  // Use episode hook as intro hook text if intro enabled
  if (episode.hook.trim()) {
    template.introHookText = episode.hook.trim().slice(0, 90);
  }

  const audio = existingProject?.audio ? cloneAudioSettings(existingProject.audio) : base.audio;
  if (series.brandPreset.music.volume >= 0) {
    audio.bgMusic = {
      ...audio.bgMusic,
      volume: series.brandPreset.music.volume,
    };
  }

  const projectId = episode.projectRef || existingProject?.id || `series-ep-${episode.id}`;
  const avgSceneDur =
    episode.scenes.length > 0
      ? Math.max(
          3,
          Math.min(
            12,
            Math.round(
              episode.scenes.reduce((s, sc) => s + (sc.duration || 7), 0) /
                episode.scenes.length /
                2
            )
          )
        )
      : DEFAULT_TIMING.thinkingDuration;

  return {
    ...base,
    id: projectId,
    name: `${series.name} — ${episode.title}`.slice(0, 110),
    schemaVersion: base.schemaVersion || 9,
    preferredAiVoice: episode.narration.voice || series.brandPreset.narrator.voice || 'Kore',
    slides,
    template,
    timing: existingProject?.timing
      ? existingProject.timing
      : {
          ...DEFAULT_TIMING,
          thinkingDuration: series.stylePreset === 'quizChallenge' ? avgSceneDur : 3,
          revealHoldDuration: series.stylePreset === 'quizChallenge' ? 3 : 2.5,
        },
    audio,
    publishKit: episode.publishKit,
    updatedAt: Date.now(),
  };
}

export function syncEpisodeFromQuizProject(episode: Episode, project: QuizProject): Episode {
  const updatedScenes = episode.scenes.map((scene, idx) => {
    const slide = project.slides[idx];
    if (!slide) return scene;
    return {
      ...scene,
      visualAssetUrl: slide.imageDataUrl || scene.visualAssetUrl,
      narration: slide.spokenQuestion?.trim() || scene.narration,
      quizQuestion: slide.question || scene.quizQuestion,
      quizOptions: slide.options || scene.quizOptions,
      quizCorrectIndex: slide.correctIndex ?? scene.quizCorrectIndex,
      quizExplanation: slide.explanationText || scene.quizExplanation,
    };
  });

  return {
    ...episode,
    projectRef: project.id,
    narration: {
      ...episode.narration,
      voice: project.preferredAiVoice || episode.narration.voice,
    },
    publishKit: project.publishKit || episode.publishKit,
    scenes: updatedScenes,
    updatedAt: Date.now(),
  };
}
