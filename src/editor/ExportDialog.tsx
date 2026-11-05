import { useState } from 'react';
import { loadPrintProfile, savePrintProfile, type PrintProfile } from '../render/printProfile';
import { loadPaper, PAPER_LIST, PAPERS, savePaper, type Paper } from '../export/paper';

export interface LowArt {
  name: string;
  dpi: number;
}

interface Props {
  cardCount: number;
  /** Cards whose artwork prints below 300 dpi, copies > 0 only. */
  lowArt: LowArt[];
  onExport: (profile: PrintProfile, paper: Paper) => void;
  onCancel: () => void;
}

export function ExportDialog({ cardCount, lowArt, onExport, onCancel }: Props) {
  const [profile, setProfile] = useState<PrintProfile>(loadPrintProfile());
  const [paper, setPaper] = useState<Paper>(loadPaper());
  const choose = (p: PrintProfile) => {
    setProfile(p);
    savePrintProfile(p);
  };
  const choosePaper = (p: Paper) => {
    setPaper(p);
    savePaper(p);
  };
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <h2>Export print sheet</h2>
        <p className="muted small">
          {cardCount} card{cardCount === 1 ? '' : 's'} on {Math.max(1, Math.ceil(cardCount / 9))} {PAPERS[paper].label} sheet{cardCount > 9 ? 's' : ''}, 63 × 88 mm
          each.
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
          <button className="primary" onClick={() => onExport(profile, paper)}>
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
