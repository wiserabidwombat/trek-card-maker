import { useCallback, useEffect, useRef, useState } from 'react';
import type { Catalog } from '../catalog/types';
import { templateFor } from '../catalog/types';
import type { Card } from '../model/card';
import type { AssetCache } from '../render/assets';
import type { FontConfig } from '../render/fonts';
import { renderCard } from '../render/renderCard';
import { FRAMES_BASE } from '../catalog/useCatalog';
import { loadCardImages } from './cardImages';

export interface RenderState {
  /** The finished card, or null while nothing has rendered yet or after a failure. */
  canvas: HTMLCanvasElement | null;
  overflow: boolean;
  /** Body text size used and the frame's own size, in points; equal when nothing was shrunk. */
  textPt: number;
  basePt: number;
  error: string | null;
  busy: boolean;
  /** Render the current card again (after a failed fetch, for example). */
  retry: () => void;
}

export function useRenderer(card: Card | null, catalog: Catalog, fonts: FontConfig, assets: AssetCache): RenderState {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const [state, setState] = useState<RenderState>({ canvas: null, overflow: false, textPt: 0, basePt: 0, error: null, busy: false, retry });
  const token = useRef(0);

  useEffect(() => {
    if (!card) return;
    const my = ++token.current;
    setState((s) => ({ ...s, busy: true }));
    const timer = setTimeout(async () => {
      try {
        const frame = catalog.frames.find((f) => f.id === card.frameId);
        if (!frame) throw new Error(`Frame ${card.frameId} is not in the catalog`);
        const template = templateFor(catalog, frame);
        const pictures = await loadCardImages(card, assets);
        const result = await renderCard(card, { catalog, frame, template, fonts, assets, ...pictures, base: FRAMES_BASE });
        if (my === token.current) setState({ canvas: result.canvas, overflow: result.overflow, textPt: result.textPt, basePt: result.basePt, error: null, busy: false, retry });
      } catch (e) {
        // Drop the previous picture: showing it under an error message made failures look like success.
        if (my === token.current) setState({ canvas: null, overflow: false, textPt: 0, basePt: 0, error: e instanceof Error ? e.message : String(e), busy: false, retry });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [card, catalog, fonts, assets, attempt, retry]);

  return state;
}
