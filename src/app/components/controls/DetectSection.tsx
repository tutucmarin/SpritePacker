type Props = {
  bgMode: "auto" | "alpha" | "key" | "custom";
  cclTol: number;
  onBgMode: (v: "auto" | "alpha" | "key" | "custom") => void;
  onTol: (v: number) => void;
  onDetect: () => void;
  onCustomJson: (file?: File) => void;
};

export function DetectSection({
  bgMode,
  cclTol,
  onBgMode,
  onTol,
  onDetect,
  onCustomJson,
}: Props) {
  const inputId = "detect-custom-json";

  return (
    <div className="section-compact">
      <h3>Detect</h3>
      <div className="setting-row">
        <span className="label">Mode</span>
        <div className="control">
          <select
            value={bgMode}
            onChange={(e) => onBgMode(e.target.value as any)}
          >
            <option value="auto">auto</option>
            <option value="alpha">alpha</option>
            <option value="key">colorkey</option>
            <option value="custom">custom</option>
          </select>
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Tolerance</span>
        <div className="control">
          <input
            type="number"
            value={cclTol}
            min={0}
            max={64}
            onChange={(e) => onTol(parseInt(e.target.value || "16", 10))}
            style={{ width: 90 }}
          />
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Detect</span>
        <div className="control">
          <button className="secondary btn-icon" onClick={onDetect}>
            Auto-detect
          </button>
        </div>
      </div>
      {bgMode === "custom" && (
        <div className="setting-row" style={{ marginTop: 6 }}>
          <span className="label">Custom JSON</span>
          <div className="control">
            <input
              id={inputId}
              type="file"
              accept="application/json"
              onChange={(e) => onDetectCustom(e, onCustomJson)}
              style={{ display: "none" }}
            />
            <label htmlFor={inputId} className="button-like">
              Upload
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function onDetectCustom(
  e: React.ChangeEvent<HTMLInputElement>,
  handler: (file?: File) => void,
) {
  const f = e.target.files?.[0];
  handler(f || undefined);
}
