import { useEffect, useRef, useState } from 'react';
import type { Catalog } from '../catalog/types';
import { templateFor } from '../catalog/types';
import { FRAMES_BASE } from '../catalog/useCatalog';
import type { Card } from '../model/card';
import type { AssetCache } from '../render/assets';
import type { FontConfig } from '../render/fonts';
import { renderCard } from '../render/renderCard';
import { getImage } from '../store/db';
import { pendingThumbs, pruneThumbs, thumbKey, type Thumb } from './thumbs';

/** Width of a gallery picture in device pixels; cards are rendered at full size and shrunk. */
export const THUMB_WIDTH = 360;

function shrink(src: HTMLCanvasElement, width: number): string {
  const scale = Math.min(1, width / src.width);
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  const g = c.getContext('2d');
  if (!g) return '';
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

/**
 * Pictures of every card in the deck, rendered one at a time while `active`, cached by what they
 * were made from. Rendering stops when the gallery closes and resumes where it left off.
 */
export function useThumbnails(cards: Card[], currentId: string | null, catalog: Catalog, fonts: FontConfig, assets: AssetCache, active: boolean): Map<string, Thumb> {
  const [cache, setCache] = useState<Map<string, Thumb>>(() => new Map());
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const token = useRef(0);

  // forget deleted cards
  useEffect(() => {
    const pruned = pruneThumbs(cards, cacheRef.current);
    if (pruned !== cacheRef.current) setCache(pruned);
  }, [cards]);

  useEffect(() => {
    if (!active) return;
    const my = ++token.current;
    let cancelled = false;
    (async () => {
      for (;;) {
        const [card] = pendingThumbs(cards, cacheRef.current, fonts, currentId);
        if (!card || cancelled || my !== token.current) return;
        const key = thumbKey(card, fonts);
        let thumb: Thumb;
        try {
          const frame = catalog.frames.find((f) => f.id === card.frameId);
          if (!frame) throw new Error(`Frame ${card.frameId} is not in the catalog`);
          let userImage: HTMLImageElement | undefined;
          if (card.image) {
            const blob = await getImage(card.image.blobKey);
            if (blob) userImage = await assets.getBlobImage(card.image.blobKey, blob);
          }
          const r = await renderCard(card, { catalog, frame, template: templateFor(catalog, frame), fonts, assets, userImage, base: FRAMES_BASE });
          thumb = { key, url: shrink(r.canvas, THUMB_WIDTH), overflow: r.overflow };
        } catch (e) {
          thumb = { key, url: '', overflow: false, error: e instanceof Error ? e.message : String(e) };
        }
        if (cancelled || my !== token.current) return;
        const next = new Map(cacheRef.current);
        next.set(card.id, thumb);
        cacheRef.current = next;
        setCache(next);
        // let the browser paint between cards
        await new Promise((r) => setTimeout(r, 0));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, cards, currentId, catalog, fonts, assets]);

  return cache;
}
