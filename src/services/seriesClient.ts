import {
  AppendEpisodesRequest,
  CreateSeriesRequest,
  Episode,
  GenerationJob,
  Scene,
  Series,
} from '../types/series';
import { migrateSeriesSchema } from '../series/migrations';

const ENV_MAP = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const BUILD_API_BASE = (ENV_MAP.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');

function apiUrl(path: string): string {
  return BUILD_API_BASE ? `${BUILD_API_BASE}${path}` : path;
}

async function parseJsonSafe<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function createSeriesJobRequest(
  input: CreateSeriesRequest
): Promise<{ series: Series; job: GenerationJob }> {
  const res = await fetch(apiUrl('/api/series'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await parseJsonSafe<{ series?: Series; job?: GenerationJob; error?: string }>(res);
  if (!res.ok || !data.series || !data.job) {
    throw new Error(data.error || 'تعذر بدء إنشاء السلسلة على الخادم.');
  }
  return {
    series: migrateSeriesSchema(data.series),
    job: data.job,
  };
}

export async function appendEpisodesRequest(
  series: Series,
  params: AppendEpisodesRequest
): Promise<{ series: Series; job: GenerationJob }> {
  const res = await fetch(
    apiUrl(`/api/series/${encodeURIComponent(series.id)}/episodes/append`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        seriesSnapshot: series,
      }),
    }
  );
  const data = await parseJsonSafe<{ series?: Series; job?: GenerationJob; error?: string }>(res);
  if (!res.ok || !data.series || !data.job) {
    throw new Error(data.error || 'تعذر توليد الحلقات الإضافية.');
  }
  return {
    series: migrateSeriesSchema(data.series),
    job: data.job,
  };
}

export async function fetchSeriesJobStatus(
  jobId: string
): Promise<{ job: GenerationJob; series?: Series }> {
  const res = await fetch(apiUrl(`/api/series/jobs/${encodeURIComponent(jobId)}`));
  const data = await parseJsonSafe<{ job?: GenerationJob; series?: Series; error?: string }>(res);
  if (!res.ok || !data.job) {
    throw new Error(data.error || 'تعذر جلب حالة التوليد.');
  }
  return {
    job: data.job,
    series: data.series ? migrateSeriesSchema(data.series) : undefined,
  };
}

export async function fetchSeriesFromServer(seriesId: string): Promise<Series | null> {
  const res = await fetch(apiUrl(`/api/series/${encodeURIComponent(seriesId)}`));
  if (res.status === 404) return null;
  const data = await parseJsonSafe<{ series?: Series; error?: string }>(res);
  if (!res.ok || !data.series) return null;
  return migrateSeriesSchema(data.series);
}

export async function regenerateEpisodeRequest(
  series: Series,
  episodeId: string
): Promise<{ series: Series; job: GenerationJob }> {
  const res = await fetch(
    apiUrl(
      `/api/series/${encodeURIComponent(series.id)}/episodes/${encodeURIComponent(episodeId)}/regenerate`
    ),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesSnapshot: series }),
    }
  );
  const data = await parseJsonSafe<{ series?: Series; job?: GenerationJob; error?: string }>(res);
  if (!res.ok || !data.series || !data.job) {
    throw new Error(data.error || 'تعذر إعادة توليد الحلقة.');
  }
  return {
    series: migrateSeriesSchema(data.series),
    job: data.job,
  };
}

export async function regenerateSceneRequest(
  series: Series,
  episodeId: string,
  sceneId: string,
  instruction?: string
): Promise<{ series: Series; episode: Episode; scene: Scene }> {
  const res = await fetch(
    apiUrl(
      `/api/series/${encodeURIComponent(series.id)}/episodes/${encodeURIComponent(episodeId)}/scenes/${encodeURIComponent(sceneId)}/regenerate`
    ),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction, seriesSnapshot: series }),
    }
  );
  const data = await parseJsonSafe<{
    series?: Series;
    episode?: Episode;
    scene?: Scene;
    error?: string;
  }>(res);
  if (!res.ok || !data.series || !data.episode || !data.scene) {
    throw new Error(data.error || 'تعذر إعادة توليد المشهد.');
  }
  return {
    series: migrateSeriesSchema(data.series),
    episode: data.episode,
    scene: data.scene,
  };
}

export async function generateMissingEpisodeAssetsRequest(
  series: Series,
  episodeId: string
): Promise<{ series: Series; episode: Episode; generatedCount: number }> {
  const res = await fetch(
    apiUrl(
      `/api/series/${encodeURIComponent(series.id)}/episodes/${encodeURIComponent(episodeId)}/assets`
    ),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesSnapshot: series }),
    }
  );
  const data = await parseJsonSafe<{
    series?: Series;
    episode?: Episode;
    generatedCount?: number;
    error?: string;
  }>(res);
  if (!res.ok || !data.series || !data.episode) {
    throw new Error(data.error || 'تعذر توليد الأصول البصرية المفقودة.');
  }
  return {
    series: migrateSeriesSchema(data.series),
    episode: data.episode,
    generatedCount: Number(data.generatedCount || 0),
  };
}
