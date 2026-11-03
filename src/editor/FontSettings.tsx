import { DEFAULT_FONTS, registerUserFont, unregisterUserFont, type FontConfig } from '../render/fonts';
import { deleteUserFont, putUserFont } from '../store/db';

interface Props {
  fonts: FontConfig;
  onChange: (fonts: FontConfig) => void;
  onClose: () => void;
}

export function FontSettings({ fonts, onChange, onClose }: Props) {
  const load = async (slot: 'title' | 'body', file: File) => {
    const data = await file.arrayBuffer();
    const family = await registerUserFont(slot, data);
    await putUserFont(slot, file);
    onChange({ ...fonts, [slot]: family });
  };
  const reset = async (slot: 'title' | 'body') => {
    unregisterUserFont(slot);
    await deleteUserFont(slot).catch(() => undefined);
    onChange({ ...fonts, [slot]: DEFAULT_FONTS[slot] });
  };
  const row = (slot: 'title' | 'body', label: string, note: string) => (
    <div className="font-row">
      <div>
        <strong>{label}</strong>
        <div className="muted small">{note}</div>
        <div className="small">Current: {fonts[slot]}</div>
      </div>
      <label className="file-button">
        Load .ttf/.otf…
        <input type="file" accept=".ttf,.otf,font/ttf,font/otf" onChange={(e) => e.target.files?.[0] && load(slot, e.target.files[0])} />
      </label>
      <button onClick={() => reset(slot)} disabled={fonts[slot] === DEFAULT_FONTS[slot]}>
        Reset
      </button>
    </div>
  );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <h2>Fonts</h2>
        <p className="muted small">
          The originals use Crillee (titles) and Futura Condensed (text). Bundled lookalikes are Exo 2 and Fira Sans Condensed. If you own the
          originals, load them here; they stay in your browser.
        </p>
        {row('title', 'Title font', 'Titles, cost, points, span. Drawn bold italic.')}
        {row('body', 'Body font', 'Type bar, skills, game text, lore, attributes. Needs regular, bold, italic and light italic faces for best results.')}
        <div className="row end">
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
