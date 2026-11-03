import { useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import type { CropRect } from '../model/card';

interface Props {
  src: string;
  aspect: number;
  initial?: CropRect;
  onDone: (crop: CropRect, rotation: number) => void;
  onCancel: () => void;
}

export function CropDialog({ src, aspect, initial, onDone, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area | null>(null);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Position your image</h2>
        <p className="muted small">Drag to move, scroll or use the slider to zoom. The box matches the card's art area.</p>
        <div className="crop-area">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            minZoom={0.5}
            maxZoom={5}
            restrictPosition={false}
            initialCroppedAreaPixels={initial ? { x: initial.x, y: initial.y, width: initial.w, height: initial.h } : undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_a, px) => setArea(px)}
          />
        </div>
        <div className="crop-controls">
          <label>
            Zoom
            <input type="range" min={0.5} max={5} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
          <button onClick={() => setRotation((r) => (r + 270) % 360)}>⟲ Rotate</button>
          <button onClick={() => setRotation((r) => (r + 90) % 360)}>⟳ Rotate</button>
          <span className="muted small">{rotation}°</span>
          <span className="spacer" />
          <button onClick={onCancel}>Cancel</button>
          <button
            className="primary"
            disabled={!area}
            onClick={() => area && onDone({ x: area.x, y: area.y, w: area.width, h: area.height }, rotation)}
          >
            Use this crop
          </button>
        </div>
      </div>
    </div>
  );
}
