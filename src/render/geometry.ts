import type { Box } from '../catalog/types';
import type { CropRect } from '../model/card';

export function ptToPx(sizePt: number, refWidthPt: number, frameW: number): number {
  return (sizePt / refWidthPt) * frameW;
}

export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function boxToPx(b: Box, w: number, h: number): PxRect {
  return { x: b.x0 * w, y: b.y0 * h, w: (b.x1 - b.x0) * w, h: (b.y1 - b.y0) * h };
}

export interface DrawMapping {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Map a crop rectangle of a source image onto a destination rectangle with "cover" semantics:
 * the destination is filled completely without distortion; excess crop is trimmed, centred.
 */
export function coverDraw(src: { w: number; h: number }, crop: CropRect, dst: PxRect): DrawMapping {
  // clamp crop to source
  const cx0 = Math.max(0, Math.min(src.w, crop.x));
  const cy0 = Math.max(0, Math.min(src.h, crop.y));
  const cx1 = Math.max(cx0, Math.min(src.w, crop.x + crop.w));
  const cy1 = Math.max(cy0, Math.min(src.h, crop.y + crop.h));
  let sw = cx1 - cx0;
  let sh = cy1 - cy0;
  let sx = cx0;
  let sy = cy0;
  if (sw <= 0 || sh <= 0 || dst.w <= 0 || dst.h <= 0) {
    return { sx: 0, sy: 0, sw: src.w, sh: src.h, dx: dst.x, dy: dst.y, dw: dst.w, dh: dst.h };
  }
  const scale = Math.max(dst.w / sw, dst.h / sh);
  const needW = dst.w / scale;
  const needH = dst.h / scale;
  sx += (sw - needW) / 2;
  sy += (sh - needH) / 2;
  sw = needW;
  sh = needH;
  return { sx, sy, sw, sh, dx: dst.x, dy: dst.y, dw: dst.w, dh: dst.h };
}

/** Largest centred rectangle of the given aspect (w/h) inside a w x h image. */
export function centredCrop(srcW: number, srcH: number, aspect: number): CropRect {
  let w = srcW;
  let h = w / aspect;
  if (h > srcH) {
    h = srcH;
    w = h * aspect;
  }
  return { x: (srcW - w) / 2, y: (srcH - h) / 2, w, h };
}
