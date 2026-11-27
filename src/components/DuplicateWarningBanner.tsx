import React from 'react';
import { AlertTriangle, Check, CheckCheck, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import { DuplicateMatchItem } from '../utils/duplicateDetector';

export type DuplicateDecision = 'pending' | 'keep' | 'skip';

interface DuplicateWarningBannerProps {
  matches: DuplicateMatchItem[];
  decisions: Record<number, DuplicateDecision>;
  onDecisionChange: (candidateIndex: number, decision: DuplicateDecision) => void;
  onAcceptAll: () => void;
  onSkipAll: () => void;
  onConfirmApply?: () => void;
  onDismiss?: () => void;
  confirmLabel?: string;
}

export const DuplicateWarningBanner: React.FC<DuplicateWarningBannerProps> = ({
  matches,
  decisions,
  onDecisionChange,
  onAcceptAll,
  onSkipAll,
  onConfirmApply,
  onDismiss,
  confirmLabel = 'تطبيق الاختيارات والمتابعة',
}) => {
  if (matches.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3.5 space-y-3 text-right">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-amber-200">
              تنبيه منع التكرار الذكي: تم رصد {matches.length}{' '}
              {matches.length === 1 ? 'سؤال مطابق أو متشابه' : 'أسئلة مطابقة أو متشابهة'}
            </h4>
            <p className="text-[11px] text-amber-200/75">
              تم فحص البنك والمشاريع المحفوظة والشرائح الحالية. اختر لكل سؤال إبقاءه أو استبعاده.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onAcceptAll}
            className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/25 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            قبول وإبقاء الكل
          </button>
          <button
            type="button"
            onClick={onSkipAll}
            className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/25 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            استبعاد المكرر كله
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="إغلاق التنبيه"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-2 pr-0.5">
        {matches.map((m) => {
          const decision = decisions[m.candidateIndex] ?? 'pending';
          const pct = Math.round(m.similarity * 100);
          return (
            <div
              key={`${m.candidateIndex}-${m.sourceType}`}
              className={`rounded-lg border p-2.5 transition-colors ${
                decision === 'skip'
                  ? 'border-rose-500/35 bg-rose-950/25 opacity-75'
                  : decision === 'keep'
                    ? 'border-emerald-500/35 bg-emerald-950/25'
                    : 'border-amber-500/25 bg-slate-900/80'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      m.matchType === 'exact'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {m.matchType === 'exact' ? 'تطابق تام' : `تشابه دلالي ${pct}%`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    سؤال رقم {m.candidateIndex + 1} · {m.sourceLabel}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onDecisionChange(m.candidateIndex, 'keep')}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border transition-colors ${
                      decision === 'keep'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-800 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    إبقاء
                  </button>
                  <button
                    type="button"
                    onClick={() => onDecisionChange(m.candidateIndex, 'skip')}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border transition-colors ${
                      decision === 'skip'
                        ? 'bg-rose-500 text-white border-rose-400'
                        : 'bg-slate-800 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    استبعاد
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-md bg-slate-950/60 border border-slate-800 px-2 py-1.5">
                  <div className="text-[10px] text-slate-400 mb-0.5">السؤال الجديد المرشح:</div>
                  <div className="text-slate-100 font-medium leading-relaxed">{m.candidateQuestion}</div>
                </div>
                <div className="rounded-md bg-slate-950/60 border border-amber-500/20 px-2 py-1.5">
                  <div className="text-[10px] text-amber-300/80 mb-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    السؤال الموجود مسبقاً:
                  </div>
                  <div className="text-amber-100/90 font-medium leading-relaxed">{m.matchedQuestion}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {onConfirmApply && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onConfirmApply}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </div>
  );
};
