import { ComponentBox } from "@/src/lib/types";
import { ChangeEvent, useMemo, useState } from "react";

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
  const [query, setQuery] = useState("");

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFiles(e.target.files || undefined);
  };
  const inputId = "file-input-sprites";
  const normalizedQuery = query.trim().toLowerCase();
  const filteredBoxes = useMemo(() => {
    const indexed = boxes.map((box, index) => ({ box, index }));
    if (!normalizedQuery) return indexed;
    return indexed.filter(({ box }, i) =>
      (box.name || `sprite-${i + 1}`).toLowerCase().includes(normalizedQuery),
    );
  }, [boxes, normalizedQuery]);

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
        style={{ marginBottom: 10 }}
      >
        Add Images
      </label>
      <div className="sprite-search">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sprites"
          disabled={boxes.length === 0}
          aria-label="Search sprites"
        />
        <button
          type="button"
          className="sprite-search-clear"
          onClick={() => setQuery("")}
          disabled={boxes.length === 0 || query.length === 0}
          aria-label="Clear search"
          title="Clear search"
        >
          x
        </button>
      </div>
      <h2 style={{ marginBottom: 6 }}>
        Sprites{" "}
        <span style={{ color: "#94a3b8", fontWeight: 600 }}>
          ({boxes.length})
        </span>
      </h2>
      <div className="scroll sprite-list">
        {boxes.length === 0 && (
          <div className="help">
            No sprites yet. Load an image and click Detect.
          </div>
        )}
        {boxes.length > 0 && filteredBoxes.length === 0 && (
          <div className="help">No sprites match your search.</div>
        )}
        {filteredBoxes.map(({ box: b, index: i }) => (
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
