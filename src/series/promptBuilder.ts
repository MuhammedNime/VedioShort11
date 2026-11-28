import {
  CreateSeriesRequest,
  Episode,
  FactCheckStatus,
  Scene,
  Series,
  SeriesAudience,
  SeriesLanguage,
  SeriesStylePreset,
} from '../types/series';

export interface EpisodePlanOutline {
  index: number;
  title: string;
  angle: string;
  hookIdea: string;
  keyTakeaway: string;
}

export interface SeriesPlanPromptPayload {
  systemInstruction: string;
  userPrompt: string;
}

const AUDIENCE_LABELS: Record<SeriesAudience, string> = {
  general: 'الجمهور العام المهتم بالمعرفة والقصص القصيرة',
  youth: 'الشباب وصناع المحتوى بإيقاع عصري سريع وجذاب',
  kids: 'الأطفال والناشئة بأسلوب مبسط وآمن ومشوق',
  professionals: 'المهنيون ورواد الأعمال بلغة عملية مركزة',
  students: 'الطلاب والمتعلمون بأسلوب منظم يسهل تذكره',
};

const STYLE_LABELS: Record<SeriesStylePreset, string> = {
  educational: 'تعليمي مبسط منظم بالحقائق الواضحة',
  storytelling: 'قصصي مشوق بسرد تصاعدي جذاب',
  quizChallenge: 'تحدي مسابقات تفاعلي بأسئلة وخيارات',
  documentary: 'وثائقي قصير رصين وموثق',
  fastFacts: 'حقائق سريعة خاطفة ومكثفة',
  mythBuster: 'تصحيح المفاهيم وكشف الشائعات بالدليل',
};

const LANGUAGE_DIRECTIVES: Record<SeriesLanguage, string> = {
  ar: 'اكتب كامل المحتوى باللغة العربية الفصحى السلسة القريبة من المشاهد بدون حشو.',
  bilingual:
    'اكتب السرد والنصوص بالعربية الفصحى السلسة مع إبقاء المصطلحات التقنية أو العلمية المهمة بالإنجليزية بين قوسين عند الحاجة.',
  en: 'Write the scripts, hooks, titles, and captions in crisp, engaging English.',
};

export interface SeriesPlanPromptOptions {
  startIndex?: number;
  batchCount?: number;
  continuationFocus?: string;
}

