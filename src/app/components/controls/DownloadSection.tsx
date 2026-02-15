type Props = {
  mode: "sprites" | "atlas";
  onMode: (m: "sprites" | "atlas") => void;
  archive: boolean;
  onArchive: (v: boolean) => void;
  onDownload: () => void;
};

export function DownloadSection({
  mode,
  onMode,
  archive,
  onArchive,
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
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={archive}
            onChange={(e) => onArchive(e.target.checked)}
          />
          Archieve
        </label>
        <button onClick={onDownload}>Download</button>
      </div>
    </div>
  );
}
