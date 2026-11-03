import type { IconDef } from '../catalog/types';
import { FRAMES_BASE } from '../catalog/useCatalog';

interface Props {
  title: string;
  choices: IconDef[];
  value: string[];
  max: number;
  onChange: (ids: string[]) => void;
}

/** Strip the group prefix for display: big-earth → earth, mission-klingon → klingon. */
export function iconLabel(id: string): string {
  return id.replace(/^(big|mission)-/, '').replace(/-/g, ' ');
}

export function IconsSection({ title, choices, value, max, onChange }: Props) {
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (value.length < max) onChange([...value, id]);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const full = value.length >= max;
  return (
    <div className="field icons-section">
      <div className="field-head">
        <label>{title}</label>
        <span className="muted small">
          {value.length}/{max} {full ? '· full' : ''}
        </span>
      </div>
      {!choices.length && <p className="muted small">No icons in the catalog yet; rerun the extractor with --rulebook.</p>}
      <div className="icon-check">
        {choices.map((ic) => {
          const on = value.includes(ic.id);
          return (
            <button
              key={ic.id}
              className={on ? 'on' : ''}
              title={iconLabel(ic.id)}
              disabled={!on && full}
              onClick={() => toggle(ic.id)}
            >
              <img src={FRAMES_BASE + ic.file} alt={iconLabel(ic.id)} />
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <div className="chips">
          {value.map((id, i) => (
            <span className="chip" key={id}>
              {i + 1}. {iconLabel(id)}
              <button onClick={() => move(i, -1)} title="Earlier">
                ↑
              </button>
              <button onClick={() => move(i, 1)} title="Later">
                ↓
              </button>
              <button onClick={() => toggle(id)} title="Remove">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
