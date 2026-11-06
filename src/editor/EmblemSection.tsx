import { useState } from 'react';
import type { Catalog } from '../catalog/types';
import { iconsInGroup } from '../catalog/types';
import { FRAMES_BASE } from '../catalog/useCatalog';
import type { Card } from '../model/card';
import type { AssetCache } from '../render/assets';
import { deleteImage, newImageKey, putImage } from '../store/db';
import { iconLabel } from './IconsSection';

interface Props {
  card: Card;
  catalog: Catalog;
  assets: AssetCache;
  onChange: (card: Card) => void;
}

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * The top-left affiliation disc of a personnel or ship frame. By default it shows the frame's own
 * emblem; here it can take another affiliation's, or a picture of the user's own.
 */
export function EmblemSection({ card, catalog, assets, onChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const choices = iconsInGroup(catalog, 'corner');
  const custom = card.emblem?.blobKey;

  const dropCustom = () => {
    if (custom) assets.dropBlob(custom);
  };

  const setIcon = (id: string) => {
    setError(null);
    dropCustom();
    const { emblem: _old, ...rest } = card;
    onChange(card.emblem?.icon === id ? { ...rest, updatedAt: Date.now() } : { ...rest, emblem: { icon: id }, updatedAt: Date.now() });
  };

  const reset = () => {
    setError(null);
    dropCustom();
    const { emblem: _old, ...rest } = card;
    onChange({ ...rest, updatedAt: Date.now() });
  };

  const pick = async (file: File) => {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError('Please choose a PNG, JPEG or WebP image.');
      return;
    }
    const key = newImageKey();
    try {
      await putImage(key, file);
      await assets.getBlobImage(key, file); // proves the file decodes before the card points at it
    } catch (e) {
      assets.dropBlob(key);
      await deleteImage(key).catch(() => undefined);
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    dropCustom();
    onChange({ ...card, emblem: { blobKey: key }, updatedAt: Date.now() });
  };

  return (
    <section className="emblem-section">
      <h2>Corner emblem</h2>
      <div className="icon-check" role="group" aria-label="Corner emblem">
        <button className={!card.emblem ? 'on frame-own' : 'frame-own'} title="The frame's own emblem" onClick={reset}>
          own
        </button>
        {choices.map((ic) => {
          const on = card.emblem?.icon === ic.id;
          return (
            <button key={ic.id} className={on ? 'on' : ''} title={iconLabel(ic.id)} onClick={() => setIcon(ic.id)}>
              <img src={FRAMES_BASE + ic.file} alt={iconLabel(ic.id)} />
            </button>
          );
        })}
      </div>
      <div className="row wrap">
        <label className="file-button">
          {custom ? 'Replace picture…' : 'Own picture…'}
          <input type="file" accept={ACCEPTED.join(',')} onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        </label>
        {custom && <button onClick={reset}>Remove</button>}
        <span className="muted small">
          {custom ? 'Your picture, fitted inside the disc.' : card.emblem?.icon ? `${iconLabel(card.emblem.icon)} in place of the frame's own.` : "The frame's own emblem."}
        </span>
      </div>
      <p className="muted small">
        Replaces the affiliation emblem in the top-left disc: another affiliation, or your own mark for a faction the game never had. A PNG
        with a transparent background looks best; it is shrunk to fit the disc.
      </p>
      {error && <p className="badge error">{error}</p>}
    </section>
  );
}
