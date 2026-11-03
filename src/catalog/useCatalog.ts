import { useEffect, useState } from 'react';
import type { Catalog } from './types';
import { validateCatalog } from './loader';

export const FRAMES_BASE = '/frames/';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'ready'; catalog: Catalog }
  | { status: 'missing' }
  | { status: 'error'; error: string };

export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${FRAMES_BASE}catalog.json`, { cache: 'no-cache' });
        if (res.status === 404) {
          if (!cancelled) setState({ status: 'missing' });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (text.trimStart().startsWith('<')) {
          // Vite serves index.html for unknown paths in some configurations.
          if (!cancelled) setState({ status: 'missing' });
          return;
        }
        const catalog = validateCatalog(JSON.parse(text));
        if (!cancelled) setState({ status: 'ready', catalog });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
