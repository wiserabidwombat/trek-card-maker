import { useEffect, useRef } from 'react';
import type { RenderState } from './useRenderer';
import { renderErrorHint } from '../render/errors';

interface Props {
  render: RenderState;
  filename: string;
}

export function Preview({ render, filename }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    const src = render.canvas;
    if (!el || !src) return;
    el.width = src.width;
    el.height = src.height;
    const g = el.getContext('2d');
    g?.drawImage(src, 0, 0);
  }, [render.canvas]);

  const download = () => {
    const src = render.canvas;
    if (!src) return;
    src.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename || 'card'}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  };

  const hint = render.error ? renderErrorHint(render.error) : '';

  return (
    <section className="preview">
      <div className="preview-toolbar">
        <h2>Preview</h2>
        {render.busy && <span className="badge muted">Rendering…</span>}
        {render.overflow && !render.error && <span className="badge warn">Text overflows: shrunk to fit</span>}
        <button onClick={download} disabled={!render.canvas}>
          Download PNG
        </button>
      </div>
      {render.error ? (
        // The last good render is dropped on purpose: a stale picture next to an error reads as "it worked".
        <div className="preview-error" role="alert">
          <strong>Could not draw this card</strong>
          <p>{render.error}</p>
          {hint && <p className="muted small">{hint}</p>}
          <button className="primary" onClick={render.retry} disabled={render.busy}>
            {render.busy ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : (
        <div className="preview-frame">
          <canvas ref={ref} className="preview-canvas" />
        </div>
      )}
    </section>
  );
}
