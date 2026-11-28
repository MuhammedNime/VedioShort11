import React, { useCallback, useEffect, useState } from 'react';
import App from './App';
import { CreateSeriesPage } from './components/series/CreateSeriesPage';
import { SeriesDashboardPage } from './components/series/SeriesDashboardPage';
import { startGlobalSeriesJobWatcher } from './services/backgroundSeriesSync';
import { isAndroidNativeApp } from './utils/nativeDownload';

type ParsedRoute =
  | { view: 'create' }
  | { view: 'series'; seriesId: string }
  | { view: 'advanced'; projectId?: string; returnSeriesId?: string };

function getNormalizedBasePath(): string {
  const base = (import.meta.env.BASE_URL || '/').trim();
  if (!base || base === '/' || base === './') return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export function parseStudioRoute(pathname: string, search: string): ParsedRoute {
  const params = new URLSearchParams(search);
  // Keep Capacitor APK Google OAuth web bridge intact
  if (!isAndroidNativeApp() && params.get('apk_login') === '1') {
    return { view: 'advanced' };
  }

  const base = getNormalizedBasePath();
  let rel = pathname || '/';
  if (base && rel.startsWith(base)) {
    rel = rel.slice(base.length) || '/';
  }
  if (!rel.startsWith('/')) rel = `/${rel}`;
  // Strip trailing slash (except root)
  if (rel.length > 1 && rel.endsWith('/')) {
    rel = rel.slice(0, -1);
  }

  if (rel === '/' || rel === '/create') {
    return { view: 'create' };
  }

  const seriesMatch = rel.match(/^\/series\/([^/]+)$/);
  if (seriesMatch) {
    return { view: 'series', seriesId: decodeURIComponent(seriesMatch[1]) };
  }

  if (rel === '/advanced') {
    return {
      view: 'advanced',
      returnSeriesId: params.get('seriesId') || undefined,
    };
  }

  const advancedMatch = rel.match(/^\/advanced\/([^/]+)$/);
  if (advancedMatch) {
    return {
      view: 'advanced',
      projectId: decodeURIComponent(advancedMatch[1]),
      returnSeriesId: params.get('seriesId') || undefined,
    };
  }

  return { view: 'create' };
}

function buildAbsoluteHref(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = getNormalizedBasePath();
  return `${base}${normalized}`;
}

export const StudioRouter: React.FC = () => {
  const [locationTick, setLocationTick] = useState(0);

  useEffect(() => {
    const onPopState = () => setLocationTick((n) => n + 1);
    window.addEventListener('popstate', onPopState);
    const stopWatcher = startGlobalSeriesJobWatcher();
    return () => {
      window.removeEventListener('popstate', onPopState);
      stopWatcher();
    };
  }, []);

  const navigate = useCallback((path: string) => {
    const href = buildAbsoluteHref(path);
    if (window.location.protocol === 'file:') {
      window.location.hash = `#${path}`;
      setLocationTick((n) => n + 1);
      return;
    }
    window.history.pushState({}, '', href);
    setLocationTick((n) => n + 1);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const currentPath =
    typeof window !== 'undefined'
      ? window.location.protocol === 'file:' && window.location.hash.startsWith('#/')
        ? window.location.hash.slice(1).split('?')[0]
        : window.location.pathname
      : '/';

  const currentSearch =
    typeof window !== 'undefined'
      ? window.location.protocol === 'file:' && window.location.hash.includes('?')
        ? `?${window.location.hash.split('?')[1]}`
        : window.location.search
      : '';

  // Depend on locationTick so re-renders always resolve current URL
  void locationTick;
  const route = parseStudioRoute(currentPath, currentSearch);

  if (route.view === 'series') {
    return <SeriesDashboardPage seriesId={route.seriesId} onNavigate={navigate} />;
  }

  if (route.view === 'advanced') {
    return (
      <App
        initialProjectId={route.projectId}
        returnLabel={route.returnSeriesId ? 'العودة للسلسلة' : 'استوديو السلاسل'}
        onBackToStudio={() =>
          navigate(
            route.returnSeriesId
              ? `/series/${encodeURIComponent(route.returnSeriesId)}`
              : '/create'
          )
        }
      />
    );
  }

  return <CreateSeriesPage onNavigate={navigate} />;
};
