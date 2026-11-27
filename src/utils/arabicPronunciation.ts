import { QuestionSlide } from '../types/quiz';

/**
 * Deterministic Arabic pronunciation dictionary and TTS pre-processor.
 * IMPORTANT: Never mutates visual displayed text. Outputs are strictly for TTS audio synthesis.
 */

const EXACT_PHRASE_MAP: Array<[RegExp, string]> = [
  [/صلى الله عليه وسلم|صلّى الله عليه وسلّم|\(ص\)|ﷺ/g, 'صلّى اللهُ عليهِ وسلّم'],
  [/عليه السلام|عليه السّلام|\(ع\)/g, 'عليهِ السّلام'],
  [/عليها السلام/g, 'عليها السّلام'],
  [/عليهم السلام/g, 'عليهم السّلام'],
  [/رضي الله عنه|رضى الله عنه|\(رضي\)/g, 'رضيَ اللهُ عنهُ'],
  [/رضي الله عنها/g, 'رضيَ اللهُ عنها'],
  [/رضي الله عنهم/g, 'رضيَ اللهُ عنهم'],
  [/عز وجل/g, 'عزَّ وجلّ'],
  [/سبحانه وتعالى/g, 'سبحانَهُ وتعالى'],
  [/تبارك وتعالى/g, 'تبارَكَ وتعالى'],
  [/أبو بكر الصديق/g, 'أبو بَكْرٍ الصِّدِّيق'],
  [/عمر بن الخطاب/g, 'عُمَرُ بنُ الخَطّاب'],
  [/عثمان بن عفان/g, 'عُثمانُ بنُ عَفّان'],
  [/علي بن أبي طالب/g, 'عَلِيُّ بنُ أبي طالب'],
  [/خالد بن الوليد/g, 'خالدُ بنُ الوَليد'],
  [/سيف الله المسلول/g, 'سَيْفُ اللهِ المَسْلول'],
  [/ذو النورين/g, 'ذو النُّورَيْن'],
  [/الفاروق/g, 'الفاروقُ'],
  [/أم المؤمنين/g, 'أُمُّ المُؤمِنين'],
  [/خديجة بنت خويلد/g, 'خديجةُ بنتُ خُوَيْلد'],
  [/عائشة بنت أبي بكر/g, 'عائشةُ بنتُ أبي بَكْر'],
  [/غزوة بدر/g, 'غَزْوَةُ بَدْر'],
  [/غزوة أحد/g, 'غَزْوَةُ أُحُد'],
  [/غزوة الخندق/g, 'غَزْوَةُ الخَنْدَق'],
  [/غزوة حنين/g, 'غَزْوَةُ حُنَيْن'],
  [/غزوة تبوك/g, 'غَزْوَةُ تَبُوك'],
  [/صلح الحديبية/g, 'صُلْحُ الحُدَيْبِيَة'],
  [/فتح مكة/g, 'فَتْحُ مَكَّة'],
  [/القرآن الكريم/g, 'القُرْآنِ الكَريم'],
  [/الحديث الشريف/g, 'الحَديثِ الشَّريف'],
  [/المسجد الحرام/g, 'المَسْجِدِ الحَرام'],
  [/المسجد النبوي/g, 'المَسْجِدِ النَّبَوِيّ'],
  [/المسجد الأقصى/g, 'المَسْجِدِ الأَقْصى'],
  [/ليلة القدر/g, 'لَيْلَةِ القَدْر'],
  [/الإسراء والمعراج/g, 'الإسراءِ والمِعْراج'],
  [/أبو الأنبياء/g, 'أَبو الأَنبِياء'],
  [/خاتم الأنبياء/g, 'خاتَمُ الأَنبِياء'],
  [/سورة الفاتحة/g, 'سورَةُ الفاتِحَة'],
  [/سورة البقرة/g, 'سورَةُ البَقَرَة'],
  [/سورة الإخلاص/g, 'سورَةُ الإخْلاص'],
  [/سورة الكوثر/g, 'سورَةُ الكَوْثَر'],
  [/هـ(?=\s|$|[.,،؟])/g, ' هِجْرِيّة '],
  [/ق\.م(?=\s|$|[.,،؟])/g, ' قَبْلَ الميلاد '],
  [/كم(?=\s|$|[.,،؟])/g, 'كم'],
];

const WORD_VOCALIZATION_MAP: Record<string, string> = {
  من: 'مَنْ',
  ما: 'ما',
  متى: 'مَتى',
  أين: 'أَيْنَ',
  كم: 'كَمْ',
  كيف: 'كَيْفَ',
  لماذا: 'لِماذا',
  هل: 'هَلْ',
  أي: 'أَيُّ',
  الذي: 'الَّذي',
  التي: 'الَّتي',
  الذين: 'الَّذينَ',
  أول: 'أَوَّلُ',
  أكبر: 'أَكْبَرُ',
  أصغر: 'أَصْغَرُ',
  أطول: 'أَطْوَلُ',
  أقصر: 'أَقْصَرُ',
  أسرع: 'أَسْرَعُ',
  أقدم: 'أَقْدَمُ',
  عدد: 'عَدَدُ',
  عاصمة: 'عاصِمَةُ',
  نهر: 'نَهْرُ',
  جبل: 'جَبَلُ',
  كوكب: 'كَوْكَبُ',
  سورة: 'سورَةُ',
  آية: 'آيَةً',
  سنة: 'سَنَةً',
  عام: 'عامَ',
  غزوة: 'غَزْوَةُ',
  معركة: 'مَعْرَكَةُ',
  صحابي: 'صَحابِيٌّ',
  الصحابة: 'الصَّحابَة',
  النبي: 'النَّبِيّ',
  الرسول: 'الرَّسول',
  الإسلام: 'الإسْلام',
  التاريخ: 'التّاريخ',
  العالم: 'العالَم',
  المحيط: 'المُحيط',
  البحر: 'البَحْر',
  الفضاء: 'الفَضاء',
  الشمس: 'الشَّمْس',
  القمر: 'القَمَر',
  الأرض: 'الأَرْض',
  الإنسان: 'الإنسان',
  صحيح: 'صَحيح',
  خطأ: 'خَطَأ',
  صح: 'صَحّ',
};

