import { ComponentBox } from "@/src/lib/types";
import { useEffect } from "react";
import { useCanvasInteractions } from "@/src/hooks/useCanvasInteractions";

type Props = {
  img: HTMLImageElement | null;
  boxes: ComponentBox[];
  selected: number | null;
  displaySize: { w: number; h: number } | null;
  editMode: boolean;
  background: "transparent" | "clear" | "white" | "pink" | "black";
  onSelect: (idx: number | null) => void;
  onMoveBox: (updater: (prev: ComponentBox[]) => ComponentBox[]) => void;
  onAddBox: (box: ComponentBox) => number | null;
  stageRef: React.RefObject<HTMLDivElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
};

export function CanvasStage({
  img,
  boxes,
  selected,
  displaySize,
  editMode,
  background,
  onSelect,
  onMoveBox,
  onAddBox,
  stageRef,
  overlayRef,
  canvasRef,
}: Props) {
  const { zoom, pan, isPanning, overlayHandlers, onWheel, resetZoom } =
    useCanvasInteractions({
      img,
      boxes,
      selected,
      overlayRef,
      editMode,
      onSelect,
      onMoveBox,
      onAddBox,
    });

  // draw image and overlay
  useEffect(() => {
    if (!canvasRef.current || !overlayRef.current || !img) return;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const ctx = canvas.getContext("2d");
    const octx = overlay.getContext("2d");
    if (!ctx || !octx) return;
    canvas.width = img.width;
    canvas.height = img.height;
    overlay.width = img.width;
    overlay.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    octx.clearRect(0, 0, overlay.width, overlay.height);

    // draw checkerboard background
    const bgStyle = canvasBackgroundStyle(background);
    if (bgStyle.fillPattern) {
      ctx.fillStyle = bgStyle.fillPattern;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgStyle.backgroundColor) {
      ctx.fillStyle = bgStyle.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0);
    boxes.forEach((b, i) => {
      const isSel = selected === i;
      octx.strokeStyle = isSel
        ? "rgba(245,158,11,0.95)"
        : "rgba(52,211,153,0.9)";
      octx.fillStyle = isSel ? "rgba(245,158,11,0.12)" : "rgba(52,211,153,0.1)";
      octx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
      octx.fillRect(b.x, b.y, b.w, b.h);
    });
  }, [img, boxes, selected, canvasRef, overlayRef, background]);

  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.style.pointerEvents = editMode ? "auto" : "none";
    }
  }, [editMode, img, overlayRef]);

  return (
    <div className="panel">
      <div
        className={`canvas-wrap ${isPanning ? "panning" : ""}`}
        ref={stageRef}
        onWheel={onWheel}
      >
        <canvas
          ref={canvasRef}
          className="base"
          style={{
            position: "absolute",
            inset: 0,
            width: displaySize?.w ? `${displaySize.w}px` : undefined,
            height: displaySize?.h ? `${displaySize.h}px` : undefined,
            zIndex: 1,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "top left",
          }}
        />
        <canvas
          ref={overlayRef}
          className="overlay"
          style={{
            position: "absolute",
            inset: 0,
            width: displaySize?.w ? `${displaySize.w}px` : undefined,
            height: displaySize?.h ? `${displaySize.h}px` : undefined,
            background: "transparent",
            pointerEvents: editMode ? "auto" : "none",
            zIndex: 2,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "top left",
          }}
          {...overlayHandlers}
        />
        <div className="zoom-hud">
          <span className="icon">🔍</span>
          <span>{Math.round(zoom * 100)}%</span>
          <button className="secondary tiny" onClick={resetZoom}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function canvasBackgroundStyle(
  mode: "transparent" | "clear" | "white" | "pink" | "black",
): {
  fillPattern?: CanvasPattern;
  backgroundColor?: string;
} {
  if (mode === "transparent") {
    const size = 16;
    const theme =
      typeof document !== "undefined" && document.body.dataset.theme === "light"
        ? "light"
        : "dark";
    const c1 =
      theme === "light" ? "rgba(204,204,204,0.8)" : "rgba(90,90,90,0.8)";
    const c2 =
      theme === "light" ? "rgba(255,255,255,0.8)" : "rgba(45,45,45,0.8)";
    const patternCanvas = document.createElement("canvas");
    patternCanvas.width = size;
    patternCanvas.height = size;
    const pctx = patternCanvas.getContext("2d");
    if (pctx) {
      pctx.fillStyle = c1;
      pctx.fillRect(0, 0, size / 2, size / 2);
      pctx.fillRect(size / 2, size / 2, size / 2, size / 2);
      pctx.fillStyle = c2;
      pctx.fillRect(0, size / 2, size / 2, size / 2);
      pctx.fillRect(size / 2, 0, size / 2, size / 2);
    }
    return {
      fillPattern: pctx
        ? pctx.createPattern(patternCanvas, "repeat")
        : undefined,
    };
  }
  if (mode === "clear") return {};
  if (mode === "white") return { backgroundColor: "#ffffff" };
  if (mode === "pink") return { backgroundColor: "#ec4899" };
  return { backgroundColor: "#000000" };
}
