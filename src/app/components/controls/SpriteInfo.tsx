import { ComponentBox } from "@/src/lib/types";
import { useEffect, useRef, useState } from "react";
import { CommittedNumberInput } from "@/src/app/components/controls/CommittedNumberInput";

type Props = {
  box: ComponentBox | null;
  selectedIndex: number | null;
  onUpdate: (
    next: ComponentBox,
    applyToImage?: boolean,
  ) => Promise<void> | void;
  onDelete: () => void;
  onReplace: (file: File) => void;
  onFit: () => void;
  onRotate: (direction: "left" | "right") => Promise<void> | void;
};

export function SpriteInfo({
  box,
  selectedIndex,
  onUpdate,
  onDelete,
  onReplace,
  onFit,
  onRotate,
}: Props) {
  const [name, setName] = useState("");
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);
  const [applyToImage, setApplyToImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!box) return;
    const fallback =
      box.name && box.name.trim().length
        ? box.name
        : `sprite-${(selectedIndex ?? 0) + 1}`;
    setName(fallback);
    setX(box.x);
    setY(box.y);
    setW(box.w);
    setH(box.h);
  }, [box, selectedIndex]);

  return (
    <div className="section-compact">
      <div className="sprite-info-title">
        <h3 style={{ margin: 0 }}>Sprite Info</h3>{" "}
        <span className="help">#{(selectedIndex ?? 0) + 1}</span>
      </div>

      {box ? (
        <>
          <div className="setting-row">
            <span className="label">Name</span>
            <div className="control">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="sprite name"
              />
            </div>
          </div>
          <div className="setting-row" style={{ marginTop: 8 }}>
            <span className="label">Position</span>
            <div className="control sprite-bounds">
              <NumberInput label="x" value={x} onChange={setX} min={0} />
              <NumberInput label="y" value={y} onChange={setY} min={0} />
            </div>
          </div>
          <div className="setting-row" style={{ marginTop: 8 }}>
            <span className="label">Size</span>
            <div className="control sprite-bounds">
              <NumberInput label="w" value={w} onChange={setW} min={1} />
              <NumberInput label="h" value={h} onChange={setH} min={1} />
            </div>
          </div>
          <div className="setting-row" style={{ marginTop: 8 }}>
            <span className="label">Apply Image</span>
            <div className="control">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={applyToImage}
                  onChange={(e) => setApplyToImage(e.target.checked)}
                />
                <span className="help">Sync sprite pixels</span>
              </label>
            </div>
          </div>
          <div className="setting-row" style={{ marginTop: 8 }}>
            <span className="label">Replace</span>
            <div className="control">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.apng,.jpg,.jpeg,.jfif,.webp,.gif,.bmp,.avif,.svg,.ico,.tif,.tiff,.heic,.heif,image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onReplace(f);
                if (e.target) e.target.value = "";
              }}
            />
              <button
                className="secondary btn-icon"
                title="Replace with an image of any size."
                aria-label="Upload replacement sprite"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload
              </button>
            </div>
          </div>
          <div className="setting-row" style={{ marginTop: 8 }}>
            <span className="label">Fit</span>
            <div className="control">
              <button
                className="secondary btn-icon"
                title="Set sprite width and height to match the selected image."
                aria-label="Fit sprite size to selected image"
                onClick={onFit}
              >
                Fit
              </button>
            </div>
          </div>
          <div className="setting-row" style={{ marginTop: 8 }}>
            <span className="label">Rotate</span>
            <div className="control sprite-actions">
              <button
                className="secondary btn-icon"
                title="Rotate sprite left"
                aria-label="Rotate sprite left"
                onClick={() => onRotate("left")}
              >
                Left
              </button>
              <button
                className="secondary btn-icon"
                title="Rotate sprite right"
                aria-label="Rotate sprite right"
                onClick={() => onRotate("right")}
              >
                Right
              </button>
            </div>
          </div>
          <div className="setting-row" style={{ marginTop: 10 }}>
            <span className="label">Actions</span>
            <div className="control sprite-actions">
              <button
                className="secondary"
                onClick={() =>
                  onUpdate(
                    {
                      ...box,
                      name,
                      x: clampInt(x),
                      y: clampInt(y),
                      w: Math.max(1, clampInt(w)),
                      h: Math.max(1, clampInt(h)),
                    },
                    applyToImage,
                  )
                }
              >
                Apply
              </button>
              <button className="danger btn-icon" onClick={onDelete}>
                Delete
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="help">Select a sprite to view details.</div>
      )}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <label className="sprite-metric">
      {label}
      <CommittedNumberInput
        value={value}
        min={min}
        onCommit={onChange}
      />
    </label>
  );
}

function clampInt(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.round(v);
}
