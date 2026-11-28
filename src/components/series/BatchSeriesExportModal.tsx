import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileText, Film, Loader2, X, AlertCircle } from 'lucide-react';
import {
  ExportFormatPreference,
  ExportResolutionPreference,
  exportQuizVideo,
} from '../../canvas/videoExporter';
import { Episode, Series } from '../../types/series';
import { mapEpisodeToQuizProject } from '../../series/projectMapper';
import { saveOrDownloadBlob } from '../../utils/nativeDownload';
import { triggerHaptic } from '../../utils/haptics';
import { buildSeriesPublishBundleText, formatDurationSeconds } from './seriesHelpers';

interface BatchSeriesExportModalProps {
  isOpen: boolean;
  series: Series;
  onClose: () => void;
  onEpisodeExporting?: (episodeId: string, exporting: boolean) => void;
}

interface EpisodeExportProgressState {
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
  progressPct: number;
  message: string;
  fileName?: string;
}

export const BatchSeriesExportModal: React.FC<BatchSeriesExportModalProps> = ({
  isOpen,
  series,
  onClose,
  onEpisodeExporting,
}) => {
  const readyEpisodes = series.episodes.filter(
    (ep) => ep.scenes.length > 0 && ep.status !== 'failed' && ep.status !== 'queued'
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(() => readyEpisodes.map((e) => e.id));
  const [formatPref, setFormatPref] = useState<ExportFormatPreference>('auto');
  const [resPref, setResPref] = useState<ExportResolutionPreference>('auto');
  const [isRunning, setIsRunning] = useState(false);
  const [itemStates, setItemStates] = useState<Record<string, EpisodeExportProgressState>>({});
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      const eligible = series.episodes
        .filter((ep) => ep.scenes.length > 0 && ep.status !== 'failed' && ep.status !== 'queued')
        .map((e) => e.id);
      setSelectedIds(eligible);
      setItemStates({});
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [isOpen, series.id]);

  if (!isOpen) return null;

  const toggleEpisode = (id: string) => {
    if (isRunning) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDownloadPublishBundle = async () => {
    triggerHaptic('light');
    const chosen = readyEpisodes.filter((ep) => selectedIds.includes(ep.id));
    const txt = buildSeriesPublishBundleText(series, chosen.length > 0 ? chosen : series.episodes);
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    await saveOrDownloadBlob(blob, `${series.id}-publish-kits.txt`);
  };

  const handleStartBatchExport = async () => {
    const queue: Episode[] = readyEpisodes.filter((ep) => selectedIds.includes(ep.id));
    if (queue.length === 0 || isRunning) return;

    triggerHaptic('medium');
    setIsRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const initialMap: Record<string, EpisodeExportProgressState> = {};
    for (const ep of queue) {
      initialMap[ep.id] = { status: 'pending', progressPct: 0, message: 'في الانتظار' };
    }
    setItemStates(initialMap);

    for (const ep of queue) {
      if (controller.signal.aborted) {
        setItemStates((prev) => ({
          ...prev,
          [ep.id]: { status: 'cancelled', progressPct: 0, message: 'تم الإيقاف' },
        }));
        continue;
      }

      onEpisodeExporting?.(ep.id, true);
      setItemStates((prev) => ({
        ...prev,
        [ep.id]: { status: 'running', progressPct: 5, message: 'جارٍ التحضير...' },
      }));

      try {
        const mappedProject = mapEpisodeToQuizProject(ep, series);
        const result = await exportQuizVideo(
          mappedProject.slides,
          mappedProject.template,
          mappedProject.timing,
          mappedProject.audio,
          (prog) => {
            setItemStates((prev) => ({
              ...prev,
              [ep.id]: {
                status: 'running',
                progressPct: Math.min(99, Math.max(5, Math.round(prog.progress * 100))),
                message: prog.statusText || 'جارٍ تصيير الفيديو...',
              },
            }));
          },
          controller.signal,
          {
            formatPreference: formatPref,
            resolutionPreference: resPref,
            includeAudio: true,
          }
        );

        const safeSlug = ep.title
          .replace(/[^\p{L}\p{N}\-_ ]/gu, '')
          .trim()
          .replace(/\s+/g, '-')
          .slice(0, 36);
        const fileName = `${series.id}-ep${ep.index + 1}-${safeSlug || 'video'}.${result.extension}`;
        await saveOrDownloadBlob(result.blob, fileName);

        setItemStates((prev) => ({
          ...prev,
          [ep.id]: {
            status: 'done',
            progressPct: 100,
            message: 'تم التنزيل بنجاح',
            fileName,
          },
        }));
      } catch (err) {
        const isAborted = controller.signal.aborted;
        setItemStates((prev) => ({
          ...prev,
          [ep.id]: {
            status: isAborted ? 'cancelled' : 'error',
            progressPct: 0,
            message: isAborted
              ? 'تم الإلغاء'
              : err instanceof Error
                ? err.message
                : 'فشل تصدير الحلقة',
          },
        }));
      } finally {
        onEpisodeExporting?.(ep.id, false);
      }
    }

    setIsRunning(false);
    abortRef.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-export-modal-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--pline)] bg-[var(--panel)] text-[var(--ptxt)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--pline)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-[#00c85b]" />
            <div>
              <h2 id="batch-export-modal-title" className="text-base font-extrabold">
                التصدير الجماعي للسلسلة
              </h2>
              <p className="text-xs text-[var(--pmuted)]">
                صدّر عدة حلقات متتالية بنفس الهوية وحمّل حزمة النشر كاملة
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isRunning}
            onClick={onClose}
            aria-label="إغلاق نافذة التصدير الجماعي"
            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg border border-[var(--pline)] text-[var(--pmuted)] hover:text-[var(--ptxt)] disabled:opacity-40 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Format & Resolution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--pmuted)]">صيغة الملف</span>
              <select
                value={formatPref}
                disabled={isRunning}
                onChange={(e) => setFormatPref(e.target.value as ExportFormatPreference)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-xs sm:text-sm"
              >
                <option value="auto">تلقائي (MP4 مدعوم أولاً)</option>
                <option value="mp4">MP4 (H.264 / AAC)</option>
                <option value="webm">WebM (VP9)</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--pmuted)]">دقة الفيديو</span>
              <select
                value={resPref}
                disabled={isRunning}
                onChange={(e) => setResPref(e.target.value as ExportResolutionPreference)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-xs sm:text-sm"
              >
                <option value="auto">تلقائي حسب الجهاز</option>
                <option value="1080p">1080p عالية الجودة</option>
                <option value="720p">720p سريعة التصدير</option>
              </select>
            </label>
          </div>

          {/* Episodes Checklist */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--pmuted)]">
                اختر الحلقات ({selectedIds.length} / {readyEpisodes.length})
              </span>
              <button
                type="button"
                disabled={isRunning}
                onClick={() =>
                  setSelectedIds(
                    selectedIds.length === readyEpisodes.length
                      ? []
                      : readyEpisodes.map((e) => e.id)
                  )
                }
                className="text-xs font-bold text-[var(--gold)] hover:underline cursor-pointer disabled:opacity-40"
              >
                {selectedIds.length === readyEpisodes.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              </button>
            </div>

            {readyEpisodes.length === 0 ? (
              <p className="text-xs text-[var(--pmuted)] p-4 rounded-xl border border-[var(--pline)] bg-[var(--surface)] text-center">
                لا توجد حلقات مكتملة جاهزة للتصدير بعد.
              </p>
            ) : (
              <div className="space-y-2">
                {readyEpisodes.map((ep) => {
                  const checked = selectedIds.includes(ep.id);
                  const st = itemStates[ep.id];
                  return (
                    <div
                      key={ep.id}
                      className={`p-3 rounded-xl border transition-colors ${
                        checked
                          ? 'border-[#00B050]/55 bg-[var(--surface)]'
                          : 'border-[var(--pline)] bg-[var(--surface)]/50 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={isRunning}
                            checked={checked}
                            onChange={() => toggleEpisode(ep.id)}
                            className="w-4 h-4 accent-[#00B050] shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-extrabold truncate">
                              الحلقة {ep.index + 1}: {ep.title}
                            </p>
                            <p className="text-[11px] font-mono-nums text-[var(--pmuted)]">
                              {ep.scenes.length} مشاهد · ~{formatDurationSeconds(ep.duration)}
                            </p>
                          </div>
                        </label>

                        {st && (
                          <div className="flex items-center gap-1.5 text-xs font-bold shrink-0">
                            {st.status === 'running' && (
                              <span className="inline-flex items-center gap-1 text-[var(--gold)] font-mono-nums">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {st.progressPct}%
                              </span>
                            )}
                            {st.status === 'done' && (
                              <span className="inline-flex items-center gap-1 text-[#00c85b]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                تم
                              </span>
                            )}
                            {st.status === 'error' && (
                              <span className="inline-flex items-center gap-1 text-rose-300">
                                <AlertCircle className="w-3.5 h-3.5" />
                                خطأ
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {st && st.status === 'running' && (
                        <div className="mt-2 space-y-1">
                          <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
                            <div
                              className="h-full bg-[#00B050] transition-all"
                              style={{ width: `${st.progressPct}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-[var(--pmuted)]">{st.message}</p>
                        </div>
                      )}
                      {st && st.status === 'error' && (
                        <p className="mt-1.5 text-[11px] text-rose-300">{st.message}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3.5 border-t border-[var(--pline)] bg-[var(--surface)]">
          <button
            type="button"
            onClick={() => void handleDownloadPublishBundle()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] rounded-xl border border-[var(--pline)] hover:border-[var(--gold)]/60 text-xs font-bold cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span>تنزيل حزمة النشر والنصوص</span>
          </button>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] rounded-xl border border-rose-500/50 bg-rose-500/15 text-rose-200 text-xs font-extrabold cursor-pointer"
              >
                إيقاف التصدير
              </button>
            ) : (
              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={() => void handleStartBatchExport()}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#00B050] hover:bg-[#00c85b] disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>بدء تصدير ({selectedIds.length}) حلقات</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
