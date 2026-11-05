import { useState } from 'react';
import { loadPrintProfile, savePrintProfile, type PrintProfile } from '../render/printProfile';
import { loadPaper, PAPER_LIST, PAPERS, savePaper, type Paper } from '../export/paper';
import { loadBackChoice, saveBackChoice, type BackChoice } from '../export/backs';
import { BLEED_MM, loadBleed, saveBleed } from '../export/bleed';
import { clampOffset, loadBackOffset, OFFSET_LIMIT_MM, saveBackOffset, type BackOffset } from '../export/duplex';

export interface LowArt {
  name: string;
  dpi: number;
}

interface Props {
  cardCount: number;
  /** Cards whose artwork prints below 300 dpi, copies > 0 only. */
  lowArt: LowArt[];
  /** Object URL of the stored custom back, when one has been chosen. */
  customBackUrl: string | null;
  /** A new custom back picture, or null to forget the stored one. */
  onCustomBack: (file: File | null) => void;
  onExport: (profile: PrintProfile, paper: Paper, back: BackChoice, bleed: boolean, backOffset: BackOffset) => void;
  onCancel: () => void;
}

export function ExportDialog({ cardCount, lowArt, customBackUrl, onCustomBack, onExport, onCancel }: Props) {
  const [profile, setProfile] = useState<PrintProfile>(loadPrintProfile());
  const [paper, setPaper] = useState<Paper>(loadPaper());
  const [bleed, setBleed] = useState<boolean>(loadBleed());
  const chooseBleed = (on: boolean) => {
    setBleed(on);
    saveBleed(on);
  };
  const [offset, setOffset] = useState<BackOffset>(loadBackOffset());
  const chooseOffset = (o: BackOffset) => {
    setOffset(o);
    saveBackOffset(o);
  };
  const [back, setBack] = useState<BackChoice>(() => {
    const b = loadBackChoice();
    return b === 'custom' && !customBackUrl ? 'none' : b;
  });
  const choose = (p: PrintProfile) => {
    setProfile(p);
    savePrintProfile(p);
  };
  const choosePaper = (p: Paper) => {
    setPaper(p);
    savePaper(p);
  };
  const chooseBack = (b: BackChoice) => {
    setBack(b);
    saveBackChoice(b);
  };
  const pages = Math.max(1, Math.ceil(cardCount / 9));
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <h2>Export print sheet</h2>
        <p className="muted small">
          {cardCount} card{cardCount === 1 ? '' : 's'} on {pages} {PAPERS[paper].label} sheet{pages > 1 ? 's' : ''}
          {back !== 'none' ? ` plus ${pages} back page${pages > 1 ? 's' : ''}` : ''}, 63 × 88 mm each.
        </p>
        <div className="profile-choice paper-choice">
          {PAPER_LIST.map((p) => (
            <label key={p} className={paper === p ? 'on' : ''}>
              <input type="radio" name="paper" checked={paper === p} onChange={() => choosePaper(p)} />
              <span>
                <strong>{PAPERS[p].label}</strong>
                <br />
                {p === 'letter' ? '8.5 × 11 in' : '210 × 297 mm'}
              </span>
            </label>
          ))}
        </div>
        <div className="profile-choice">
          <label className={profile === 'laser' ? 'on' : ''}>
            <input type="radio" name="profile" checked={profile === 'laser'} onChange={() => choose('laser')} />
            <span>
              <strong>Laser printer</strong>
              <br />
              Standard output. Crisp toner edges need no compensation.
            </span>
          </label>
          <label className={profile === 'inkjet' ? 'on' : ''}>
            <input type="radio" name="profile" checked={profile === 'inkjet'} onChange={() => choose('inkjet')} />
            <span>
              <strong>Inkjet printer</strong>
              <br />
              Slightly heavier body text, small text 5% larger, sharpened icons, lossless images. Larger file.
            </span>
          </label>
        </div>
        <label className="row bleed-choice">
          <input type="checkbox" checked={bleed} onChange={(e) => chooseBleed(e.target.checked)} />
          <span>
            <strong>Bleed</strong>: black runs {BLEED_MM} mm past every cut line, so a cut that drifts leaves no white sliver. Cards print with
            square corners; round them with a corner punch. The cut marks do not move.
          </span>
        </label>
        <h3 className="dialog-sub">Card backs</h3>
        <div className="profile-choice back-choice">
          <label className={back === 'none' ? 'on' : ''}>
            <input type="radio" name="back" checked={back === 'none'} onChange={() => chooseBack('none')} />
            <span>
              <strong>None</strong>
              <br />
              Fronts only.
            </span>
          </label>
          <label className={back === 'plain' ? 'on' : ''}>
            <input type="radio" name="back" checked={back === 'plain'} onChange={() => chooseBack('plain')} />
            <span>
              <strong>Plain back</strong>
              <br />
              Black with a thin frame and the deck name.
            </span>
          </label>
          <label className={back === 'custom' ? 'on' : customBackUrl ? '' : 'off'}>
            <input type="radio" name="back" checked={back === 'custom'} disabled={!customBackUrl} onChange={() => chooseBack('custom')} />
            <span>
              <strong>Your picture</strong>
              <br />
              {customBackUrl ? <img className="back-thumb" src={customBackUrl} alt="Chosen card back" /> : 'Choose one below.'}
            </span>
          </label>
        </div>
        <div className="row wrap">
          <label className="file-button">
            {customBackUrl ? 'Replace back picture…' : 'Choose back picture…'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  onCustomBack(f);
                  chooseBack('custom');
                }
                e.target.value = '';
              }}
            />
          </label>
          {customBackUrl && (
            <button
              onClick={() => {
                onCustomBack(null);
                if (back === 'custom') chooseBack('none');
              }}
            >
              Forget picture
            </button>
          )}
          <span className="muted small">A 744 × 1039 px picture fills a back at 300 dpi; anything else is stretched to the card.</span>
        </div>
        {back !== 'none' && (
          <>
            <p className="muted small">
              Back pages follow each sheet mirrored left to right: print double-sided, flipping on the <strong>long edge</strong>, and every back
              lands behind its front.
            </p>
            <div className="offset-row">
              <span className="small">
                <strong>Duplex offset</strong>: move the backs
              </span>
              <label className="small">
                <input
                  type="number"
                  step="0.1"
                  min={-OFFSET_LIMIT_MM}
                  max={OFFSET_LIMIT_MM}
                  value={offset.x}
                  aria-label="Move backs right, millimetres"
                  onChange={(e) => chooseOffset({ ...offset, x: e.target.value === '' || e.target.value === '-' ? 0 : clampOffset(e.target.value) })}
                />{' '}
                mm right
              </label>
              <label className="small">
                <input
                  type="number"
                  step="0.1"
                  min={-OFFSET_LIMIT_MM}
                  max={OFFSET_LIMIT_MM}
                  value={offset.y}
                  aria-label="Move backs up, millimetres"
                  onChange={(e) => chooseOffset({ ...offset, y: e.target.value === '' || e.target.value === '-' ? 0 : clampOffset(e.target.value) })}
                />{' '}
                mm up
              </label>
              {(offset.x !== 0 || offset.y !== 0) && (
                <button type="button" className="link" onClick={() => chooseOffset({ x: 0, y: 0 })}>
                  Reset
                </button>
              )}
            </div>
            <p className="muted small">
              Most printers put the second side a fraction of a millimetre off. Print one duplex sheet, hold it to the light, and if the backs
              sit, say, 0.5 mm too far right, enter −0.5. Negative numbers move left or down; the setting is remembered for this printer.
            </p>
          </>
        )}
        {lowArt.length > 0 && (
          <p className="badge warn block">
            Artwork below 300 dpi on {lowArt.length} card{lowArt.length === 1 ? '' : 's'}, so it will print soft or blurry:{' '}
            {lowArt.map((a) => `${a.name} (${Math.round(a.dpi / 10) * 10} dpi)`).join(', ')}. The Artwork panel says how many pixels each needs.
          </p>
        )}
        <p className="muted small">
          On any printer: use matte photo paper or coated card stock rather than plain paper, set the driver to Best or Photo quality, and
          print at 100% (no “fit to page”).
        </p>
        <div className="crop-controls">
          <span className="spacer" />
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={() => onExport(profile, paper, back, bleed, offset)}>
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
