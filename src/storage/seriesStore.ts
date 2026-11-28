import { BrandPreset, Series } from '../types/series';
import { BUILTIN_BRAND_PRESETS, migrateBrandPresetSchema, migrateSeriesSchema } from '../series/migrations';
import { idbGet, idbSet } from './projectStore';

const SERIES_LIST_IDB_KEY = 'quizpro_series_library_v1';
const SERIES_LIST_LOCAL_KEY = 'quizpro_series_library_lite_v1';
const BRAND_PRESETS_IDB_KEY = 'quizpro_series_brand_presets_v1';

function stripHeavyMediaForLocalMirror(series: Series): Series {
  return {
    ...series,
    brandPreset: {
      ...series.brandPreset,
      logo: {
        ...series.brandPreset.logo,
        dataUrl:
          series.brandPreset.logo.dataUrl && series.brandPreset.logo.dataUrl.length > 60_000
            ? undefined
            : series.brandPreset.logo.dataUrl,
      },
    },
    episodes: series.episodes.map((ep) => ({
      ...ep,
      scenes: ep.scenes.map((sc) => ({
        ...sc,
        visualAssetUrl:
          sc.visualAssetUrl && sc.visualAssetUrl.length > 24_000 ? undefined : sc.visualAssetUrl,
      })),
    })),
  };
}

function mirrorSeriesListToLocal(list: Series[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const lite = list.slice(0, 12).map(stripHeavyMediaForLocalMirror);
    localStorage.setItem(SERIES_LIST_LOCAL_KEY, JSON.stringify(lite));
  } catch {
    // ignore storage quota errors
  }
}

export async function listSeriesFromStore(): Promise<Series[]> {
  try {
    const fromIdb = await idbGet<unknown[]>(SERIES_LIST_IDB_KEY);
    if (Array.isArray(fromIdb) && fromIdb.length > 0) {
      return fromIdb.map(migrateSeriesSchema).sort((a, b) => b.updatedAt - a.updatedAt);
    }
  } catch {
    // fallback to localStorage
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(SERIES_LIST_LOCAL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map(migrateSeriesSchema).sort((a, b) => b.updatedAt - a.updatedAt);
        }
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export async function loadSeriesByIdFromStore(seriesId: string): Promise<Series | null> {
  const list = await listSeriesFromStore();
  return list.find((s) => s.id === seriesId) || null;
}

export async function saveSeriesToStore(series: Series): Promise<Series[]> {
  const migrated = migrateSeriesSchema({ ...series, updatedAt: series.updatedAt || Date.now() });
  const existing = await listSeriesFromStore();
  const filtered = existing.filter((s) => s.id !== migrated.id);
  const next = [migrated, ...filtered].slice(0, 40);
  try {
    await idbSet(SERIES_LIST_IDB_KEY, next);
  } catch {
    // ignore idb write error
  }
  mirrorSeriesListToLocal(next);
  return next;
}

export async function deleteSeriesFromStore(seriesId: string): Promise<Series[]> {
  const existing = await listSeriesFromStore();
  const next = existing.filter((s) => s.id !== seriesId);
  try {
    await idbSet(SERIES_LIST_IDB_KEY, next);
  } catch {
    // ignore
  }
  mirrorSeriesListToLocal(next);
  return next;
}

export async function loadSeriesBrandPresets(): Promise<BrandPreset[]> {
  try {
    const saved = await idbGet<unknown[]>(BRAND_PRESETS_IDB_KEY);
    if (Array.isArray(saved) && saved.length > 0) {
      const migrated = saved.map(migrateBrandPresetSchema);
      const customIds = new Set(migrated.map((b) => b.id));
      const builtins = BUILTIN_BRAND_PRESETS.filter((b) => !customIds.has(b.id));
      return [...migrated, ...builtins];
    }
  } catch {
    // ignore
  }
  return BUILTIN_BRAND_PRESETS;
}

export async function saveSeriesBrandPreset(preset: BrandPreset): Promise<BrandPreset[]> {
  const migrated = migrateBrandPresetSchema(preset);
  const existing = await loadSeriesBrandPresets();
  const next = [migrated, ...existing.filter((b) => b.id !== migrated.id)].slice(0, 24);
  try {
    await idbSet(BRAND_PRESETS_IDB_KEY, next);
  } catch {
    // ignore
  }
  return next;
}
