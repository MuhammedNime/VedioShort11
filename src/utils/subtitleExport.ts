import {
  AudioSettings,
  QuestionSlide,
  TemplateSettings,
  TimingSettings,
  computeProjectTimeline,
  getEndCardDuration,
  getIntroHookDuration,
  getSlidesContentDuration,
} from '../types/quiz';

function formatSrtTime(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalMs = Math.round(safe * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const hr = Math.floor(totalMin / 60);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');
  return `${pad2(hr)}:${pad2(min)}:${pad2(sec)},${pad3(ms)}`;
}

function formatVttTime(seconds: number): string {
  return formatSrtTime(seconds).replace(',', '.');
}

export interface SubtitleCue {
  index: number;
  start: number;
  end: number;
  text: string;
}

export function buildProjectSubtitleCues(
  slides: QuestionSlide[],
  timing: TimingSettings,
  audio: AudioSettings,
  template: TemplateSettings
): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const pushCue = (start: number, end: number, rawText: string) => {
    const text = rawText.trim();
    if (!text) return;
    const safeStart = Math.max(0, start);
    const safeEnd = Math.max(safeStart + 0.35, end);
    cues.push({
      index: cues.length + 1,
      start: safeStart,
      end: safeEnd,
      text,
    });
  };

  const schedules = computeProjectTimeline(slides, timing, audio, template);
  const introDur = getIntroHookDuration(template, timing);
  if (introDur > 0 && slides.length > 0) {
    const hookTitle = (template.introHookText || 'اختبر معلوماتك الآن!').trim();
    const hookSub = (template.introBumperSubtitle || '').trim();
    pushCue(0, introDur - 0.05, hookSub ? `${hookTitle}\n${hookSub}` : hookTitle);
  }

  for (let i = 0; i < schedules.length; i++) {
    const sched = schedules[i];
    const slide = slides[sched.slideIndex];
    if (!slide) continue;
    const base = sched.startTime;
    const qStart = base + sched.tQuestionStart;
    const opt0Start = base + sched.tOptionStarts[0];
    const thinkStart = base + sched.tThinkingStart;
    const revealStart = base + sched.tRevealStart;
    const slideEnd = sched.endTime;

    const qText = (slide.question || '').trim();
    if (qText) {
      pushCue(qStart, Math.max(qStart + 0.5, opt0Start - 0.05), qText);
    }

    const optCount =
      slide.slideType === 'trueFalse' || slide.slideType === 'versus'
        ? 2
        : slide.slideType === 'clues' || slide.slideType === 'multiple3'
          ? 3
          : 4;
    const optionSummary = slide.options
      .slice(0, optCount)
      .map((o) => o.trim())
      .filter(Boolean)
      .join(' · ');
    if (optionSummary) {
      pushCue(opt0Start, Math.max(opt0Start + 0.5, thinkStart - 0.05), optionSummary);
    }

    const correctOpt = (slide.options[slide.correctIndex] || '').trim();
    const explanation = (slide.explanationText || '').trim();
    const revealLines = [
      correctOpt ? `الإجابة الصحيحة: ${correctOpt}` : '',
      explanation ? explanation : '',
    ]
      .filter(Boolean)
      .join('\n');
    if (revealLines) {
      pushCue(revealStart, Math.max(revealStart + 0.5, slideEnd - 0.05), revealLines);
    }
  }

  const endDur = getEndCardDuration(template, timing);
  if (endDur > 0 && slides.length > 0) {
    const contentEnd = getSlidesContentDuration(slides, timing, audio, template);
    const endText = (template.endCardText || 'شكراً لمشاهدتكم').trim();
    const poll = (template.endCommentPollText || template.endCtaText || '').trim();
    pushCue(contentEnd, contentEnd + endDur, poll ? `${endText}\n${poll}` : endText);
  }

  return cues;
}

export function generateProjectSrt(
  slides: QuestionSlide[],
  timing: TimingSettings,
  audio: AudioSettings,
  template: TemplateSettings
): string {
  const cues = buildProjectSubtitleCues(slides, timing, audio, template);
  return (
    cues
      .map(
        (c) =>
          `${c.index}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${c.text}\n`
      )
      .join('\n')
      .trim() + '\n'
  );
}

export function generateProjectVtt(
  slides: QuestionSlide[],
  timing: TimingSettings,
  audio: AudioSettings,
  template: TemplateSettings
): string {
  const cues = buildProjectSubtitleCues(slides, timing, audio, template);
  return (
    'WEBVTT\n\n' +
    cues
      .map(
        (c) =>
          `${c.index}\n${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${c.text}\n`
      )
      .join('\n')
      .trim() +
    '\n'
  );
}