export function buildSeriesPlanPrompt(
  req: CreateSeriesRequest,
  avoidTopics: string[] = [],
  options: SeriesPlanPromptOptions = {}
): SeriesPlanPromptPayload {
  const startIndex = Math.max(0, Math.round(options.startIndex || 0));
  const requestedBatch = options.batchCount ?? req.initialBatchCount ?? req.episodeCount ?? 3;
  const safeBatchCount = Math.max(1, Math.min(20, Math.round(requestedBatch)));
  const totalTarget = req.isOpenEnded
    ? 'مفتوحة ومستمرة (تُبنى على دفعات متواصلة بلا سقف محدد)'
    : `${Math.max(safeBatchCount, Math.round(req.episodeCount || safeBatchCount))} حلقة`;
  const safeDuration = Math.max(15, Math.min(600, Math.round(req.targetDurationSec || 45)));
  const cleanTopic = (req.topic || '').trim();
  const audienceDesc = AUDIENCE_LABELS[req.audience] || AUDIENCE_LABELS.general;
  const styleDesc = STYLE_LABELS[req.stylePreset] || STYLE_LABELS.educational;
  const langDirective = LANGUAGE_DIRECTIVES[req.language] || LANGUAGE_DIRECTIVES.ar;
  const focusNote = options.continuationFocus?.trim()
    ? `\nتركيز ومحور هذه الدفعة تحديداً: "${options.continuationFocus.trim()}"`
    : '';
  const avoidBlock =
    avoidTopics.length > 0
      ? `\nالحلقات والمحاور السابقة المنجزة (ممنوع تكرارها، ويجب البناء عليها بالتسلسل الزمني أو الموضوعي):\n${avoidTopics
          .slice(-40)
          .map((t, i) => `${i + 1}. ${t}`)
          .join('\n')}`
      : '';

  const rangeLabel =
    startIndex > 0
      ? `الحلقات من رقم ${startIndex + 1} إلى ${startIndex + safeBatchCount}`
      : `${safeBatchCount} حلقات تبدأ من الحلقة رقم 1`;

  const systemInstruction = `أنت منتج ومخرج محتوى سلاسل فيديو رقمية محترف قادر على بناء سلاسل طويلة ومترابطة (سير تاريخية، قصص أنبياء، بطولات رياضية، مناهج تعليمية ممتدة لعشرات أو مئات الحلقات).
تلتزم بالدقة الواقعية والعلمية والتاريخية وتتحقق من كل معلومة قبل إدراجها.
تجنب تماماً المقدمات المستهلكة ("في هذا الفيديو سنتعرف على...")، وافتح كل حلقة بخطاف مباشر في أول 3 ثوانٍ.`;

  const userPrompt = `صمّم خطة ${rangeLabel} ضمن سلسلة فيديو مترابطة حول الموضوع التالي:
"${cleanTopic}"

مواصفات الإنتاج:
- النطاق الكلي للسلسلة: ${totalTarget}
- عدد الحلقات المطلوب تخطيطها في هذه الدفعة: ${safeBatchCount} حلقات
- الأسلوب: ${styleDesc}
- الجمهور المستهدف: ${audienceDesc}
- المقاس البصري: ${req.format}
- مدة كل حلقة تقريباً: ${safeDuration} ثانية
- اللغة: ${langDirective}${focusNote}${avoidBlock}

المطلوب إرجاع JSON فقط بهذا الهيكل الدقيق:
{
  "seriesName": "اسم جذاب للسلسلة",
  "episodes": [
    {
      "index": ${startIndex},
      "title": "عنوان الحلقة القوي",
      "angle": "الزاوية الفريدة أو المرحلة التي تغطيها هذه الحلقة بالتسلسل دون تكرار",
      "hookIdea": "جملة خطاف قوية لأول 3 ثوانٍ",
      "keyTakeaway": "الفكرة الجوهرية والتمهيد الطبيعي للحلقة التالية"
    }
  ]
}`;

  return { systemInstruction, userPrompt };
}

