import type { Card } from '../model/card';
import type { AssetCache } from '../render/assets';
import { getImage } from '../store/db';

export interface CardImages {
  userImage?: HTMLImageElement;
  emblemImage?: HTMLImageElement;
}

/** The pictures a card stores in the browser, as images ready to draw: its artwork and a custom corner emblem. */
export async function loadCardImages(card: Card, assets: AssetCache): Promise<CardImages> {
  const out: CardImages = {};
  if (card.image) {
    const blob = await getImage(card.image.blobKey);
    if (blob) out.userImage = await assets.getBlobImage(card.image.blobKey, blob);
  }
  if (card.emblem?.blobKey) {
    const blob = await getImage(card.emblem.blobKey);
    if (blob) out.emblemImage = await assets.getBlobImage(card.emblem.blobKey, blob);
  }
  return out;
}
