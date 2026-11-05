import { useEffect, useMemo, useRef, useState } from 'react';
import type { Catalog, Template } from '../catalog/types';
import { iconsInGroup } from '../catalog/types';
import { FRAMES_BASE } from '../catalog/useCatalog';
import { DEFAULT_CREDIT, fieldsFor, maxIcons, staffingIcons, type Card, type FieldDef } from '../model/card';
import { RARITIES, formatCollector, looseCollector, parseCollector, type CollectorInfo } from '../model/collector';
import { KEYWORDS, keywordInsert, keywordsFor } from '../model/keywords';
import { IconsSection } from './IconsSection';
import { lintCard } from './lint';
import { SkillsEditor } from './SkillsEditor';
import { insertText, toggleWrap, type Edit } from './textEdit';

interface Props {
  card: Card;
  catalog: Catalog;
  template: Template | null;
  onChange: (card: Card) => void;
}

const STAFFING_CHOICES = ['command', 'staff'];

/** Ready-made openings that start most 2E game text. */
const PHRASES: { label: string; text: string; title: string }[] = [
  { label: 'Order', text: '**Order** – ', title: 'Insert a bold Order action' },
  { label: 'Interrupt', text: '**Interrupt** – ', title: 'Insert a bold Interrupt action' },
];

export function FieldsForm({ card, catalog, template, onChange }: Props) {
  const [iconTarget, setIconTarget] = useState<string | null>(null);
  const areas = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const collectorDraft = useRef<{ id: string; parts: CollectorInfo } | null>(null);
  const pending = useRef<{ id: string; start: number; end: number } | null>(null);

  // After an edit made through the toolbar, put the caret where the helper said.
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const el = areas.current[p.id];
    if (!el) return;
    el.focus();
    el.setSelectionRange(p.start, p.end);
  });

  const setField = (id: string, value: string) =>
    onChange({ ...card, fields: { ...card.fields, [id]: value }, updatedAt: Date.now() });

  const issues = useMemo(
    () =>
      lintCard(card, {
        skills: catalog.skills,
        keywords: KEYWORDS.map((k) => k.name),
        icons: iconsInGroup(catalog, 'inline').map((i) => i.id),
      }),
    [card, catalog],
  );
  const focusField = (id: string) => {
    const el = document.getElementById(id);
    if (el instanceof HTMLElement) {
      el.focus();
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  /** Apply a selection-aware edit to a text area, falling back to the end of the text when it has no selection yet. */
  const applyEdit = (fieldId: string, fn: (value: string, start: number, end: number) => Edit) => {
    const cur = card.fields[fieldId] ?? '';
    const el = areas.current[fieldId];
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    const r = fn(cur, start, end);
    pending.current = { id: fieldId, start: r.start, end: r.end };
    setField(fieldId, r.value);
  };

  const wrap = (fieldId: string, marker: string) => applyEdit(fieldId, (v, s, e) => toggleWrap(v, s, e, marker));
  const insert = (fieldId: string, text: string) => applyEdit(fieldId, (v, s, e) => insertText(v, s, e, text, { spaced: true }));

  const onTextKey = (fieldId: string) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'b') {
      e.preventDefault();
      wrap(fieldId, '**');
    } else if (key === 'i') {
      e.preventDefault();
      wrap(fieldId, '*');
    }
  };

  // Keep the text area's focus and selection when a toolbar button is pressed.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

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
              <div className="text-tools" role="toolbar" aria-label={`${f.label} formatting`}>
                <button type="button" className="bold" title="Bold (Ctrl+B)" aria-label="Bold" onMouseDown={keepFocus} onClick={() => wrap(f.id, '**')}>
                  B
                </button>
                <button type="button" className="italic" title="Italic (Ctrl+I)" aria-label="Italic" onMouseDown={keepFocus} onClick={() => wrap(f.id, '*')}>
                  I
                </button>
                <button type="button" title="Insert an en dash" aria-label="En dash" onMouseDown={keepFocus} onClick={() => insert(f.id, '–')}>
                  –
                </button>
                {f.id === 'gameText' &&
                  PHRASES.map((p) => (
                    <button type="button" key={p.label} title={p.title} onMouseDown={keepFocus} onClick={() => insert(f.id, p.text)}>
                      {p.label}
                    </button>
                  ))}
                {f.id === 'gameText' && (
                  <select
                    className="keyword-pick"
                    value=""
                    aria-label="Insert a keyword"
                    title="Insert a keyword in bold at the cursor"
                    onChange={(e) => {
                      const k = KEYWORDS.find((kw) => kw.name === e.target.value);
                      if (!k) return;
                      const ins = keywordInsert(k);
                      applyEdit(f.id, (v, s, en) => {
                        const r = insertText(v, s, en, ins.text, { spaced: true });
                        const caret = r.end - (ins.text.length - ins.caret);
                        return { value: r.value, start: caret, end: caret };
                      });
                    }}
                  >
                    <option value="">Keyword…</option>
                    {keywordsFor(card.type).map((k) => (
                      <option key={k.name} value={k.name}>
                        {k.value ? `${k.name}: …` : k.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  title="Insert an inline icon"
                  aria-expanded={iconTarget === f.id}
                  onMouseDown={keepFocus}
                  onClick={() => setIconTarget(iconTarget === f.id ? null : f.id)}
                >
                  {iconTarget === f.id ? 'close icons' : 'icon…'}
                </button>
              </div>
            </div>
            {iconTarget === f.id && (
              <div className="icon-palette">
                {iconsInGroup(catalog, 'inline').map((ic) => (
                  <button key={ic.id} title={ic.id} onMouseDown={keepFocus} onClick={() => insert(f.id, `{icon:${ic.id}}`)}>
                    <img src={FRAMES_BASE + ic.file} alt={ic.id} />
                  </button>
                ))}
              </div>
            )}
            <textarea
              id={f.id}
              ref={(el) => {
                areas.current[f.id] = el;
              }}
              rows={f.id === 'gameText' ? 5 : 2}
              value={value}
              placeholder={f.placeholder}
              onChange={(e) => setField(f.id, e.target.value)}
              onKeyDown={onTextKey(f.id)}
            />
            {f.id === 'gameText' && (
              <p className="hint">
                Select text and press Ctrl+B or Ctrl+I; blank line = new paragraph. Straight quotes, spaced hyphens and ... print as “ ” – …
              </p>
            )}
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
      case 'collector': {
        // while the boxes are being filled the stored string is partial ("25", "25 V"), so keep the parts as typed
        const draft = collectorDraft.current;
        const parts = draft && draft.id === card.id && formatCollector(draft.parts) === value ? draft.parts : looseCollector(value);
        const raw = value && !parseCollector(value) && !(draft && draft.id === card.id && formatCollector(draft.parts) === value) ? value : '';
        const setPart = (p: Partial<CollectorInfo>) => {
          const next = { ...parts, ...p };
          collectorDraft.current = { id: card.id, parts: next };
          setField(f.id, formatCollector(next));
        };
        return (
          <div className="field" key={f.id}>
            <label htmlFor={`${f.id}-set`}>{f.label}</label>
            <div className="collector-row">
              <input id={`${f.id}-set`} inputMode="numeric" placeholder="set" aria-label="Set number" value={parts?.set ?? ''} onChange={(e) => setPart({ set: e.target.value })} />
              <select id={`${f.id}-rarity`} aria-label="Rarity" value={parts?.rarity ?? ''} onChange={(e) => setPart({ rarity: e.target.value })}>
                <option value="">rarity</option>
                {RARITIES.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code} – {r.label}
                  </option>
                ))}
              </select>
              <input id={`${f.id}-number`} inputMode="numeric" placeholder="number" aria-label="Card number" value={parts?.number ?? ''} onChange={(e) => setPart({ number: e.target.value })} />
              <span className="muted small collector-print">{value ? `prints ${value}` : ''}</span>
            </div>
            {raw && (
              <p className="hint">
                Stored as “{raw}”, which is not the set-rarity-number form; filling the boxes replaces it.{' '}
                <button type="button" className="link" onClick={() => setField(f.id, '')}>
                  Clear
                </button>
              </p>
            )}
            {!raw && <p className="hint">New cards continue the set with the next number. Rarity V marks a virtual card, VP a virtual promo.</p>}
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
            {f.id === 'credit' && (
              <p className="hint">
                Prints in small capitals where the originals carry their legal notice. About 35 characters fit at full size; longer lines
                shrink.{' '}
                {!value && (
                  <button type="button" className="link" onClick={() => setField(f.id, DEFAULT_CREDIT)}>
                    Use “{DEFAULT_CREDIT}”
                  </button>
                )}
              </p>
            )}
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
      {(card.type === 'personnel' || card.type === 'ship') && (
        <IconsSection
          title="Other icons"
          choices={iconsInGroup(catalog, 'other')}
          value={card.icons}
          max={maxIcons(card.type, template)}
          onChange={(icons) => onChange({ ...card, icons, updatedAt: Date.now() })}
        />
      )}
      {card.type === 'mission' && (
        <IconsSection
          title="Affiliations"
          choices={iconsInGroup(catalog, 'missionAffiliation')}
          value={card.icons}
          max={maxIcons(card.type, template)}
          onChange={(icons) => onChange({ ...card, icons, updatedAt: Date.now() })}
        />
      )}
      {card.type === 'personnel' && (
        <SkillsEditor skills={card.skills} names={catalog.skills} onChange={(skills) => onChange({ ...card, skills, updatedAt: Date.now() })} />
      )}
      {rest.filter((f) => f.id === 'requirements' || f.id === 'hqLabel' || f.id === 'gameText' || f.id === 'lore' || f.id === 'collectorInfo' || f.id === 'credit').map(renderField)}
      <div className="lint" aria-live="polite">
        <h3>Checks</h3>
        {issues.length === 0 ? (
          <p className="muted small">Reads like a real card: nothing to point out.</p>
        ) : (
          <ul>
            {issues.map((m, i) => (
              <li key={i} className={m.level}>
                {m.field ? (
                  <button type="button" className="link" onClick={() => focusField(m.field)}>
                    {m.text}
                  </button>
                ) : (
                  m.text
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