export function buildEpisodeDetailPrompt(
  req: CreateSeriesRequest,
  outline: EpisodePlanOutline,
  allOutlines: EpisodePlanOutline[]
): SeriesPlanPromptPayload {
  const safeDuration = Math.max(15, Math.min(600, Math.round(req.targetDurationSec || 45)));
  const explicitScenes =
    typeof req.scenesPerEpisode === 'number' && req.scenesPerEpisode > 0
      ? Math.max(1, Math.min(30, Math.round(req.scenesPerEpisode)))
      : 0;
  const targetScenes =
    explicitScenes > 0
      ? explicitScenes
      : Math.max(4, Math.min(18, Math.round(safeDuration / 8)));
  const isQuiz = req.stylePreset === 'quizChallenge';
  const audienceDesc = AUDIENCE_LABELS[req.audience] || AUDIENCE_LABELS.general;
  const styleDesc = STYLE_LABELS[req.stylePreset] || STYLE_LABELS.educational;
  const langDirective = LANGUAGE_DIRECTIVES[req.language] || LANGUAGE_DIRECTIVES.ar;

  const siblingContext = allOutlines
    .filter((o) => o.index !== outline.index)
    .slice(-20)
    .map((o) => `- حلقة ${o.index + 1}: ${o.title} (${o.angle})`)
    .join('\n');

  const systemInstruction = `أنت كاتب سيناريو ومنتج مشاهد فيديو محترف ومعاون تدقيق حقائق.
قواعد الجودة الصارمة:
1. افتح الحلقة بخطاف صاعق أو سؤال فضولي في أول 3 ثوانٍ (hook).
2. تجنب الحشو والعبارات العامة وتكرار الحقائق من الحلقات الأخرى.
3. اختم الحلقة بخاتمة مرضية ودعوة طبيعية للتفاعل أو متابعة الحلقة القادمة.
4. لكل مشهد: اكتب نصاً منطوقاً واضحاً (narration)، وقائمة نصوص قصيرة تظهر على الشاشة (onScreenText)، ووصفاً بصرياً دقيقاً (visualPrompt).
5. قيّم دقة كل معلومة (factCheck): status ("verified" | "needs_review" | "flagged") و confidence (0..1) و flagReason عند وجود ادعاء غير مؤكد أو مبالغة أو رقم غير موثق.
6. اقترح 4 عناوين جذابة ومختلفة (titleOptions) وضع الأقوى أولاً، مع مفهومين للغلاف المصغر (thumbnailConcepts) ونص بارز ظاهر على الغلاف.`;

  const quizExtra = isQuiz
    ? `\nبما أن النمط "تحدي ومسابقات"، أضف في معظم المشاهد (quizQuestion, quizOptions من 4 خيارات, quizCorrectIndex من 0 إلى 3, quizExplanation قصير).`
    : '';

  const userPrompt = `اكتب تفاصيل الحلقة رقم ${outline.index + 1} من سلسلة "${req.topic}".
عنوان الخطة: "${outline.title}"
زاوية الحلقة: "${outline.angle}"
فكرة الخطاف: "${outline.hookIdea}"
الخلاصة: "${outline.keyTakeaway}"
${siblingContext ? `\nحلقات أخرى في السلسلة (ممنوع تكرار حقائقها):\n${siblingContext}` : ''}

الإعدادات:
- الأسلوب: ${styleDesc}
- الجمهور: ${audienceDesc}
- المقاس: ${req.format}
- المدة المستهدفة: ${safeDuration} ثانية موزعة على ${targetScenes} مشاهد متماسكة (التزم بإنتاج ${targetScenes} مشاهد متسلسلة)
- اللغة: ${langDirective}${quizExtra}

أرجع JSON فقط بالحقول التالية:
{
  "titleOptions": ["أقوى عنوان مقترح", "خيار ثانٍ", "خيار ثالث", "خيار رابع"],
  "hook": "النص الافتتاحي لأول 3 ثوانٍ",
  "script": "النص الكامل المتصل للحلقة من البداية للنهاية",
  "scenes": [
    {
      "index": 0,
      "narration": "التعليق الصوتي للمشهد",
      "onScreenText": ["سطر بصري قصير 1", "سطر بصري 2"],
      "visualPrompt": "وصف تفصيلي للمشهد البصري أو الرسم التوضيحي",
      "visualType": "${isQuiz ? 'quizCard' : 'svg'}",
      "duration": ${Math.max(4, Math.round(safeDuration / targetScenes))},
      "transition": "fade",
      "animation": "zoomIn",
      "mood": "curious",
      "factCheck": {
        "status": "verified",
        "confidence": 0.92,
        "flagReason": ""
      }${isQuiz ? ',\n      "quizQuestion": "...",\n      "quizOptions": ["...", "...", "...", "..."],\n      "quizCorrectIndex": 0,\n      "quizExplanation": "..."' : ''}
    }
  ],
  "thumbnailConcepts": [
    {
      "title": "مفهوم الغلاف الرئيسي",
      "visualPrompt": "مشهد بصري قوي عالي التباين مناسب للغلاف",
      "visibleText": "نص قصير من 2 إلى 4 كلمات يظهر على الغلاف",
      "accentColor": "#d4a73a"
    },
    {
      "title": "مفهوم غلاف بديل",
      "visualPrompt": "تكوين بصري بديل يركز على عنصر المفاجأة",
      "visibleText": "كلمة أو رقم صادم",
      "accentColor": "#00B050"
    }
  ],
  "musicMood": "حماسي ملهم",
  "publishKit": {
    "title": "أفضل عنوان نشر للحلقة",
    "description": "وصف متكامل للنشر يدعو للمشاهدة والتعليق",
    "hashtags": ["#كويز_برو", "#معلومات", "#شورتس"],
    "tags": ["موضوع الحلقة", "سلسلة معرفية", "فيديو قصير"],
    "pinnedComment": "سؤال تفاعلي ذكي للتعليق المثبت"
  }
}`;

  return { systemInstruction, userPrompt };
}

