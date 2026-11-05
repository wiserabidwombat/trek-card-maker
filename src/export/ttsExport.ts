import type { FontConfig } from '../render/fonts';
import { roundedRectPath } from '../render/renderCard';
import { planTtsSheets, ttsCellSize, type TtsSheetPlan } from './tts';

export interface TtsSheet extends TtsSheetPlan {
  canvas: HTMLCanvasElement;
  cellW: number;
  cellH: number;
}

/** Draw a card into a cell, halving in steps when it shrinks a lot so small text keeps its edges. */
function drawShrunk(g: CanvasRenderingContext2D, src: HTMLCanvasElement, x: number, y: number, w: number, h: number): void {
  let cur: HTMLCanvasElement = src;
  while (cur.width > w * 2) {
    const next = document.createElement('canvas');
    next.width = Math.max(w, Math.round(cur.width / 2));
    next.height = Math.max(h, Math.round(cur.height / 2));
    const ng = next.getContext('2d');
    if (!ng) break;
    ng.imageSmoothingEnabled = true;
    ng.imageSmoothingQuality = 'high';
    ng.drawImage(cur, 0, 0, next.width, next.height);
    cur = next;
  }
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(cur, 0, 0, cur.width, cur.height, x, y, w, h);
}

/** Lay rendered cards (one per physical copy, in deck order) out on Tabletop Simulator sheets. */
export function buildTtsSheets(cards: HTMLCanvasElement[]): TtsSheet[] {
  const plans = planTtsSheets(cards.length);
  let next = 0;
  return plans.map((plan) => {
    const slice = cards.slice(next, next + plan.count);
    next += plan.count;
    const first = slice[0];
    const cell = ttsCellSize({ w: first.width, h: first.height }, plan);
    const canvas = document.createElement('canvas');
    canvas.width = cell.w * plan.cols;
    canvas.height = cell.h * plan.rows;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('Canvas 2D context unavailable');
    g.fillStyle = '#000000';
    g.fillRect(0, 0, canvas.width, canvas.height);
    slice.forEach((card, i) => {
      const x = (i % plan.cols) * cell.w;
      const y = Math.floor(i / plan.cols) * cell.h;
      drawShrunk(g, card, x, y, cell.w, cell.h);
    });
    return { ...plan, canvas, cellW: cell.w, cellH: cell.h };
  });
}

/** A plain card back the size of a sheet cell: black, a thin frame and the deck name. Nothing trademarked. */
export function buildTtsBack(w: number, h: number, label: string, fonts: FontConfig): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas 2D context unavailable');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, w, h);
  const inset = w * 0.06;
  roundedRectPath(g, inset, inset, w - 2 * inset, h - 2 * inset, w * 0.045);
  g.strokeStyle = '#8fa6c8';
  g.lineWidth = Math.max(2, w * 0.008);
  g.stroke();
  const inner = w * 0.09;
  roundedRectPath(g, inner, inner, w - 2 * inner, h - 2 * inner, w * 0.03);
  g.strokeStyle = '#2d3d5a';
  g.lineWidth = Math.max(1, w * 0.004);
  g.stroke();

  const text = (label.trim() || 'Custom deck').toUpperCase();
  let size = w * 0.11;
  g.font = `italic 700 ${size}px ${fonts.title}`;
  while (g.measureText(text).width > w * 0.78 && size > w * 0.04) {
    size *= 0.94;
    g.font = `italic 700 ${size}px ${fonts.title}`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#e8eef8';
  g.fillText(text, w / 2, h / 2);
  g.font = `italic 700 ${w * 0.04}px ${fonts.title}`;
  g.fillStyle = '#8fa6c8';
  g.fillText('CUSTOM CARD', w / 2, h / 2 + size);
  return canvas;
}
