import { useEffect, useRef } from 'react';
import type { RenderState } from './useRenderer';

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

  return (
    <section className="preview">
      <div className="preview-toolbar">
        <h2>Preview</h2>
        {render.busy && <span className="badge muted">Rendering…</span>}
        {render.overflow && <span className="badge warn">Text overflows: shrunk to fit</span>}
        {render.error && <span className="badge error">{render.error}</span>}
        <button onClick={download} disabled={!render.canvas}>
          Download PNG
        </button>
      </div>
      <div className="preview-frame">
        <canvas ref={ref} className="preview-canvas" />
      </div>
    </section>
  );
}
