type Props = {
  projectName: string;
  onProjectName: (v: string) => void;
  packerMode: "default" | "optimal" | "maxrect";
  onPackerChange: (
    v: "default" | "optimal" | "maxrect",
    spacing?: number,
  ) => void;
  atlasWidth: number | null;
  atlasHeight: number | null;
  onAtlasWidth: (v: number | null) => void;
  onAtlasHeight: (v: number | null) => void;
  fixedSize: boolean;
  onFixedSize: (v: boolean) => void;
  jsonFormat: JsonFormat;
  onJsonFormat: (v: JsonFormat) => void;
  onClearAll: () => void;
  spacing: number;
  onSpacing: (v: number) => void;
  onDetectDuplicates: () => void;
  background: "transparent" | "clear" | "white" | "pink" | "black";
  onBackground: (
    v: "transparent" | "clear" | "white" | "pink" | "black",
  ) => void;
};

export type JsonFormat =
  | "json-array"
  | "json-hash"
  | "pixi"
  | "phaser-array"
  | "phaser-hash"
  | "phaser3";

export function ProjectSection({
  projectName,
  onProjectName,
  packerMode,
  onPackerChange,
  atlasWidth,
  atlasHeight,
  onAtlasWidth,
  onAtlasHeight,
  fixedSize,
  onFixedSize,
  jsonFormat,
  onJsonFormat,
  onClearAll,
  spacing,
  onSpacing,
  onDetectDuplicates,
  background,
  onBackground,
}: Props) {
  return (
    <div className="section-compact">
      <h3>Project</h3>
      <div className="setting-row">
        <span className="label">Project name</span>
        <div className="control" style={{ width: "60%" }}>
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectName(e.target.value)}
            placeholder="project name"
            style={{ width: "100%" }}
          />
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Packer</span>
        <div className="control">
          <select
            value={packerMode}
            onChange={(e) => onPackerChange(e.target.value as any)}
          >
            <option value="default">Default</option>
            <option value="optimal">Optimal</option>
            <option value="maxrect">Max Rect</option>
          </select>
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Spacing</span>
        <div className="control">
          <input
            type="number"
            value={spacing}
            min={5}
            onChange={(e) => onSpacing(parseInt(e.target.value || "0", 10))}
            style={{ width: 90 }}
          />
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Width</span>
        <div className="control">
          <input
            type="number"
            value={atlasWidth ?? ""}
            min={1}
            onChange={(e) =>
              onAtlasWidth(
                e.target.value === ""
                  ? null
                  : parseInt(e.target.value || "0", 10),
              )
            }
            style={{ width: 90 }}
          />
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Height</span>
        <div className="control">
          <input
            type="number"
            value={atlasHeight ?? ""}
            min={1}
            onChange={(e) =>
              onAtlasHeight(
                e.target.value === ""
                  ? null
                  : parseInt(e.target.value || "0", 10),
              )
            }
            style={{ width: 90 }}
          />
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Fixed size</span>
        <div className="control">
          <input
            type="checkbox"
            checked={fixedSize}
            onChange={(e) => onFixedSize(e.target.checked)}
          />
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Format</span>
        <div className="control">
          <select
            value={jsonFormat}
            onChange={(e) => onJsonFormat(e.target.value as JsonFormat)}
          >
            <option value="json-array">JSON - Array</option>
            <option value="json-hash">JSON - Hash</option>
            <option value="pixi">Pixi.js</option>
            <option value="phaser-array">Phaser Array</option>
            <option value="phaser-hash">Phaser - Hash</option>
            <option value="phaser3">Phaser 3</option>
          </select>
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Background</span>
        <div className="control">
          <select
            value={background}
            onChange={(e) => onBackground(e.target.value as any)}
            style={{ width: 140 }}
          >
            <option value="transparent">Transparent (grid)</option>
            <option value="clear">Clear Transparent</option>
            <option value="white">White</option>
            <option value="pink">Pink</option>
            <option value="black">Black</option>
          </select>
        </div>
      </div>
      {/* <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Clear all</span>
        <div className="control">
          <button className="secondary btn-icon" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      </div> */}
      {/* <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Detect duplicates</span>
        <div className="control">
          <button className="secondary btn-icon" onClick={onDetectDuplicates}>
            Detect duplicates
          </button>
        </div>
      </div> */}
    </div>
  );
}
