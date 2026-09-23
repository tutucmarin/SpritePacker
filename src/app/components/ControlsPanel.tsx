import { DownloadSection } from "@/src/app/components/controls/DownloadSection";
import { DetectSection } from "@/src/app/components/controls/DetectSection";
import {
  JsonFormat,
  ProjectSection,
} from "@/src/app/components/controls/ProjectSection";
import { SpriteInfo } from "@/src/app/components/controls/SpriteInfo";
import type { ComponentBox } from "@/src/lib/types";
import type { AtlasImageFormat } from "@/src/lib/atlas-format";

type Props = {
  // project
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
  onJsonFormat: (v: JsonFormat) => void;
  onClearAll: () => void;
  spacing: number;
  onSpacing: (v: number) => void;
  onDetectDuplicates: () => void;
  background: "transparent" | "clear" | "white" | "pink" | "black";
  onBackground: (
    v: "transparent" | "clear" | "white" | "pink" | "black",
  ) => void;
  // detect
  bgMode: "auto" | "alpha" | "key" | "custom";
  cclTol: number;
  onBgMode: (v: "auto" | "alpha" | "key" | "custom") => void;
  onTol: (v: number) => void;
  onDetect: () => void;
  onCustomJson: (file?: File) => void;
  jsonFormat: JsonFormat;
  // sprite info
  selectedBox: ComponentBox | null;
  selectedIndex: number | null;
  selectedCount: number;
  onUpdate: (next: ComponentBox, applyToImage?: boolean) => Promise<void> | void;
  onDelete: () => void;
  onReplace: (file: File) => void;
  onFit: () => void;
  onRotate: (direction: "left" | "right") => Promise<void> | void;
  // download
  downloadMode: "sprites" | "atlas";
  atlasImageFormat: AtlasImageFormat;
  onAtlasImageFormat: (format: AtlasImageFormat) => void;
  onDownloadMode: (m: "sprites" | "atlas") => void;
  archive: boolean;
  onArchive: (v: boolean) => void;
  onDownload: () => void;
};

export function ControlsPanel(props: Props) {
  const {
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
    bgMode,
    cclTol,
    onBgMode,
    onTol,
    onDetect,
    onCustomJson,
    selectedBox,
    selectedIndex,
    selectedCount,
    onUpdate,
    onDelete,
    onReplace,
    onFit,
    onRotate,
    downloadMode,
    atlasImageFormat,
    onAtlasImageFormat,
    onDownloadMode,
    archive,
    onArchive,
    onDownload,
  } = props;

  return (
    <div className="panel controls-panel">
      <h2>Controls</h2>
      <ProjectSection
        projectName={projectName}
        onProjectName={onProjectName}
        packerMode={packerMode}
        onPackerChange={onPackerChange}
        atlasWidth={atlasWidth}
        atlasHeight={atlasHeight}
        onAtlasWidth={onAtlasWidth}
        onAtlasHeight={onAtlasHeight}
        fixedSize={fixedSize}
        onFixedSize={onFixedSize}
        autoSize={autoSize}
        onAutoSize={onAutoSize}
        atlasScale={atlasScale}
        onAtlasScale={onAtlasScale}
        jsonFormat={jsonFormat}
        onJsonFormat={onJsonFormat}
        onClearAll={onClearAll}
        spacing={spacing}
        onSpacing={onSpacing}
        onDetectDuplicates={onDetectDuplicates}
        background={background}
        onBackground={onBackground}
      />

      <DetectSection
        bgMode={bgMode}
        cclTol={cclTol}
        onBgMode={onBgMode}
        onTol={onTol}
        onDetect={onDetect}
        onCustomJson={onCustomJson}
        jsonFormat={jsonFormat}
      />

      {selectedBox && (
        <SpriteInfo
          box={selectedBox}
          selectedIndex={selectedIndex}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onReplace={onReplace}
          onFit={onFit}
          onRotate={onRotate}
        />
      )}
      {selectedCount > 1 && (
        <MultiSpriteActions
          count={selectedCount}
          onDelete={onDelete}
          onRotate={onRotate}
        />
      )}

      <DownloadSection
        mode={downloadMode}
        onMode={onDownloadMode}
        imageFormat={atlasImageFormat}
        onImageFormat={onAtlasImageFormat}
        archive={archive}
        onArchive={onArchive}
        onDownload={onDownload}
      />

      <div className="help">
        Tip: choose a sprite sheet, auto-detect, then tweak boxes and download.
      </div>
    </div>
  );
}

function MultiSpriteActions({
  count,
  onDelete,
  onRotate,
}: {
  count: number;
  onDelete: () => void;
  onRotate: (direction: "left" | "right") => Promise<void> | void;
}) {
  return (
    <div className="section-compact">
      <div className="sprite-info-title">
        <h3 style={{ margin: 0 }}>Sprite Actions</h3>
        <span className="help">{count} selected</span>
      </div>
      <div className="setting-row" style={{ marginTop: 8 }}>
        <span className="label">Rotate</span>
        <div className="control sprite-actions">
          <button
            className="secondary btn-icon"
            aria-label={`Rotate ${count} selected sprites left`}
            onClick={() => onRotate("left")}
          >
            Left
          </button>
          <button
            className="secondary btn-icon"
            aria-label={`Rotate ${count} selected sprites right`}
            onClick={() => onRotate("right")}
          >
            Right
          </button>
        </div>
      </div>
      <div className="setting-row" style={{ marginTop: 10 }}>
        <span className="label">Actions</span>
        <div className="control sprite-actions">
          <button className="danger btn-icon" onClick={onDelete}>
            Delete {count}
          </button>
        </div>
      </div>
    </div>
  );
}
