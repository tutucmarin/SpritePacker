import { CommittedNumberInput } from "@/src/app/components/controls/CommittedNumberInput";

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
  autoSize: boolean;
  onAutoSize: (v: boolean) => void;
  atlasScale: number;
  onAtlasScale: (v: number) => void;
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
  | "phaser3"
  | "unity"
  | "tpsheet";

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
  autoSize,
  onAutoSize,
  atlasScale,
  onAtlasScale,
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
        <div className="control">
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectName(e.target.value)}
            placeholder="project name"
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
          <CommittedNumberInput
            value={spacing}
            min={5}
            onCommit={onSpacing}
          />
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Scale (%)</span>
        <div className="control">
          <CommittedNumberInput
            value={atlasScale}
            min={10}
            max={800}
            step={1}
            onCommit={onAtlasScale}
          />
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Width</span>
        <div className="control">
          <CommittedNumberInput
            value={atlasWidth}
            min={1}
            disabled={autoSize}
            onCommit={onAtlasWidth}
          />
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Height</span>
        <div className="control">
          <CommittedNumberInput
            value={atlasHeight}
            min={1}
            disabled={autoSize}
            onCommit={onAtlasHeight}
          />
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Auto size</span>
        <div className="control">
          <input
            type="radio"
            name="atlas-size-mode"
            checked={autoSize}
            onChange={() => onAutoSize(true)}
          />
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Fixed size</span>
        <div className="control">
          <input
            type="radio"
            name="atlas-size-mode"
            checked={fixedSize}
            onChange={() => onFixedSize(true)}
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
            <option value="unity">Unity (.atlas)</option>
            <option value="tpsheet">TP Sheet</option>
          </select>
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 6 }}>
        <span className="label">Background</span>
        <div className="control">
          <select
            value={background}
            onChange={(e) => onBackground(e.target.value as any)}
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
