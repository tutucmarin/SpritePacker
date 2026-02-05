import { ComponentBox } from "@/src/lib/types";
import { useEffect, useState } from "react";

type Props = {
  box: ComponentBox | null;
  selectedIndex: number | null;
  onUpdate: (next: ComponentBox) => void;
  onDelete: () => void;
};

export function SpriteInfo({ box, selectedIndex, onUpdate, onDelete }: Props) {
  const [name, setName] = useState("");
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);

  useEffect(() => {
    if (!box) return;
    const fallback =
      box.name && box.name.trim().length ? box.name : `sprite-${(selectedIndex ?? 0) + 1}`;
    setName(fallback);
    setX(box.x);
    setY(box.y);
    setW(box.w);
    setH(box.h);
  }, [box, selectedIndex]);

  return (
    <div className="section-compact">
      <h3>Sprite Info</h3>
      {box ? (
        <>
          <div className="toolbar" style={{ marginBottom: 6, flexWrap: "wrap" }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="sprite name"
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          <div className="toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
            <NumberInput label="x" value={x} onChange={setX} />
            <NumberInput label="y" value={y} onChange={setY} />
            <NumberInput label="w" value={w} onChange={setW} min={1} />
            <NumberInput label="h" value={h} onChange={setH} min={1} />
          </div>
          <div className="help" style={{ marginBottom: 8 }}>
            #{(selectedIndex ?? 0) + 1}
          </div>
          <div className="toolbar" style={{ gap: 8 }}>
            <button
              className="secondary"
              onClick={() =>
                onUpdate({
                  ...box,
                  name,
                  x: clampInt(x),
                  y: clampInt(y),
                  w: Math.max(1, clampInt(w)),
                  h: Math.max(1, clampInt(h)),
                })
              }
            >
              Save
            </button>
            <button className="secondary btn-icon" onClick={onDelete}>
              Delete
            </button>
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
    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {label}
      <input
        type="number"
        value={value}
        min={min}
        onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
        style={{ width: 80 }}
      />
    </label>
  );
}

function clampInt(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.round(v);
}
