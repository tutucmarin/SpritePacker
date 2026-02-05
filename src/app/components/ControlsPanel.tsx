import { DownloadSection } from "@/src/app/components/controls/DownloadSection";
import { DetectSection } from "@/src/app/components/controls/DetectSection";
import {
  JsonFormat,
  ProjectSection,
} from "@/src/app/components/controls/ProjectSection";
import { SpriteInfo } from "@/src/app/components/controls/SpriteInfo";
import type { ComponentBox } from "@/src/lib/types";

type Props = {
  // project
  projectName: string;
  onProjectName: (v: string) => void;
  packerMode: "default" | "optimal" | "maxrect";
  onPackerChange: (v: "default" | "optimal" | "maxrect", spacing?: number) => void;
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
  onBackground: (v: "transparent" | "clear" | "white" | "pink" | "black") => void;
  // detect
  bgMode: "auto" | "alpha" | "key" | "custom";
  cclTol: number;
  onBgMode: (v: "auto" | "alpha" | "key" | "custom") => void;
  onTol: (v: number) => void;
  onDetect: () => void;
  onCustomJson: (file?: File) => void;
  // sprite info
  selectedBox: ComponentBox | null;
  selectedIndex: number | null;
  onUpdate: (next: ComponentBox) => void;
  onDelete: () => void;
  // download
  downloadMode: "sprites" | "atlas";
  onDownloadMode: (m: "sprites" | "atlas") => void;
  fmt: "png" | "jpeg" | "webp";
  quality: number;
  onFmt: (f: "png" | "jpeg" | "webp") => void;
  onQuality: (q: number) => void;
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
    onUpdate,
    onDelete,
    downloadMode,
    onDownloadMode,
    fmt,
    quality,
    onFmt,
    onQuality,
    onDownload,
  } = props;

  return (
    <div className="panel">
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
      />

      {selectedBox && (
        <SpriteInfo
          box={selectedBox}
          selectedIndex={selectedIndex}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}

      <DownloadSection
        mode={downloadMode}
        onMode={onDownloadMode}
        fmt={fmt}
        quality={quality}
        onFmt={onFmt}
        onQuality={onQuality}
        onDownload={onDownload}
      />

      <div className="help">
        Tip: choose a sprite sheet, auto-detect, then tweak boxes and download.
      </div>
    </div>
  );
}
