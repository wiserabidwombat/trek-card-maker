import { useMemo, useState } from 'react';
import type { Catalog, CardType, Frame } from '../catalog/types';
import { CARD_TYPES } from '../catalog/types';
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
  const [affiliation, setAffiliation] = useState<string>('all');
  const [search, setSearch] = useState('');

  const affiliations = useMemo(() => {
    const set = new Set(catalog.frames.filter((f) => f.type === type).map((f) => f.affiliation));
    return [...set].sort();
  }, [catalog, type]);

  const frames = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.frames.filter(
      (f) =>
        f.type === type &&
        (affiliation === 'all' || f.affiliation === affiliation) &&
        (!q || f.sourceTitle.toLowerCase().includes(q) || f.set.toLowerCase().includes(q)),
    );
  }, [catalog, type, affiliation, search]);

  return (
    <section className="picker">
      <h2>Frame</h2>
      <div className="type-tabs">
        {CARD_TYPES.map((t) => (
          <button
            key={t}
            className={t === type ? 'tab active' : 'tab'}
            onClick={() => {
              setType(t);
              setAffiliation('all');
            }}
          >
            {LABELS[t]}
          </button>
        ))}
      </div>
      <div className="picker-filters">
        {affiliations.length > 1 && (
          <select value={affiliation} onChange={(e) => setAffiliation(e.target.value)}>
            <option value="all">All affiliations</option>
            {affiliations.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
        <input placeholder="Search source title or set" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="thumb-grid">
        {frames.map((f) => (
          <button
            key={f.id}
            className={f.id === selectedId ? 'thumb selected' : 'thumb'}
            title={`${f.set} · ${f.sourceTitle || f.id} · ${f.affiliation}`}
            onClick={() => onSelect(f)}
          >
            <img loading="lazy" src={FRAMES_BASE + f.thumb} alt={f.sourceTitle || f.id} />
            <span>{f.sourceTitle || f.id}</span>
          </button>
        ))}
        {!frames.length && <p className="muted">No frames match.</p>}
      </div>
      <p className="muted small">{frames.length} frames</p>
    </section>
  );
}
