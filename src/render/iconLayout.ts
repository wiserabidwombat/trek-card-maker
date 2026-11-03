import type { IconSlot, MissionStrip } from '../catalog/types';

export interface IconPlacement {
  cx: number;
  cy: number;
  /** Width in pixels; height follows the icon's aspect ratio. */
  w: number;
}

/** Centre positions for `n` mission affiliation icons, centred on the card. */
export function missionIconPositions(n: number, strip: MissionStrip, W: number, H: number): IconPlacement[] {
  const out: IconPlacement[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ cx: W / 2 + (i - (n - 1) / 2) * strip.step * W, cy: strip.cy * H, w: strip.size * W });
  }
  return out;
}

/** Icon disc / ring boundary as a fraction of the ring radius; mirrors RING_INNER in tools/pass3.py. */
export const RING_INNER = 0.66;

/** Ring and icon placement for socket `slot`; the icon disc is `inner` of the ring diameter. */
export function slotPlacement(slot: IconSlot, W: number, H: number, inner = RING_INNER): { ring: IconPlacement; icon: IconPlacement } {
  const cx = slot.cx * W;
  const cy = slot.cy * H;
  const ring = slot.size * W;
  return { ring: { cx, cy, w: ring }, icon: { cx, cy, w: ring * inner } };
}
