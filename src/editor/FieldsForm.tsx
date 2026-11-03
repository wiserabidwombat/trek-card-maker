import { useState } from 'react';
import type { Catalog } from '../catalog/types';
import { FRAMES_BASE } from '../catalog/useCatalog';
import { fieldsFor, staffingIcons, type Card, type FieldDef } from '../model/card';
import { SkillsEditor } from './SkillsEditor';

interface Props {
  card: Card;
  catalog: Catalog;
  onChange: (card: Card) => void;
}

const STAFFING_CHOICES = ['command', 'staff'];

export function FieldsForm({ card, catalog, onChange }: Props) {
  const [iconTarget, setIconTarget] = useState<string | null>(null);
  const setField = (id: string, value: string) =>
    onChange({ ...card, fields: { ...card.fields, [id]: value }, updatedAt: Date.now() });

  const insertIcon = (fieldId: string, iconId: string) => {
    const cur = card.fields[fieldId] ?? '';
    setField(fieldId, `${cur}${cur && !cur.endsWith(' ') ? ' ' : ''}{icon:${iconId}}`);
    setIconTarget(null);
  };

  const renderField = (f: FieldDef) => {
    const value = card.fields[f.id] ?? '';
    switch (f.kind) {
      case 'checkbox':
        return (
          <label className="row" key={f.id}>
            <input type="checkbox" checked={value === '1'} onChange={(e) => setField(f.id, e.target.checked ? '1' : '')} />
            {f.label}
          </label>
        );
      case 'multiline':
        return (
          <div className="field" key={f.id}>
            <div className="field-head">
              <label htmlFor={f.id}>{f.label}</label>
              <button className="link" onClick={() => setIconTarget(iconTarget === f.id ? null : f.id)}>
                {iconTarget === f.id ? 'close icons' : 'insert icon'}
              </button>
            </div>
            {iconTarget === f.id && (
              <div className="icon-palette">
                {catalog.icons.map((ic) => (
                  <button key={ic.id} title={ic.id} onClick={() => insertIcon(f.id, ic.id)}>
                    <img src={FRAMES_BASE + ic.file} alt={ic.id} />
                  </button>
                ))}
              </div>
            )}
            <textarea id={f.id} rows={f.id === 'gameText' ? 5 : 2} value={value} placeholder={f.placeholder} onChange={(e) => setField(f.id, e.target.value)} />
            {f.id === 'gameText' && <p className="hint">**bold**, *italic*, {'{icon:klingon}'}; blank line = new paragraph</p>}
          </div>
        );
      case 'number':
        return (
          <div className="field compact" key={f.id}>
            <label htmlFor={f.id}>{f.label}</label>
            <input id={f.id} inputMode="numeric" value={value} onChange={(e) => setField(f.id, e.target.value)} />
          </div>
        );
      case 'staffing': {
        const current = staffingIcons(card);
        return (
          <div className="field" key={f.id}>
            <label>{f.label}</label>
            <div className="chips">
              {current.map((id, i) => (
                <span className="chip" key={i}>
                  {id}
                  <button onClick={() => setField(f.id, current.filter((_, k) => k !== i).join(','))}>×</button>
                </span>
              ))}
              {STAFFING_CHOICES.filter((c) => catalog.icons.some((ic) => ic.id === c)).map((c) => (
                <button key={c} className="add" onClick={() => setField(f.id, [...current, c].join(','))}>
                  + {c}
                </button>
              ))}
            </div>
          </div>
        );
      }
      case 'quadrant':
        return (
          <div className="field compact" key={f.id}>
            <label htmlFor={f.id}>{f.label}</label>
            <select id={f.id} value={value} onChange={(e) => setField(f.id, e.target.value)}>
              <option value="">(keep frame's)</option>
              <option value="A">Alpha</option>
              <option value="B">Beta</option>
              <option value="G">Gamma</option>
              <option value="D">Delta</option>
            </select>
          </div>
        );
      default:
        return (
          <div className="field" key={f.id}>
            <label htmlFor={f.id}>{f.label}</label>
            <input id={f.id} value={value} placeholder={f.placeholder} onChange={(e) => setField(f.id, e.target.value)} />
          </div>
        );
    }
  };

  const defs = fieldsFor(card.type);
  const compact = defs.filter((f) => f.kind === 'number' || f.kind === 'quadrant');
  const rest = defs.filter((f) => !compact.includes(f));

  return (
    <section className="form">
      <h2>Card text</h2>
      <div className="field">
        <label htmlFor="card-name">Card name (for your deck list)</label>
        <input id="card-name" value={card.name} onChange={(e) => onChange({ ...card, name: e.target.value, updatedAt: Date.now() })} />
      </div>
      {rest.filter((f) => f.id === 'title' || f.id === 'unique' || f.id === 'subtitle' || f.id === 'species' || f.id === 'shipClass' || f.id === 'staffing').map(renderField)}
      {compact.length > 0 && <div className="compact-row">{compact.map(renderField)}</div>}
      {card.type === 'personnel' && (
        <SkillsEditor skills={card.skills} icons={catalog.icons} onChange={(skills) => onChange({ ...card, skills, updatedAt: Date.now() })} />
      )}
      {rest.filter((f) => f.id === 'requirements' || f.id === 'gameText' || f.id === 'lore' || f.id === 'collectorInfo').map(renderField)}
    </section>
  );
}
