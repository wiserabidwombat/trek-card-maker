import { useEffect, useState } from 'react';
import { DEFAULT_CREDIT, type Card } from '../model/card';
import { numberDeck, parseCollector, RARITIES } from '../model/collector';
import { cardLabel, type DeckLint } from './deckLint';

interface Props {
  cards: Card[];
  deckName: string;
  lint: DeckLint;
  /** Jump to a card in the editor. */
  onSelect: (id: string) => void;
  /** Save several changed cards as one undoable step. */
  onApply: (updated: Card[]) => void;
  onClose: () => void;
}

/** Every card's checks in one place, the findings that only show across cards, and tools that change the whole deck. */
export function DeckChecks({ cards, deckName, lint, onSelect, onApply, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // bulk tools start from the first card that has something filled in
  const seed = cards.map((c) => parseCollector(c.fields.collectorInfo ?? '')).find(Boolean);
  const [set, setSet] = useState(seed?.set ?? '');
  const [rarity, setRarity] = useState(seed?.rarity ?? '');
  const [start, setStart] = useState(seed?.number ?? '1');
  const [credit, setCredit] = useState(cards.map((c) => (c.fields.credit ?? '').trim()).find(Boolean) ?? DEFAULT_CREDIT);

  const numberAll = () => {
    const n = Number.parseInt(start, 10);
    const infos = numberDeck(cards.length, { set, rarity, start: Number.isFinite(n) ? n : 1 });
    const now = Date.now();
    const updated = cards.filter((c, i) => (c.fields.collectorInfo ?? '') !== infos[i]).map((c) => ({ ...c, fields: { ...c.fields, collectorInfo: infos[cards.indexOf(c)] }, updatedAt: now }));
    onApply(updated);
  };
  const creditAll = () => {
    const now = Date.now();
    const value = credit.trim();
    onApply(cards.filter((c) => (c.fields.credit ?? '') !== value).map((c) => ({ ...c, fields: { ...c.fields, credit: value }, updatedAt: now })));
  };

  const jump = (id: string) => {
    onSelect(id);
    onClose();
  };
  const total = lint.warnings + lint.notes;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal checks" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Deck checks">
        <div className="help-head">
          <h2>Deck checks</h2>
          <span className="muted small">
            {deckName ? `${deckName} · ` : ''}
            {cards.length} card{cards.length === 1 ? '' : 's'} ·{' '}
            {total === 0 ? 'nothing to point out' : `${lint.warnings} warning${lint.warnings === 1 ? '' : 's'}, ${lint.notes} note${lint.notes === 1 ? '' : 's'}`}
          </span>
          <span className="spacer" />
          <button onClick={onClose}>Close</button>
        </div>
        <div className="help-body checks-body">
          {lint.deck.length > 0 && (
            <section>
              <h3>Across the deck</h3>
              <ul className="lint-list">
                {lint.deck.map((d, i) => (
                  <li key={i} className={d.level}>
                    <button type="button" className="link" onClick={() => jump(d.cardIds[0])}>
                      {d.text}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {lint.cards.length > 0 && (
            <section>
              <h3>Card by card</h3>
              {lint.cards.map(({ card, messages }) => (
                <div className="checks-card" key={card.id}>
                  <button type="button" className="link strong" onClick={() => jump(card.id)}>
                    {cardLabel(card, cards.indexOf(card))}
                  </button>
                  <ul className="lint-list">
                    {messages.map((m, i) => (
                      <li key={i} className={m.level}>
                        {m.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          {total === 0 && <p className="muted">Every card reads like a real one, and nothing clashes across the deck.</p>}

          <section className="bulk">
            <h3>Apply to every card</h3>
            <p className="muted small">Each button changes the whole deck in one step; Undo takes it back.</p>
            <div className="bulk-row">
              <input inputMode="numeric" placeholder="set" aria-label="Set number" value={set} onChange={(e) => setSet(e.target.value)} />
              <select aria-label="Rarity" value={rarity} onChange={(e) => setRarity(e.target.value)}>
                <option value="">rarity</option>
                {RARITIES.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code} – {r.label}
                  </option>
                ))}
              </select>
              <input inputMode="numeric" placeholder="from" aria-label="First card number" value={start} onChange={(e) => setStart(e.target.value)} />
              <button type="button" onClick={numberAll} disabled={!cards.length}>
                Number {cards.length} card{cards.length === 1 ? '' : 's'} in deck order
              </button>
            </div>
            <div className="bulk-row">
              <input className="grow" aria-label="Edge line" value={credit} onChange={(e) => setCredit(e.target.value)} placeholder={DEFAULT_CREDIT} />
              <button type="button" onClick={creditAll} disabled={!cards.length}>
                {credit.trim() ? 'Set this edge line everywhere' : 'Clear the edge line everywhere'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