export function buildSceneRegeneratePrompt(
  series: Pick<Series, 'topic' | 'language' | 'audience' | 'stylePreset' | 'format'>,
  episode: Pick<Episode, 'title' | 'hook'>,
  scene: Scene,
  customInstruction?: string
): SeriesPlanPromptPayload {
  const langDirective = LANGUAGE_DIRECTIVES[series.language] || LANGUAGE_DIRECTIVES.ar;
  const audienceDesc = AUDIENCE_LABELS[series.audience] || AUDIENCE_LABELS.general;
  const systemInstruction = `أنت محرر مشاهد فيديو قصيرة ومختص تدقيق حقائق. أعد صياغة مشهد واحد فقط ليكون أكثر تشويقاً ووضوحاً دون المساس بترابط الحلقة.`;
  const userPrompt = `السلسلة: "${series.topic}"
الحلقة: "${episode.title}"
المشهد رقم ${scene.index + 1} الحالي:
- السرد: "${scene.narration}"
- النص على الشاشة: ${JSON.stringify(scene.onScreenText)}
- الوصف البصري: "${scene.visualPrompt}"
${customInstruction?.trim() ? `- ملاحظة المبدع: "${customInstruction.trim()}"` : ''}

الجمهور: ${audienceDesc}
اللغة: ${langDirective}

أعد توليد هذا المشهد بنسخة محسنة وأرجع JSON فقط:
{
  "narration": "...",
  "onScreenText": ["...", "..."],
  "visualPrompt": "...",
  "duration": ${scene.duration || 8},
  "transition": "${scene.transition || 'fade'}",
  "animation": "${scene.animation || 'zoomIn'}",
  "mood": "${scene.mood || 'curious'}",
  "factCheck": {
    "status": "verified",
    "confidence": 0.9,
    "flagReason": ""
  }
}`;

  return { systemInstruction, userPrompt };
}

const UNSAFE_OR_UNVERIFIED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /100%|بالمئة\s*مؤكد\s*دائماً|جميع\s+العلماء\s+أجمعوا|لا\s+أحد\s+يستطيع\s+أبداً/i,
    reason: 'تعميم مطلق يحتاج إلى صياغة أدق أو مصدر موثق.',
  },
  {
    pattern: /علاج\s+(?:نهائي|فوري|سحري)|يشفي\s+تماماً|وصفة\s+تضمن/i,
    reason: 'ادعاء طبي أو صحي غير مدعوم بتوثيق سريري.',
  },
  {
    pattern: /أرباح\s+مضمونة|ثراء\s+سريع|مضمون\s+100/i,
    reason: 'ادعاء مالي غير مضمون أو مضلل.',
  },
  {
    pattern: /بحسب\s+إحصائية\s+مجهولة|يقال\s+إن\s+\d+%\s+دون\s+مصدر/i,
    reason: 'رقم أو نسبة تحتاج لتوثيق مصدرها أو تخفيف الجزم.',
  },
];

export function evaluateFactConfidenceHeuristic(
  narration: string,
  modelFactCheck?: { status?: string; confidence?: number; flagReason?: string }
): { status: FactCheckStatus; confidence: number; flagReason?: string } {
  const clean = (narration || '').trim();
  for (const rule of UNSAFE_OR_UNVERIFIED_PATTERNS) {
    if (rule.pattern.test(clean)) {
      return {
        status: 'flagged',
        confidence: Math.min(0.45, Number(modelFactCheck?.confidence) || 0.42),
        flagReason: modelFactCheck?.flagReason?.trim() || rule.reason,
      };
    }
  }

  const rawConf =
    typeof modelFactCheck?.confidence === 'number' && Number.isFinite(modelFactCheck.confidence)
      ? Math.max(0.1, Math.min(0.99, modelFactCheck.confidence))
      : 0.88;
  const rawStatus = modelFactCheck?.status;

  if (rawStatus === 'flagged' || rawConf < 0.55) {
    return {
      status: 'flagged',
      confidence: rawConf,
      flagReason:
        modelFactCheck?.flagReason?.trim() || 'معلومة بحاجة إلى مراجعة وتدقيق يدوي قبل النشر.',
    };
  }
  if (rawStatus === 'needs_review' || rawConf < 0.78) {
    return {
      status: 'needs_review',
      confidence: rawConf,
      flagReason:
        modelFactCheck?.flagReason?.trim() || 'يُفضل مراجعة صياغة المعلومة أو تاريخها.',
    };
  }
  return {
    status: 'verified',
    confidence: rawConf,
    flagReason: modelFactCheck?.flagReason?.trim() || undefined,
  };
}
