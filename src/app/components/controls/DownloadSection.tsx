import type { AtlasImageFormat } from "@/src/lib/atlas-format";

type Props = {
  mode: "sprites" | "atlas";
  onMode: (m: "sprites" | "atlas") => void;
  archive: boolean;
  onArchive: (v: boolean) => void;
  imageFormat: AtlasImageFormat;
  onImageFormat: (format: AtlasImageFormat) => void;
  onDownload: () => void;
};

export function DownloadSection({
  mode,
  onMode,
  archive,
  onArchive,
  imageFormat,
  onImageFormat,
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
      {mode === "atlas" && (
        <div className="setting-row" style={{ marginTop: 8 }}>
          <label className="label" htmlFor="atlas-image-format">Image format</label>
          <div className="control">
            <select
              id="atlas-image-format"
              value={imageFormat}
              onChange={(event) => onImageFormat(event.target.value as AtlasImageFormat)}
            >
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
              <option value="jpeg">JPEG</option>
            </select>
          </div>
        </div>
      )}
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
