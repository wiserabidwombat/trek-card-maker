import { useEffect, useState } from 'react';
import type { Frame, Template } from '../catalog/types';
import { artBoxFor } from '../catalog/types';
import type { AssetCache } from '../render/assets';
import { centredCrop } from '../render/geometry';
import { DEFAULT_ART_FILL, type Card, type CropRect } from '../model/card';
import { deleteImage, getImage, newImageKey, putImage } from '../store/db';
import { CropDialog } from './CropDialog';

interface Props {
  card: Card;
  frame: Frame;
  template: Template;
  assets: AssetCache;
  onChange: (card: Card) => void;
}

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}

/** Rotate an image blob by a multiple of 90 degrees and return a PNG blob. */
async function rotateBlob(blob: Blob, rotation: number): Promise<{ blob: Blob; w: number; h: number }> {
  const img = await loadImageFromBlob(blob);
  const swap = rotation % 180 !== 0;
  const w = swap ? img.naturalHeight : img.naturalWidth;
  const h = swap ? img.naturalWidth : img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  g.translate(w / 2, h / 2);
  g.rotate((rotation * Math.PI) / 180);
  g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!out) throw new Error('Could not rotate image');
  return { blob: out, w, h };
}

export function ImageSection({ card, frame, template, assets, onChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const art = artBoxFor(frame, template);
  const artW = (art[2] - art[0]) * frame.w;
  const artH = (art[3] - art[1]) * frame.h;
  const aspect = artW / artH;

  useEffect(() => () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
  }, [cropSrc]);

  const pick = async (file: File) => {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError('Please choose a PNG, JPEG or WebP image.');
      return;
    }
    try {
      const img = await loadImageFromBlob(file);
      const key = newImageKey();
      await putImage(key, file);
      if (card.image) {
        assets.dropBlob(card.image.blobKey);
        await deleteImage(card.image.blobKey).catch(() => undefined);
      }
      onChange({
        ...card,
        image: { blobKey: key, crop: centredCrop(img.naturalWidth, img.naturalHeight, aspect), srcW: img.naturalWidth, srcH: img.naturalHeight },
        updatedAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const openCrop = async () => {
    if (!card.image) return;
    const blob = await getImage(card.image.blobKey);
    if (!blob) {
      setError('The stored image is missing. Choose it again.');
      return;
    }
    setCropSrc(URL.createObjectURL(blob));
  };

  const applyCrop = async (crop: CropRect, rotation: number) => {
    if (!card.image) return;
    setCropSrc(null);
    if (rotation % 360 === 0) {
      onChange({ ...card, image: { ...card.image, crop }, updatedAt: Date.now() });
      return;
    }
    const blob = await getImage(card.image.blobKey);
    if (!blob) return;
    const rotated = await rotateBlob(blob, rotation);
    const key = newImageKey();
    await putImage(key, rotated.blob);
    assets.dropBlob(card.image.blobKey);
    await deleteImage(card.image.blobKey).catch(() => undefined);
    onChange({ ...card, image: { blobKey: key, crop, srcW: rotated.w, srcH: rotated.h }, updatedAt: Date.now() });
  };

  const remove = async () => {
    if (!card.image) return;
    assets.dropBlob(card.image.blobKey);
    await deleteImage(card.image.blobKey).catch(() => undefined);
    const { image: _drop, ...rest } = card;
    onChange({ ...rest, updatedAt: Date.now() });
  };

  const lowRes = card.image && card.image.crop.w < artW * 0.9;

  return (
    <section className="image-section">
      <h2>Artwork</h2>
      <div className="row wrap">
        <label className="file-button">
          {card.image ? 'Replace image…' : 'Choose image…'}
          <input type="file" accept={ACCEPTED.join(',')} onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        </label>
        {card.image && <button onClick={openCrop}>Adjust crop</button>}
        {card.image && <button onClick={remove}>Remove</button>}
        {card.image && (
          <label className="row" title="Shown behind the picture when it is zoomed out">
            Fill
            <input
              type="color"
              value={card.image.fill ?? DEFAULT_ART_FILL}
              onChange={(e) => card.image && onChange({ ...card, image: { ...card.image, fill: e.target.value }, updatedAt: Date.now() })}
            />
          </label>
        )}
      </div>
      <p className="muted small">
        Art area is {Math.round(artW)} × {Math.round(artH)} px on this frame.
      </p>
      {lowRes && <p className="badge warn">The cropped area is smaller than the art box, so it will be upscaled.</p>}
      {error && <p className="badge error">{error}</p>}
      {cropSrc && card.image && (
        <CropDialog src={cropSrc} aspect={aspect} initial={card.image.crop} onDone={applyCrop} onCancel={() => setCropSrc(null)} />
      )}
    </section>
  );
}
