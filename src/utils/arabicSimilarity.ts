const ARABIC_STOPWORDS = new Set([
  'ما',
  'من',
  'كم',
  'اين',
  'متى',
  'هل',
  'كيف',
  'لماذا',
  'اي',
  'هو',
  'هي',
  'هم',
  'هن',
  'انت',
  'انتم',
  'في',
  'على',
  'عن',
  'الى',
  'مع',
  'بين',
  'عند',
  'الذي',
  'التي',
  'الذين',
  'اللواتي',
  'هذا',
  'هذه',
  'ذلك',
  'تلك',
  'كان',
  'كانت',
  'يكون',
  'تكون',
  'ان',
  'او',
  'ثم',
  'ام',
  'لا',
  'لم',
  'لن',
  'قد',
  'سؤال',
  'تحدي',
  'صح',
  'خطا',
  'الاجابه',
  'الصحيحه',
  'اسم',
  'يسمى',
  'يطلق',
  'تقع',
  'يقع',
  'يوجد',
  'توجد',
  'اكثر',
  'اقل',
]);

export function normalizeArabicCanonical(text: string): string {
  return String(text || '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripArabicClitics(token: string): string {
  let w = token;
  if (
    w.length > 4 &&
    (w.startsWith('وال') || w.startsWith('بال') || w.startsWith('كال') || w.startsWith('فال'))
  ) {
    w = w.slice(3);
  } else if (w.length > 4 && w.startsWith('لل')) {
    w = w.slice(2);
  } else if (w.length > 3 && w.startsWith('ال')) {
    w = w.slice(2);
  } else if (
    w.length > 4 &&
    (w.startsWith('و') ||
      w.startsWith('ف') ||
      w.startsWith('ب') ||
      w.startsWith('ل') ||
      w.startsWith('ك'))
  ) {
    const inner = w.slice(1);
    if (!ARABIC_STOPWORDS.has(inner)) {
      w = inner;
    }
  }
  if (
    w.length > 4 &&
    (w.endsWith('ون') || w.endsWith('ين') || w.endsWith('ات') || w.endsWith('ان'))
  ) {
    w = w.slice(0, -2);
  } else if (w.length > 3 && (w.endsWith('ه') || w.endsWith('ها') || w.endsWith('هم'))) {
    w = w.replace(/(?:ها|هم|ه)$/, '');
  }
  return w;
}

export function extractSemanticTokens(text: string): string[] {
  const norm = normalizeArabicCanonical(text);
  if (!norm) return [];
  return norm
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !ARABIC_STOPWORDS.has(t))
    .map(stripArabicClitics)
    .filter((t) => t.length > 1 && !ARABIC_STOPWORDS.has(t));
}

function buildCharTrigrams(text: string): Set<string> {
  const compact = text.replace(/\s+/g, '');
  const grams = new Set<string>();
  if (compact.length < 3) {
    if (compact) grams.add(compact);
    return grams;
  }
  for (let i = 0; i <= compact.length - 3; i++) {
    grams.add(compact.slice(i, i + 3));
  }
  return grams;
}

export function computeQuestionSimilarity(aRaw: string, bRaw: string): {
  score: number;
  matchType: 'exact' | 'conceptual' | 'none';
} {
  const aNorm = normalizeArabicCanonical(aRaw);
  const bNorm = normalizeArabicCanonical(bRaw);
  if (!aNorm || !bNorm) return { score: 0, matchType: 'none' };
  if (aNorm === bNorm) return { score: 1, matchType: 'exact' };

  const aTokens = new Set(extractSemanticTokens(aRaw));
  const bTokens = new Set(extractSemanticTokens(bRaw));

  let tokenJaccard = 0;
  let minOverlap = 0;
  if (aTokens.size > 0 && bTokens.size > 0) {
    let shared = 0;
    for (const tok of aTokens) {
      if (bTokens.has(tok)) shared += 1;
    }
    const union = aTokens.size + bTokens.size - shared;
    tokenJaccard = union > 0 ? shared / union : 0;
    minOverlap = shared / Math.min(aTokens.size, bTokens.size);
  }

  const aGrams = buildCharTrigrams(aNorm);
  const bGrams = buildCharTrigrams(bNorm);
  let sharedGrams = 0;
  for (const g of aGrams) {
    if (bGrams.has(g)) sharedGrams += 1;
  }
  const diceScore =
    aGrams.size + bGrams.size > 0 ? (2 * sharedGrams) / (aGrams.size + bGrams.size) : 0;

  const combined = Math.max(
    tokenJaccard * 0.68 + diceScore * 0.32,
    minOverlap >= 0.75 && aTokens.size >= 3 && bTokens.size >= 3 ? minOverlap * 0.85 : 0,
    diceScore
  );

  if (combined >= 0.86) return { score: Math.min(1, combined), matchType: 'exact' };
  if (combined >= 0.58) return { score: combined, matchType: 'conceptual' };
  return { score: combined, matchType: 'none' };
}
