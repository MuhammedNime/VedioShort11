import { getAllBankQuestions } from '../storage/questionBankVault';
import { getAllSavedProjectQuestions } from '../storage/projectStore';
import { QuestionSlide } from '../types/quiz';
import {
  computeQuestionSimilarity,
  extractSemanticTokens,
  normalizeArabicCanonical,
} from './arabicSimilarity';

export { computeQuestionSimilarity, extractSemanticTokens, normalizeArabicCanonical };

export interface DuplicateMatchItem {
  candidateIndex: number;
  candidateQuestion: string;
  matchedQuestion: string;
  sourceLabel: string;
  sourceType: 'bank' | 'project' | 'current';
  similarity: number; // 0..1
  matchType: 'exact' | 'conceptual';
}

export interface DuplicateSourceEntry {
  question: string;
  sourceLabel: string;
  sourceType: 'bank' | 'project' | 'current';
}

export async function findDuplicateMatches(
  candidateQuestions: Array<string | Pick<QuestionSlide, 'question'>>,
  options?: {
    currentSlides?: QuestionSlide[];
    includeBank?: boolean;
    includeSavedProjects?: boolean;
    excludeProjectId?: string;
    threshold?: number;
  }
): Promise<DuplicateMatchItem[]> {
  const threshold = options?.threshold ?? 0.58;
  const corpus: DuplicateSourceEntry[] = [];

  if (options?.currentSlides?.length) {
    options.currentSlides.forEach((sl, idx) => {
      const q = (sl.question || '').trim();
      if (q) {
        corpus.push({
          question: q,
          sourceLabel: `المشروع الحالي (شريحة ${idx + 1})`,
          sourceType: 'current',
        });
      }
    });
  }

  if (options?.includeBank !== false) {
    try {
      const bankItems = await getAllBankQuestions();
      for (const item of bankItems) {
        if (item.question?.trim()) {
          corpus.push({
            question: item.question.trim(),
            sourceLabel: item.usedInVideo ? 'بنك الأسئلة (مُنفّذ سابقاً)' : 'بنك الأسئلة المحفوظ',
            sourceType: 'bank',
          });
        }
      }
    } catch {
      // ignore read failure
    }
  }

  if (options?.includeSavedProjects !== false) {
    try {
      const projectQs = await getAllSavedProjectQuestions(options?.excludeProjectId);
      for (const entry of projectQs) {
        if (entry.question?.trim()) {
          corpus.push({
            question: entry.question.trim(),
            sourceLabel: `حلقة محفوظة: ${entry.projectName}`,
            sourceType: 'project',
          });
        }
      }
    } catch {
      // ignore read failure
    }
  }

  const matches: DuplicateMatchItem[] = [];
  const seenSelfNormalized = new Map<string, number>();

  candidateQuestions.forEach((rawCand, idx) => {
    const qText = (typeof rawCand === 'string' ? rawCand : rawCand.question || '').trim();
    if (!qText) return;

    let bestMatch: DuplicateMatchItem | null = null;
    for (const ref of corpus) {
      const sim = computeQuestionSimilarity(qText, ref.question);
      if (sim.score >= threshold && (!bestMatch || sim.score > bestMatch.similarity)) {
        bestMatch = {
          candidateIndex: idx,
          candidateQuestion: qText,
          matchedQuestion: ref.question,
          sourceLabel: ref.sourceLabel,
          sourceType: ref.sourceType,
          similarity: sim.score,
          matchType: sim.matchType === 'exact' ? 'exact' : 'conceptual',
        };
      }
    }

    if (!bestMatch) {
      for (const [prevText, prevIdx] of seenSelfNormalized.entries()) {
        const sim = computeQuestionSimilarity(qText, prevText);
        if (sim.score >= threshold) {
          bestMatch = {
            candidateIndex: idx,
            candidateQuestion: qText,
            matchedQuestion: prevText,
            sourceLabel: `مكرر ضمن نفس القائمة (عنصر ${prevIdx + 1})`,
            sourceType: 'current',
            similarity: sim.score,
            matchType: sim.matchType === 'exact' ? 'exact' : 'conceptual',
          };
          break;
        }
      }
    }

    seenSelfNormalized.set(qText, idx);
    if (bestMatch) {
      matches.push(bestMatch);
    }
  });

  return matches;
}
