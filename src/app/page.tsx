"use client";

import { useRef } from "react";
import { TopBar } from "@/src/app/components/TopBar";
import { SpritesPanel } from "@/src/app/components/SpritesPanel";
import { CanvasStage } from "@/src/app/components/CanvasStage";
import { SettingsDialog } from "@/src/app/components/SettingsDialog";
import { ControlsPanel } from "@/src/app/components/ControlsPanel";
import { DuplicatesDialog } from "@/src/app/components/modals/DuplicatesDialog";
import { useDisplaySize } from "@/src/hooks/useDisplaySize";
import { useSelectionScroll } from "@/src/hooks/useSelectionScroll";
import { useSpritePacker } from "@/src/app/state/useSpritePacker";

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const { state, actions } = useSpritePacker();
  const {
    img,
    boxes,
    selected,
    projectName,
    packerMode,
    jsonFormat,
    spacing,
    atlasWidth,
    atlasHeight,
    fixedSize,
    downloadMode,
    fmt,
    quality,
    bgMode,
    cclTol,
    background,
    theme,
    showSettings,
    dupReport,
    selectedBox,
  } = state;

  const displaySize = useDisplaySize(img, stageRef);
  useSelectionScroll(selected, itemRefs);

  return (
    <div className="page-frame">
      <TopBar onSettings={actions.openSettings} />
      <div className="page-shell">
        <SpritesPanel
          boxes={boxes}
          selected={selected}
          onSelect={actions.onSelect}
          onFiles={actions.onFiles}
          itemRefs={itemRefs}
        />

        <CanvasStage
          img={img}
          boxes={boxes}
          selected={selected}
          displaySize={displaySize}
          editMode={true}
          background={background}
          onSelect={actions.onSelect}
          onMoveBox={actions.onMoveBox}
          onAddBox={(b) => actions.onAddBox(b)}
          stageRef={stageRef}
          overlayRef={overlayRef}
          canvasRef={canvasRef}
        />

        <ControlsPanel
          projectName={projectName}
          onProjectName={actions.onProjectName}
          packerMode={packerMode}
          onPackerChange={actions.onPackerChange}
          atlasWidth={atlasWidth}
          atlasHeight={atlasHeight}
          onAtlasWidth={actions.onAtlasWidth}
          onAtlasHeight={actions.onAtlasHeight}
          fixedSize={fixedSize}
          onFixedSize={actions.onFixedSize}
          jsonFormat={jsonFormat}
          onJsonFormat={actions.onJsonFormat}
          onClearAll={actions.onClearAll}
          spacing={spacing}
          onSpacing={actions.onSpacing}
          onDetectDuplicates={actions.onDetectDuplicates}
          background={background}
          onBackground={actions.onBackground}
          bgMode={bgMode}
          cclTol={cclTol}
          onBgMode={actions.onBgMode}
          onTol={actions.onTol}
          onDetect={actions.onDetect}
          onCustomJson={actions.onCustomJson}
          selectedBox={selectedBox}
          selectedIndex={selected}
          onUpdate={actions.onUpdateSelected}
          onDelete={actions.onDeleteSelected}
          downloadMode={downloadMode}
          onDownloadMode={actions.onDownloadMode}
          fmt={fmt}
          quality={quality}
          onFmt={actions.onFmt}
          onQuality={actions.onQuality}
          onDownload={actions.onDownload}
        />
      </div>
      {showSettings && (
        <SettingsDialog
          onClose={actions.closeSettings}
          theme={theme}
          onTheme={actions.onTheme}
        />
      )}
      {dupReport && (
        <DuplicatesDialog
          report={dupReport}
          onClose={actions.closeDupReport}
          onDelete={actions.onDeleteDuplicates}
        />
      )}
    </div>
  );
}
