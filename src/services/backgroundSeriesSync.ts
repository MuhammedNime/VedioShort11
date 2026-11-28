import { listSeriesFromStore, saveSeriesToStore } from '../storage/seriesStore';
import { Series } from '../types/series';
import { fetchSeriesFromServer, fetchSeriesJobStatus } from './seriesClient';
import { pushSeriesToCloud, subscribeFirebaseUser } from './firebaseClient';
import {
  beginBackgroundTask,
  endBackgroundTask,
  notifyBackgroundCompletion,
  updateBackgroundTaskProgress,
} from './backgroundKeepAlive';

type SeriesUpdateListener = (updatedSeries: Series) => void;

const listeners = new Set<SeriesUpdateListener>();
let watcherStarted = false;
let isChecking = false;
let cloudVerified = false;
let pollTimer = 0;

export function subscribeSeriesBackgroundUpdates(cb: SeriesUpdateListener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function emitSeriesUpdate(series: Series): void {
  for (const cb of listeners) {
    try {
      cb(series);
    } catch {
      // ignore listener errors
    }
  }
}

export async function syncActiveSeriesJobsNow(): Promise<void> {
  if (typeof window === 'undefined' || isChecking) return;
  isChecking = true;
  try {
    const allSeries = await listSeriesFromStore();
    const pending = allSeries.filter(
      (s) => s.status === 'queued' || s.status === 'generating'
    );

    if (pending.length === 0) {
      endBackgroundTask('series-bg-watcher');
      return;
    }

    for (const item of pending) {
      const taskKey = `series-job-${item.id}`;
      try {
        let nextSeries: Series | undefined;
        let jobProgress = 20;
        let stageLabel = `جارٍ توليد سلسلة «${item.name}»...`;

        if (item.activeJobId) {
          const res = await fetchSeriesJobStatus(item.activeJobId);
          nextSeries = res.series;
          jobProgress = res.job.progress;
          stageLabel = res.job.stageLabel || stageLabel;
        } else {
          const fetched = await fetchSeriesFromServer(item.id);
          if (fetched) nextSeries = fetched;
        }

        if (!nextSeries) continue;

        await saveSeriesToStore(nextSeries);
        emitSeriesUpdate(nextSeries);

        const stillActive =
          nextSeries.status === 'queued' || nextSeries.status === 'generating';

        if (stillActive) {
          beginBackgroundTask('series-bg-watcher', stageLabel, jobProgress);
          updateBackgroundTaskProgress('series-bg-watcher', stageLabel, jobProgress);
        } else {
          if (cloudVerified) {
            void pushSeriesToCloud(nextSeries).catch(() => {});
          }
          const doneTitle =
            nextSeries.status === 'failed'
              ? `تعذر إكمال سلسلة «${nextSeries.name}»`
              : `اكتملت سلسلة «${nextSeries.name}»`;
          const doneBody =
            nextSeries.status === 'failed'
              ? nextSeries.error || 'يمكنك إعادة المحاولة من لوحة السلسلة.'
              : `أصبحت ${nextSeries.episodes.length} حلقات جاهزة للمعاينة والتصدير.`;

          endBackgroundTask('series-bg-watcher', {
            title: doneTitle,
            body: doneBody,
          });
          if (typeof document !== 'undefined' && document.hidden) {
            void notifyBackgroundCompletion(doneTitle, doneBody);
          }
          void taskKey;
        }
      } catch {
        // Keep active task alive on transient network drop while screen sleeps
        beginBackgroundTask(
          'series-bg-watcher',
          `بانتظار استكمال سلسلة «${item.name}»...`,
          -1
        );
      }
    }
  } finally {
    isChecking = false;
  }
}

/**
 * Starts a root-level watcher so series generation jobs keep syncing even when the user
 * switches pages, minimizes the app, or turns off the screen and comes back.
 */
export function startGlobalSeriesJobWatcher(): () => void {
  if (watcherStarted || typeof window === 'undefined') {
    return () => {};
  }
  watcherStarted = true;

  const unsubAuth = subscribeFirebaseUser((user) => {
    cloudVerified = Boolean(user?.emailVerified);
  });

  const triggerSync = () => {
    void syncActiveSeriesJobsNow();
  };

  const onVisibility = () => {
    if (!document.hidden) {
      triggerSync();
    }
  };

  window.addEventListener('focus', triggerSync);
  window.addEventListener('pageshow', triggerSync);
  window.addEventListener('online', triggerSync);
  document.addEventListener('visibilitychange', onVisibility);

  triggerSync();
  pollTimer = window.setInterval(triggerSync, 4000);

  return () => {
    watcherStarted = false;
    unsubAuth();
    window.clearInterval(pollTimer);
    window.removeEventListener('focus', triggerSync);
    window.removeEventListener('pageshow', triggerSync);
    window.removeEventListener('online', triggerSync);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
