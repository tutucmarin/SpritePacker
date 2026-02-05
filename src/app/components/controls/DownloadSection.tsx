type Props = {
  mode: "sprites" | "atlas";
  onMode: (m: "sprites" | "atlas") => void;
  fmt: "png" | "jpeg" | "webp";
  quality: number;
  onFmt: (f: "png" | "jpeg" | "webp") => void;
  onQuality: (q: number) => void;
  onDownload: () => void;
};

export function DownloadSection({
  mode,
  onMode,
  fmt,
  quality,
  onFmt,
  onQuality,
  onDownload,
}: Props) {
  return (
    <div className="section-compact">
      <h3>Download</h3>
      <div className="toolbar" style={{ gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="radio"
            name="dlmode"
            value="sprites"
            checked={mode === "sprites"}
            onChange={() => onMode("sprites")}
          />
          Sprites
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="radio"
            name="dlmode"
            value="atlas"
            checked={mode === "atlas"}
            onChange={() => onMode("atlas")}
          />
          Atlas
        </label>
        <select value={fmt} onChange={(e) => onFmt(e.target.value as any)}>
          <option value="png">png</option>
          <option value="jpeg">jpeg</option>
          <option value="webp">webp</option>
        </select>
        {["jpeg", "webp"].includes(fmt) && (
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={quality}
            onChange={(e) => onQuality(parseFloat(e.target.value || "0.92"))}
            style={{ width: 70 }}
          />
        )}
        <button onClick={onDownload}>Download</button>
      </div>
    </div>
  );
}
