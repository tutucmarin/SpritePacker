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
      <div className="setting-row">
        <span className="label">Type</span>
        <div className="control">
          <div className="download-mode-group">
            <label>
              <input
                type="radio"
                name="dlmode"
                value="sprites"
                checked={mode === "sprites"}
                onChange={() => onMode("sprites")}
              />
              Sprites
            </label>
            <label>
              <input
                type="radio"
                name="dlmode"
                value="atlas"
                checked={mode === "atlas"}
                onChange={() => onMode("atlas")}
              />
              Atlas
            </label>
          </div>
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 8 }}>
        <span className="label">Archive</span>
        <div className="control">
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={archive}
              onChange={(e) => onArchive(e.target.checked)}
            />
            Archieve
          </label>
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 8 }}>
        <span className="label">Download</span>
        <div className="control">
          <button onClick={onDownload}>Download</button>
        </div>
      </div>
    </div>
  );
}
