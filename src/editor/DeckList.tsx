import { useState } from 'react';
import type { Card } from '../model/card';
import { matchesFilter } from '../model/order';
import { describeBackup, needsNudge, type BackupStatus } from '../store/backup';
import type { DeckMeta } from '../store/decks';

interface Props {
  cards: Card[];
  currentId: string | null;
  busy: boolean;
  backup: BackupStatus;
  decks: DeckMeta[];
  deckId: string;
  onSwitchDeck: (id: string) => void;
  onNewDeck: () => void;
  onRenameDeck: () => void;
  onDeleteDeck: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onMoveBy: (id: string, delta: number) => void;
  onClearAll: () => void;
  onCopiesChange: (id: string, copies: number) => void;
  onExportPdf: () => void;
  onExportTts: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onImportCsv: (file: File) => void;
}

export function DeckList(p: Props) {
  const total = p.cards.reduce((n, c) => n + Math.max(0, c.copies), 0);
  const nudge = needsNudge(p.backup);
  const [filter, setFilter] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const filtering = filter.trim() !== '';
  const visible = filtering ? p.cards.filter((c) => matchesFilter(c, filter)) : p.cards;
  return (
    <aside className="deck">
      <div className="deck-head deck-switcher">
        <select value={p.deckId} onChange={(e) => p.onSwitchDeck(e.target.value)} title="Switch deck" aria-label="Deck">
          {p.decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button onClick={p.onNewDeck} title="New deck">
          +
        </button>
        <button onClick={p.onRenameDeck} title="Rename deck">
          ✎
        </button>
      </div>
      <div className="deck-head">
        <h2>Cards</h2>
        <button className="primary" onClick={p.onNew}>
          + New
        </button>
      </div>
      {p.cards.length > 3 && (
        <input
          className="deck-filter"
          type="search"
          placeholder="Filter cards…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter cards"
        />
      )}
      {filtering && (
        <p className="muted small">
          {visible.length} of {p.cards.length} shown
        </p>
      )}
      <ul className="deck-list">
        {visible.map((c) => (
          <li
            key={c.id}
            className={[c.id === p.currentId ? 'selected' : '', dragId === c.id ? 'dragging' : ''].join(' ').trim()}
            onDragOver={(e) => {
              if (dragId && !filtering) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dragId !== c.id) p.onReorder(dragId, c.id);
              setDragId(null);
            }}
          >
            {!filtering && (
              <span
                className="drag-handle"
                draggable
                title="Drag to reorder (or Alt+↑/↓ with the card focused)"
                onDragStart={(e) => {
                  setDragId(c.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', c.id); // Firefox will not start a drag without data
                }}
                onDragEnd={() => setDragId(null)}
              >
                ⋮⋮
              </span>
            )}
            <button
              className="deck-name"
              onClick={() => p.onSelect(c.id)}
              title={c.fields.title}
              onKeyDown={(e) => {
                if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                  e.preventDefault();
                  p.onMoveBy(c.id, e.key === 'ArrowUp' ? -1 : 1);
                }
              }}
            >
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
        <button onClick={p.onExportTts} disabled={p.busy || total === 0} title="Card-sheet images for Tabletop Simulator's custom deck importer">
          Export for Tabletop Simulator…
        </button>
        <p className={nudge ? 'small backup-line warn' : 'muted small backup-line'} title="Cards live only in this browser; the JSON export is your copy">
          {describeBackup(p.backup)}
          {nudge && ' — time to export a backup'}
        </p>
        <button className={nudge ? 'attention' : ''} onClick={p.onExportJson} disabled={!p.cards.length}>
          Export deck (JSON)
        </button>
        <label className="file-button">
          Import deck (JSON)…
          <input type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && p.onImportJson(e.target.files[0])} />
        </label>
        <label className="file-button" title="Add cards from a spreadsheet saved as CSV or tab-separated text; Help has the columns and a template">
          Import cards (CSV)…
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) p.onImportCsv(f);
              e.target.value = '';
            }}
          />
        </label>
        <button className="danger" onClick={p.onClearAll} disabled={p.busy || !p.cards.length} title="Delete every card in this deck and its image">
          Clear all…
        </button>
        <button className="danger" onClick={p.onDeleteDeck} disabled={p.busy} title="Delete this deck and its cards">
          Delete deck…
        </button>
      </div>
    </aside>
  );
}
