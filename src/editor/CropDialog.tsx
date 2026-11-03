import { useState } from 'react';
import Cropper, { type Area, type MediaSize } from 'react-easy-crop';
import type { CropRect } from '../model/card';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;

/** Zoom at which the whole picture fits inside the crop box (1 = the picture just covers it). */
export function fitZoom(pictureAspect: number, cropAspect: number): number {
  return Math.min(cropAspect / pictureAspect, pictureAspect / cropAspect);
}

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
  const [media, setMedia] = useState<MediaSize | null>(null);
  const rotate = (delta: number) => {
    setRotation((r) => (r + delta + 360) % 360);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };
  const fitWhole = () => {
    if (!media) return;
    const swap = rotation % 180 !== 0;
    const pictureAspect = swap ? media.naturalHeight / media.naturalWidth : media.naturalWidth / media.naturalHeight;
    setCrop({ x: 0, y: 0 });
    setZoom(Math.max(MIN_ZOOM, fitZoom(pictureAspect, aspect)));
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Position your image</h2>
        <p className="muted small">
          Drag to move, scroll or use the slider to zoom. The box matches the card's art area; zooming out shows more of the picture and
          fills the rest with the art fill colour.
        </p>
        <div className="crop-area">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            restrictPosition={false}
            onMediaLoaded={setMedia}
            initialCroppedAreaPixels={initial ? { x: initial.x, y: initial.y, width: initial.w, height: initial.h } : undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_a, px) => setArea(px)}
          />
        </div>
        <div className="crop-controls">
          <label>
            Zoom
            <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
          <button onClick={fitWhole} disabled={!media} title="Zoom out until the whole picture fits in the box">
            Fit whole picture
          </button>
          <button onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }} title="Zoom so the picture just covers the box">
            Fill box
          </button>
          <button onClick={() => rotate(-90)}>⟲ Rotate</button>
          <button onClick={() => rotate(90)}>⟳ Rotate</button>
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
