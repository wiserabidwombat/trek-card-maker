import { useState } from 'react';
import type { Catalog, CardType, Frame } from '../catalog/types';
import { CARD_TYPES, framesOfType } from '../catalog/types';
import { FRAMES_BASE } from '../catalog/useCatalog';

interface Props {
  catalog: Catalog;
  selectedId: string;
  onSelect: (frame: Frame) => void;
}

const LABELS: Record<CardType, string> = {
  personnel: 'Personnel',
  ship: 'Ship',
  equipment: 'Equipment',
  event: 'Event',
  interrupt: 'Interrupt',
  mission: 'Mission',
  dilemma: 'Dilemma',
};

export function FramePicker({ catalog, selectedId, onSelect }: Props) {
  const selected = catalog.frames.find((f) => f.id === selectedId);
  const [type, setType] = useState<CardType>(selected?.type ?? 'personnel');
  const frames = framesOfType(catalog, type);

  return (
    <section className="picker">
      <h2>Frame</h2>
      <div className="type-tabs">
        {CARD_TYPES.map((t) => (
          <button key={t} className={t === type ? 'tab active' : 'tab'} onClick={() => setType(t)}>
            {LABELS[t]}
          </button>
        ))}
      </div>
      <div className="variant-grid">
        {frames.map((f) => (
          <button
            key={f.id}
            className={f.id === selectedId ? 'thumb selected' : 'thumb'}
            title={`${f.label} · ${f.family === 'hires' ? 'HiRes' : 'classic'} source`}
            onClick={() => onSelect(f)}
          >
            <img loading="lazy" src={FRAMES_BASE + f.thumb} alt={f.label} />
            <span>{f.label}</span>
          </button>
        ))}
        {!frames.length && <p className="muted">No frame for this type.</p>}
      </div>
      <p className="muted small">Icons and skills are added below, not baked into the frame.</p>
    </section>
  );
}
