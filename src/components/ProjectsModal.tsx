import React, { useCallback, useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Cloud,
  Copy,
  Download,
  FileUp,
  FolderOpen,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { CloudSyncMeta, deleteCloudProject } from '../services/firebaseClient';
import { buildFullStudioBackup, restoreFullStudioBackup } from '../storage/backupVault';
import { CustomTemplatePreset, getDefaultCustomPreset } from '../storage/customPresets';
import {
  ProjectSummary,
  deleteProjectFromStore,
  listProjectsFromStore,
  loadProjectById,
  saveProjectToStore,
} from '../storage/projectStore';
import {
  DEFAULT_TEMPLATE,
  QuizProject,
  cloneAudioSettings,
  createBlankNewProject,
} from '../types/quiz';
import { saveOrDownloadBlob } from '../utils/nativeDownload';

interface ProjectsModalProps {
  isOpen: boolean;
  currentProject: QuizProject;
  onClose: () => void;
  onSelectProject: (proj: QuizProject) => void;
  onRenameCurrent: (name: string) => void;
  cloudUser?: User | null;
  isCloudSyncing?: boolean;
  cloudSyncMeta?: CloudSyncMeta | null;
  cloudError?: string | null;
  onCloudSignIn?: () => void;
  onCloudSignOut?: () => void;
  onCloudSyncNow?: () => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  currentProject,
  onClose,
  onSelectProject,
  onRenameCurrent,
  cloudUser,
  isCloudSyncing = false,
  cloudSyncMeta,
  cloudError,
  onCloudSignIn,
  onCloudSignOut,
  onCloudSyncNow,
}) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [editingName, setEditingName] = useState(currentProject.name);
  const [defaultPreset, setDefaultPreset] = useState<CustomTemplatePreset | null>(null);
  const [applyDefaultStyleOnNew, setApplyDefaultStyleOnNew] = useState(true);
  const [backupNotice, setBackupNotice] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const refreshLibrary = useCallback(async () => {
    await saveProjectToStore(currentProject, {
      preserveUpdatedAt: (currentProject.updatedAt || 0) === 0,
    });
    const list = await listProjectsFromStore();
    setProjects(list);
  }, [currentProject]);

  useEffect(() => {
    if (!isOpen) return;
    setEditingName(currentProject.name);
    setBackupNotice('');
    void getDefaultCustomPreset().then(setDefaultPreset);
    void refreshLibrary();
  }, [isOpen, currentProject.id, cloudSyncMeta?.lastSyncedAt]);

  useEffect(() => {
    if (!isOpen) return;
    const onCloudSynced = () => {
      void listProjectsFromStore().then(setProjects);
    };
    window.addEventListener('quizpro-cloud-synced', onCloudSynced);
    return () => window.removeEventListener('quizpro-cloud-synced', onCloudSynced);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateNew = async () => {
    await saveProjectToStore(currentProject, {
      preserveUpdatedAt: (currentProject.updatedAt || 0) === 0,
    });

    const fresh = createBlankNewProject(`مشروع جديد ${projects.length + 1}`);
    if (applyDefaultStyleOnNew) {
      const customDef = defaultPreset ?? (await getDefaultCustomPreset());
      if (customDef) {
        fresh.template = {
          ...DEFAULT_TEMPLATE,
          ...customDef.template,
        };
        if (customDef.timing) {
          fresh.timing = { ...customDef.timing };
        }
        if (customDef.audio) {
          fresh.audio = cloneAudioSettings(customDef.audio);
        }
      }
    }

    await saveProjectToStore(fresh);
    onSelectProject(fresh);
    onClose();
  };

  const handleDuplicateCurrent = async () => {
    await saveProjectToStore(currentProject, {
      preserveUpdatedAt: (currentProject.updatedAt || 0) === 0,
    });

    const baseTime = Date.now();
    const clonedSlides = currentProject.slides.map((s, idx) => ({
      ...s,
      id: `slide-${baseTime}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      options: [...s.options] as [string, string, string, string],
      optionImages: s.optionImages
        ? ([...s.optionImages] as typeof s.optionImages)
        : undefined,
      voiceover: s.voiceover
        ? {
            ...s.voiceover,
            options: s.voiceover.options
              ? ([...s.voiceover.options] as typeof s.voiceover.options)
              : undefined,
          }
        : undefined,
    }));

    const cloned: QuizProject = {
      ...currentProject,
      id: `proj-${baseTime}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${currentProject.name} (نسخة)`,
      slides: clonedSlides,
      template: {
        ...currentProject.template,
        aiPresenter: currentProject.template.aiPresenter
          ? { ...currentProject.template.aiPresenter }
          : undefined,
      },
      timing: { ...currentProject.timing },
      audio: cloneAudioSettings(currentProject.audio),
      publishKit: currentProject.publishKit
        ? {
            ...currentProject.publishKit,
            hashtags: [...currentProject.publishKit.hashtags],
            tags: [...currentProject.publishKit.tags],
          }
        : undefined,
      updatedAt: baseTime,
    };

    await saveProjectToStore(cloned);
    onSelectProject(cloned);
    onClose();
  };

  const handleOpenProject = async (id: string) => {
    if (id === currentProject.id) {
      onClose();
      return;
    }
    await saveProjectToStore(currentProject, {
      preserveUpdatedAt: (currentProject.updatedAt || 0) === 0,
    });
    const loaded = await loadProjectById(id);
    if (loaded) {
      onSelectProject(loaded);
      onClose();
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentProject.id || projects.length <= 1) return;
    const next = await deleteProjectFromStore(id);
    setProjects(next);
    void deleteCloudProject(id).catch(() => {});
  };

  const handleExportFullBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    setBackupNotice('');
    try {
      const bundle = await buildFullStudioBackup(currentProject);
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const fileName = `shorts-studio-backup-${Date.now()}.json`;
      const res = await saveOrDownloadBlob(blob, fileName, 'application/json');
      if (res.ok) {
        setBackupNotice(
          `تم حفظ نسخة احتياطية شاملة (${bundle.projects.length} مشاريع و ${bundle.customPresets.length} ستايل).`
        );
      } else {
        setBackupNotice('تعذر حفظ النسخة الاحتياطية على الجهاز.');
      }
    } catch {
      setBackupNotice('حدث خطأ أثناء تجهيز النسخة الاحتياطية.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFullBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsBackingUp(true);
    setBackupNotice('');
    try {
      const text = await file.text();
      const restored = await restoreFullStudioBackup(text);
      const nextList = await listProjectsFromStore();
      setProjects(nextList);
      onSelectProject(restored.activeProject);
      setBackupNotice(
        `تمت استعادة ${restored.restoredProjectsCount} مشروع و ${restored.restoredPresetsCount} ستايل بنجاح.`
      );
    } catch (err) {
      setBackupNotice(err instanceof Error ? err.message : 'تعذر قراءة ملف النسخة الاحتياطية.');
    } finally {
      setIsBackingUp(false);
      e.target.value = '';
    }
  };

  const formatSyncTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      dir="rtl"
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--panel)] border border-[var(--pline)] shadow-2xl overflow-hidden text-[var(--ptxt)]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--pline)]">
          <div className="flex items-center gap-2 text-sm font-bold">
            <FolderOpen className="w-4 h-4 text-[#00B050]" />
            <span>مكتبة المشاريع والحفظ السحابي</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--pmuted)] hover:text-[var(--ptxt)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[82vh] overflow-y-auto">
          {/* Firebase Cloud Sync Account Card */}
          <div className="rounded-xl bg-[var(--surface)] border border-[var(--pline)] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Cloud
                  className={`w-4 h-4 shrink-0 ${
                    cloudUser ? 'text-[#00B050]' : 'text-[var(--gold)]'
                  }`}
                />
                <span className="text-xs font-extrabold truncate">
                  {cloudUser ? 'الحفظ السحابي مفعّل بالإيميل' : 'اربط إيميلك لحفظ كل شيء'}
                </span>
              </div>
              {cloudUser && (
                <span className="px-2 py-0.5 rounded-md bg-[#00B050]/15 text-[#00B050] dark:text-[#6ee7b7] text-[10px] font-bold shrink-0">
                  متصل
                </span>
              )}
            </div>

            {cloudUser ? (
              <>
                <div className="text-[11px] text-[var(--pmuted)] flex flex-col gap-0.5">
                  <span className="font-bold text-[var(--ptxt)] truncate">
                    {cloudUser.email || cloudUser.displayName || 'حساب Google مرتبط'}
                  </span>
                  <span>
                    يُحفظ تلقائياً كل مشروع، درس، سؤال، مجلد، وستايل على هذا الإيميل.
                    {cloudSyncMeta?.lastSyncedAt
                      ? ` · آخر مزامنة: ${formatSyncTime(cloudSyncMeta.lastSyncedAt)}`
                      : ''}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isCloudSyncing}
                    onClick={onCloudSyncNow}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-[#00B050] hover:bg-[#00c85b] disabled:opacity-60 text-white text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                    <span>{isCloudSyncing ? 'جارٍ المزامنة...' : 'مزامنة الكل الآن'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isCloudSyncing}
                    onClick={onCloudSignOut}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-[var(--panel)] border border-[var(--pline)] hover:border-rose-400/60 text-[11px] font-bold text-[var(--ptxt)] transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] text-[var(--pmuted)] leading-relaxed">
                  سجّل الدخول بإيميل Google مرة واحدة ليتم حفظ جميع مشاريعك ودروسك وبنك الأسئلة
                  والستايلات على السحابة واسترجاعها تلقائياً بمجرد الدخول من أي متصفح أو جهاز.
                </p>
                <button
                  type="button"
                  disabled={isCloudSyncing}
                  onClick={onCloudSignIn}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#00B050] hover:bg-[#00c85b] disabled:opacity-60 text-white text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isCloudSyncing ? 'جارٍ تسجيل الدخول...' : 'ربط الإيميل (Google / Firebase)'}</span>
                </button>
              </>
            )}

            {cloudError && (
              <div className="px-2.5 py-1.5 rounded-lg bg-rose-500/12 border border-rose-500/35 text-[11px] text-rose-400">
                {cloudError}
              </div>
            )}
          </div>

          {/* Rename Active Project */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-[var(--pmuted)]">اسم المشروع المفتوح حالياً</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editingName}
                onChange={(e) => {
                  setEditingName(e.target.value);
                  onRenameCurrent(e.target.value);
                }}
                placeholder="اسم المشروع..."
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--pline)] focus:border-[#00B050] focus:outline-none text-xs"
              />
            </div>
          </div>

          {defaultPreset && (
            <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/35 text-[11px] text-[var(--gold)] font-semibold cursor-pointer">
              <span className="flex items-center gap-1.5 min-w-0">
                <Star className="w-3.5 h-3.5 fill-current shrink-0" />
                <span className="truncate">
                  تطبيق الستايل الافتراضي «{defaultPreset.name}» عند فتح مشروع جديد
                </span>
              </span>
              <input
                type="checkbox"
                checked={applyDefaultStyleOnNew}
                onChange={(e) => setApplyDefaultStyleOnNew(e.target.checked)}
                className="accent-[#00B050] shrink-0"
              />
            </label>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleCreateNew()}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#00B050] hover:bg-[#00c85b] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>مشروع جديد مستقل</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDuplicateCurrent()}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[var(--surface)] hover:border-[var(--gold)] border border-[var(--pline)] text-xs font-bold transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span>نسخ الحالي كمشروع جديد</span>
            </button>
          </div>

          {/* Projects List */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold text-[var(--pmuted)]">
              جميع المشاريع المحفوظة ({projects.length})
            </span>

            {projects.map((p) => {
              const isActive = p.id === currentProject.id;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-2 p-3 rounded-xl border transition-colors ${
                    isActive
                      ? 'bg-[#00B050]/14 border-[#00B050]'
                      : 'bg-[var(--surface)] border-[var(--pline)] hover:border-[var(--gold)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void handleOpenProject(p.id)}
                    className="flex-1 text-right min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate">{p.name}</span>
                      {isActive && (
                        <span className="text-[10px] font-bold text-[#00B050]">(مفتوح)</span>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--pmuted)] mt-0.5 font-mono-nums">
                      {p.slideCount} أسئلة · {p.aspectRatio}
                    </div>
                  </button>

                  {!isActive && projects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(p.id)}
                      title="حذف المشروع"
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Full Studio Backup & Restore Section */}
          <div className="rounded-xl bg-[var(--surface)] border border-[var(--pline)] p-3 flex flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-[var(--ptxt)]">
                نسخة احتياطية كملف JSON (تصدير/استعادة يدوية)
              </span>
              <span className="text-[10px] text-[var(--pmuted)] leading-relaxed">
                يمكنك أيضاً حفظ كل أعمالك في ملف احتياطي على جهازك أو استعادته بأي وقت.
              </span>
            </div>

            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleRestoreFullBackup(e)}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isBackingUp}
                onClick={() => void handleExportFullBackup()}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-[var(--panel)] border border-[var(--pline)] hover:border-[var(--gold)] disabled:opacity-60 text-[11px] font-bold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span>حفظ كل شيء</span>
              </button>
              <button
                type="button"
                disabled={isBackingUp}
                onClick={() => restoreInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-[var(--panel)] border border-[var(--pline)] hover:border-[#00B050] disabled:opacity-60 text-[11px] font-bold transition-colors cursor-pointer"
              >
                <FileUp className="w-3.5 h-3.5 text-[#00B050]" />
                <span>استعادة الكل</span>
              </button>
            </div>

            {backupNotice && (
              <div className="px-2.5 py-1.5 rounded-lg bg-[#00B050]/12 border border-[#00B050]/35 text-[11px] text-[#00B050] dark:text-[#6ee7b7]">
                {backupNotice}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
