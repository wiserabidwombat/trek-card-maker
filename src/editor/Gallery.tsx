import { useEffect } from 'react';
import type { Card } from '../model/card';
import type { Thumb } from './thumbs';

interface Props {
  cards: Card[];
  currentId: string | null;
  deckName: string;
  thumbs: Map<string, Thumb>;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Every card in the deck as a picture; click one to edit it. */
export function Gallery({ cards, currentId, deckName, thumbs, onSelect, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const done = cards.filter((c) => thumbs.get(c.id)?.url).length;
  const total = cards.reduce((n, c) => n + Math.max(0, c.copies), 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal gallery" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Deck gallery">
        <div className="help-head">
          <h2>{deckName || 'Deck'}</h2>
          <span className="muted small">
            {cards.length} card{cards.length === 1 ? '' : 's'}, {total} with copies
            {done < cards.length ? ` · rendering ${done + 1} of ${cards.length}…` : ''}
          </span>
          <span className="spacer" />
          <button onClick={onClose}>Close</button>
        </div>
        <div className="gallery-grid">
          {cards.map((c) => {
            const t = thumbs.get(c.id);
            const label = c.name || c.fields.title || '(untitled)';
            return (
              <button
                key={c.id}
                className={c.id === currentId ? 'gallery-card selected' : 'gallery-card'}
                onClick={() => onSelect(c.id)}
                title={`Edit ${label}`}
              >
                {t?.url ? (
                  <img src={t.url} alt={label} />
                ) : (
                  <span className={t?.error ? 'gallery-blank error' : 'gallery-blank'}>{t?.error ? 'Could not draw' : 'Rendering…'}</span>
                )}
                <span className="gallery-caption">
                  <span className="deck-type">{c.type}</span>
                  <span className="gallery-name">{label}</span>
                  {c.copies !== 1 && <span className="gallery-copies">×{c.copies}</span>}
                  {t?.overflow && <span className="gallery-copies warn">text too long</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
