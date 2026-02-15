import { ComponentBox } from "@/src/lib/types";
import { useEffect, useRef, useState } from "react";

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
};

export function SpriteInfo({
  box,
  selectedIndex,
  onUpdate,
  onDelete,
  onReplace,
  onFit,
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
              <NumberInput label="x" value={x} onChange={setX} />
              <NumberInput label="y" value={y} onChange={setY} />
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
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onReplace(f);
                if (e.target) e.target.value = "";
              }}
            />
              <button
                className="secondary btn-icon"
                title="Size must match on width or height (±1px)."
                aria-label="Upload replacement sprite (size must match on width or height, plus or minus one pixel)"
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
      <input
        type="number"
        value={value}
        min={min}
        onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
      />
    </label>
  );
}

function clampInt(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.round(v);
}
