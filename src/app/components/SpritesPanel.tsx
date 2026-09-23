import { ComponentBox } from "@/src/lib/types";
import { ChangeEvent, useMemo, useRef, useState } from "react";

type Props = {
  boxes: ComponentBox[];
  selected: number[];
  onSelect: (idx: number | null, additive?: boolean) => void;
  onFiles: (files?: File[]) => void;
  onLoadAtlas: (files?: File[]) => Promise<void> | void;
  itemRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
};

export function SpritesPanel({
  boxes,
  selected,
  onSelect,
  onFiles,
  onLoadAtlas,
  itemRefs,
}: Props) {
  const [query, setQuery] = useState("");
  const atlasInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };
  const inputId = "file-input-sprites";
  const handleAtlasChange = (e: ChangeEvent<HTMLInputElement>) => {
    void onLoadAtlas(Array.from(e.target.files || []));
    e.target.value = "";
  };
  const handleLoadAtlasClick = () => {
    if ("showOpenFilePicker" in window) {
      void onLoadAtlas();
    } else {
      atlasInputRef.current?.click();
    }
  };
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
        accept=".png,.apng,.jpg,.jpeg,.jfif,.webp,.gif,.bmp,.avif,.svg,.ico,.tif,.tiff,.heic,.heif,image/*"
        multiple
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <input
        ref={atlasInputRef}
        type="file"
        accept=".png,.apng,.jpg,.jpeg,.jfif,.webp,.gif,.bmp,.avif,.svg,.ico,.tif,.tiff,.heic,.heif,.json,image/*,application/json"
        multiple
        onChange={handleAtlasChange}
        style={{ display: "none" }}
      />
      <div className="sprite-import-actions">
        <label htmlFor={inputId} className="button-like">
          Add Images
        </label>
        {boxes.length === 0 && (
          <button type="button" onClick={handleLoadAtlasClick}>
            Load Atlas
          </button>
        )}
      </div>
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
            className={`sprite-item ${selected.includes(i) ? "active" : ""}`}
            onClick={(event) =>
              onSelect(i, event.metaKey || event.ctrlKey || event.shiftKey)
            }
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
