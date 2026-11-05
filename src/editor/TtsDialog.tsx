import { useState } from 'react';
import { planTtsSheets, TTS_SHEET_MAX } from '../export/tts';

export interface TtsFile {
  name: string;
  role: 'face' | 'back';
  cols: number;
  rows: number;
  count: number;
}

export interface TtsResult {
  files: TtsFile[];
}

interface Props {
  /** Physical cards, copies included. */
  cardCount: number;
  deckName: string;
  busy: boolean;
  /** Set once the files have been saved; the dialog then shows the import steps. */
  result: TtsResult | null;
  onExport: (includeBack: boolean) => void;
  onClose: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function TtsDialog({ cardCount, deckName, busy, result, onExport, onClose }: Props) {
  const [includeBack, setIncludeBack] = useState(true);
  const plans = planTtsSheets(cardCount);
  const faces = result?.files.filter((f) => f.role === 'face') ?? [];
  const back = result?.files.find((f) => f.role === 'back');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <h2>Export for Tabletop Simulator</h2>
        {!result ? (
          <>
            <p className="muted small">
              {plural(cardCount, 'card')} (copies included) as {plural(plans.length, 'sheet image')}:{' '}
              {plans.map((p) => `${p.cols} × ${p.rows} grid with ${plural(p.count, 'card')}`).join('; ')}. Tabletop Simulator reads up to{' '}
              {TTS_SHEET_MAX} cards from one sheet.
            </p>
            <label className="row">
              <input type="checkbox" checked={includeBack} onChange={(e) => setIncludeBack(e.target.checked)} />
              Also save a plain card back (PNG) with the deck name{deckName ? ` “${deckName}”` : ''}
            </label>
            <p className="muted small">Each file downloads on its own; the browser may ask once to allow several downloads.</p>
            <div className="crop-controls">
              <span className="spacer" />
              <button onClick={onClose}>Cancel</button>
              <button className="primary" disabled={busy || cardCount === 0} onClick={() => onExport(includeBack)}>
                {busy ? 'Building sheets…' : 'Export images'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="small">
              Saved{' '}
              {result.files.map((f, i) => (
                <span key={f.name}>
                  {i > 0 && ', '}
                  <code>{f.name}</code>
                </span>
              ))}
              .
            </p>
            <p className="small">In Tabletop Simulator, once per sheet:</p>
            <ol className="steps small">
              <li>
                Objects → Components → Cards → <strong>Custom Deck</strong>.
              </li>
              <li>
                <strong>Face</strong>: the sheet file. A file on your own computer works for you alone; use the cloud button beside the box to
                upload it so other players see the cards too.
              </li>
              <li>
                <strong>Back</strong>: {back ? <code>{back.name}</code> : 'any card back image'}, and tick <strong>Back is Hidden</strong>.
              </li>
              <li>
                Grid:
                <ul>
                  {faces.map((f) => (
                    <li key={f.name}>
                      <code>{f.name}</code>: Width {f.cols}, Height {f.rows}, Number {f.count}
                    </li>
                  ))}
                </ul>
              </li>
              <li>Import. With several sheets, drop the stacks on each other to make one deck.</li>
            </ol>
            <div className="crop-controls">
              <span className="spacer" />
              <button className="primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
