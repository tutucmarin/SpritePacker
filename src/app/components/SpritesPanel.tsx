import { ComponentBox } from "@/src/lib/types";
import { ChangeEvent } from "react";

type Props = {
  boxes: ComponentBox[];
  selected: number | null;
  onSelect: (idx: number | null) => void;
  onFiles: (files?: FileList) => void;
  itemRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
};

export function SpritesPanel({
  boxes,
  selected,
  onSelect,
  onFiles,
  itemRefs,
}: Props) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFiles(e.target.files || undefined);
  };
  const inputId = "file-input-sprites";

  return (
    <div className="panel">
      {/* <div className="section-compact" style={{ marginBottom: 10 }}> */}
      {/* <div className="toolbar" style={{ gap: 8, alignItems: "stretch" }}> */}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <label
        htmlFor={inputId}
        className="button-like"
        style={{ marginBottom: 26 }}
      >
        Add Images
      </label>
      <h2 style={{ marginBottom: 6 }}>
        Sprites{" "}
        <span style={{ color: "#94a3b8", fontWeight: 600 }}>
          ({boxes.length})
        </span>
      </h2>
      <div className="scroll sprite-list">
        {boxes.length === 0 && (
          <div className="help">
            No sprites yet. Load an image and click Auto-detect.
          </div>
        )}
        {boxes.map((b, i) => (
          <div
            key={b.id ?? i}
            className={`sprite-item ${selected === i ? "active" : ""}`}
            onClick={() => onSelect(selected === i ? null : i)}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
          >
            <span className="sprite-index">{i + 1}</span>
            <span className="sprite-name">{b.name || `sprite-${i + 1}`}</span>
            <span className="help sprite-dim">
              {b.w}×{b.h}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
