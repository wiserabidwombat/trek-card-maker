import { useState } from 'react';
import { loadPrintProfile, savePrintProfile, type PrintProfile } from '../render/printProfile';

interface Props {
  cardCount: number;
  onExport: (profile: PrintProfile) => void;
  onCancel: () => void;
}

export function ExportDialog({ cardCount, onExport, onCancel }: Props) {
  const [profile, setProfile] = useState<PrintProfile>(loadPrintProfile());
  const choose = (p: PrintProfile) => {
    setProfile(p);
    savePrintProfile(p);
  };
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <h2>Export print sheet</h2>
        <p className="muted small">
          {cardCount} card{cardCount === 1 ? '' : 's'} on {Math.max(1, Math.ceil(cardCount / 9))} Letter sheet{cardCount > 9 ? 's' : ''}, 63 × 88 mm each.
        </p>
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
        <p className="muted small">
          On any printer: use matte photo paper or coated card stock rather than plain paper, set the driver to Best or Photo quality, and
          print at 100% (no “fit to page”).
        </p>
        <div className="crop-controls">
          <span className="spacer" />
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={() => onExport(profile)}>
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
