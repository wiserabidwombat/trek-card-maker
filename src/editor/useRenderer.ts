import { useEffect, useRef, useState } from 'react';
import type { Catalog } from '../catalog/types';
import { templateFor } from '../catalog/types';
import type { Card } from '../model/card';
import type { AssetCache } from '../render/assets';
import type { FontConfig } from '../render/fonts';
import { renderCard } from '../render/renderCard';
import { getImage } from '../store/db';
import { FRAMES_BASE } from '../catalog/useCatalog';

export interface RenderState {
  canvas: HTMLCanvasElement | null;
  overflow: boolean;
  error: string | null;
  busy: boolean;
}

export function useRenderer(card: Card | null, catalog: Catalog, fonts: FontConfig, assets: AssetCache): RenderState {
  const [state, setState] = useState<RenderState>({ canvas: null, overflow: false, error: null, busy: false });
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
        let userImage: HTMLImageElement | undefined;
        if (card.image) {
          const blob = await getImage(card.image.blobKey);
          if (blob) userImage = await assets.getBlobImage(card.image.blobKey, blob);
        }
        const result = await renderCard(card, { catalog, frame, template, fonts, assets, userImage, base: FRAMES_BASE });
        if (my === token.current) setState({ canvas: result.canvas, overflow: result.overflow, error: null, busy: false });
      } catch (e) {
        if (my === token.current)
          setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e), busy: false }));
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [card, catalog, fonts, assets]);

  return state;
}
