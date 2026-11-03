import type { Card } from '../model/card';

interface Props {
  cards: Card[];
  currentId: string | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onCopiesChange: (id: string, copies: number) => void;
  onExportPdf: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
}

export function DeckList(p: Props) {
  const total = p.cards.reduce((n, c) => n + Math.max(0, c.copies), 0);
  return (
    <aside className="deck">
      <div className="deck-head">
        <h2>Cards</h2>
        <button className="primary" onClick={p.onNew}>
          + New
        </button>
      </div>
      <ul className="deck-list">
        {p.cards.map((c) => (
          <li key={c.id} className={c.id === p.currentId ? 'selected' : ''}>
            <button className="deck-name" onClick={() => p.onSelect(c.id)} title={c.fields.title}>
              <span className="deck-type">{c.type}</span>
              <span>{c.name || c.fields.title || '(untitled)'}</span>
            </button>
            <input
              className="copies"
              type="number"
              min={0}
              max={99}
              value={c.copies}
              title="Copies on the print sheet"
              onChange={(e) => p.onCopiesChange(c.id, Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
            />
            <button title="Duplicate" onClick={() => p.onDuplicate(c.id)}>
              ⧉
            </button>
            <button title="Delete" onClick={() => p.onDelete(c.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="deck-foot">
        <p className="muted small">
          {total} card{total === 1 ? '' : 's'} on {Math.max(1, Math.ceil(total / 9))} sheet{total > 9 ? 's' : ''}
        </p>
        <button className="primary" onClick={p.onExportPdf} disabled={p.busy || total === 0}>
          {p.busy ? 'Building PDF…' : 'Export print sheet (PDF)'}
        </button>
        <button onClick={p.onExportJson} disabled={!p.cards.length}>
          Export deck (JSON)
        </button>
        <label className="file-button">
          Import deck (JSON)…
          <input type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && p.onImportJson(e.target.files[0])} />
        </label>
        <button className="danger" onClick={p.onClearAll} disabled={p.busy || !p.cards.length} title="Delete every card and its image">
          Clear all…
        </button>
      </div>
    </aside>
  );
}