function hasInlineArabicDiacritics(word: string): boolean {
  return /[\u064B-\u0652\u0670]/.test(word);
}

export function normalizeLatexToSpokenArabic(text: string): string {
  let out = text;
  for (let pass = 0; pass < 3; pass++) {
    out = out.replace(/\\(?:d|t)?frac\{([^{}]+)\}\{([^{}]+)\}/g, ' $1 على $2 ');
  }
  out = out.replace(/\\sqrt\{([^{}]+)\}/g, ' الجذر التربيعي لـ $1 ');
  out = out.replace(/\^\{2\}|\^2|²/g, ' تربيع ');
  out = out.replace(/\^\{3\}|\^3|³/g, ' تكعيب ');
  out = out.replace(/\^\{([^{}]+)\}/g, ' أس $1 ');
  out = out.replace(/\^([0-9a-zA-Z])/g, ' أس $1 ');
  out = out.replace(/_\{([^{}]+)\}/g, ' $1 ');
  return out
    .replace(/\\times|×/g, ' ضرب ')
    .replace(/\\cdot/g, ' ضرب ')
    .replace(/\\div|÷/g, ' تقسيم ')
    .replace(/\\pm|±/g, ' زائد أو ناقص ')
    .replace(/\\pi|π/g, ' باي ')
    .replace(/\\theta|θ/g, ' ثيتا ')
    .replace(/\\alpha/g, ' ألفا ')
    .replace(/\\beta/g, ' بيتا ')
    .replace(/\\leq|≤/g, ' أصغر من أو يساوي ')
    .replace(/\\geq|≥/g, ' أكبر من أو يساوي ')
    .replace(/\\neq|≠/g, ' لا يساوي ')
    .replace(/\\approx|≈/g, ' يساوي تقريباً ')
    .replace(/\\infty|∞/g, ' ما لا نهاية ')
    .replace(/\\circ|\\degree|°/g, ' درجة ')
    .replace(/√/g, ' الجذر التربيعي لـ ')
    .replace(/%/g, ' بالمئة ')
    .replace(/−/g, ' ناقص ')
    .replace(/(\d|\s)-(\s|\d)/g, '$1 ناقص $2')
    .replace(/\\left|\\right/g, '')
    .replace(/\$/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\\/g, ' ')
    .replace(/\+/g, ' زائد ')
    .replace(/=/g, ' يساوي ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Enhances Arabic text strictly for TTS voice clarity:
 * - Preserves exact meaning and words without inventing content
 * - Expands math expressions and common abbreviations
 * - Applies trusted Sharia/historical vocalization dictionary
 * - Formats punctuation pauses smoothly for natural narration
 */
export function prepareArabicSpokenText(rawText: string): string {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return '';

  let spoken = normalizeLatexToSpokenArabic(trimmed);

  // Common short unit / symbol replacements that trip TTS engines
  spoken = spoken
    .replace(/(\d+)\s*م(?=\s|$|[.,،؟])/g, '$1 متر')
    .replace(/(\d+)\s*كم(?=\s|$|[.,،؟])/g, '$1 كيلومتر')
    .replace(/(\d+)\s*كجم(?=\s|$|[.,،؟])/g, '$1 كيلوجرام')
    .replace(/(\d+)\s*سم(?=\s|$|[.,،؟])/g, '$1 سنتيمتر')
    .replace(/\s*\/\s*/g, ' أو ')
    .replace(/\s*\.\.\.+\s*/g, '، ');

  for (const [pattern, replacement] of EXACT_PHRASE_MAP) {
    spoken = spoken.replace(pattern, replacement);
  }

  // Apply safe word-level vocalization only on unvocalized exact words
  spoken = spoken.replace(/[\u0621-\u064A\u064B-\u0652]+/g, (word) => {
    if (hasInlineArabicDiacritics(word)) return word;
    const mapped = WORD_VOCALIZATION_MAP[word];
    return mapped || word;
  });

  // Gentle pause formatting
  spoken = spoken
    .replace(/\s+([،؟!.:;])/g, '$1')
    .replace(/([،:])([^\s])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  return spoken;
}

export function getSlideSpokenQuestion(slide: QuestionSlide): string {
  const custom = (slide.spokenQuestion || '').trim();
  return custom ? normalizeLatexToSpokenArabic(custom) : prepareArabicSpokenText(slide.question);
}

export function getSlideSpokenOption(slide: QuestionSlide, index: number): string {
  const custom = (slide.spokenOptions?.[index] || '').trim();
  if (custom) return normalizeLatexToSpokenArabic(custom);
  return prepareArabicSpokenText(slide.options[index] || '');
}

export function getSlideSpokenAnswer(slide: QuestionSlide): string {
  const custom = (slide.spokenAnswer || '').trim();
  if (custom) return normalizeLatexToSpokenArabic(custom);
  const ansIdx = slide.slideType === 'clues' ? 3 : slide.correctIndex;
  const correctOpt = (slide.options[ansIdx] || '').trim();
  if (!correctOpt) return '';
  const spokenOpt = getSlideSpokenOption(slide, ansIdx) || prepareArabicSpokenText(correctOpt);
  return `الإجابَةُ الصَّحيحَةُ هِيَ: ${spokenOpt}`;
}
