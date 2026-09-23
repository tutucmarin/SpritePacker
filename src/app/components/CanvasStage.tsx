import { ComponentBox } from "@/src/lib/types";
import { useEffect } from "react";
import { useCanvasInteractions } from "@/src/hooks/useCanvasInteractions";

type Props = {
  img: HTMLImageElement | null;
  boxes: ComponentBox[];
  selected: number[];
  displaySize: { w: number; h: number } | null;
  editMode: boolean;
  background: "transparent" | "clear" | "white" | "pink" | "black";
  onSelect: (idx: number | null, additive?: boolean) => void;
  onSelectMany: (indices: number[], additive?: boolean) => void;
  onMoveBox: (updater: (prev: ComponentBox[]) => ComponentBox[]) => void;
  onCopy: () => Promise<void> | void;
  onPaste: (files: File[]) => Promise<void> | void;
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
  onSelectMany,
  onMoveBox,
  onCopy,
  onPaste,
  stageRef,
  overlayRef,
  canvasRef,
}: Props) {
  const { zoom, pan, isPanning, draftBox, overlayHandlers, onWheel, resetZoom } =
    useCanvasInteractions({
      img,
      boxes,
      selected,
      overlayRef,
      editMode,
      onSelect,
      onSelectMany,
      onMoveBox,
    });
  const showReset = Math.abs(zoom - 1) > 0.001;

  // The atlas bitmap changes far less often than the selection overlay. Avoid
  // reallocating and redrawing the full atlas for every pointer move.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!img) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (canvas.width !== img.width) canvas.width = img.width;
    if (canvas.height !== img.height) canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
  }, [img, canvasRef, background]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    if (!img) {
      overlay.width = 0;
      overlay.height = 0;
      return;
    }
    const octx = overlay.getContext("2d");
    if (!octx) return;
    if (overlay.width !== img.width) overlay.width = img.width;
    if (overlay.height !== img.height) overlay.height = img.height;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    boxes.forEach((b, i) => {
      const isSel = selected.includes(i);
      octx.strokeStyle = isSel
        ? "rgba(245,158,11,0.95)"
        : "rgba(52,211,153,0.9)";
      octx.fillStyle = isSel ? "rgba(245,158,11,0.12)" : "rgba(52,211,153,0.1)";
      octx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
      octx.fillRect(b.x, b.y, b.w, b.h);
    });
    if (draftBox && draftBox.w > 0 && draftBox.h > 0) {
      octx.strokeStyle = "rgba(96,165,250,0.98)";
      octx.fillStyle = "rgba(96,165,250,0.14)";
      octx.lineWidth = 1;
      octx.setLineDash([5, 3]);
      octx.strokeRect(
        draftBox.x + 0.5,
        draftBox.y + 0.5,
        draftBox.w,
        draftBox.h,
      );
      octx.fillRect(draftBox.x, draftBox.y, draftBox.w, draftBox.h);
      octx.setLineDash([]);
    }
  }, [img, boxes, selected, draftBox, overlayRef]);

  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.style.pointerEvents = editMode ? "auto" : "none";
    }
  }, [editMode, img, overlayRef]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (!editMode || !selected.length || !img) return;

      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -1;
      else if (e.key === "ArrowRight") dx = 1;
      else if (e.key === "ArrowUp") dy = -1;
      else if (e.key === "ArrowDown") dy = 1;
      else return;

      e.preventDefault();
      const selectedSet = new Set(selected);
      const selectedBoxes = boxes.filter((_, index) => selectedSet.has(index));
      const minX = Math.min(...selectedBoxes.map((box) => box.x));
      const minY = Math.min(...selectedBoxes.map((box) => box.y));
      const maxRight = Math.max(...selectedBoxes.map((box) => box.x + box.w));
      const maxBottom = Math.max(...selectedBoxes.map((box) => box.y + box.h));
      const safeDx = clamp(dx, -minX, img.width - maxRight);
      const safeDy = clamp(dy, -minY, img.height - maxBottom);
      onMoveBox((prev) =>
        prev.map((box, index) =>
          selectedSet.has(index)
            ? { ...box, x: box.x + safeDx, y: box.y + safeDy }
            : box,
        ),
      );
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editMode, img, boxes, selected, onMoveBox]);

  useEffect(() => {
    const onWindowCopy = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target) || !selected.length) return;
      event.preventDefault();
      void onCopy();
    };

    window.addEventListener("copy", onWindowCopy);
    return () => window.removeEventListener("copy", onWindowCopy);
  }, [selected, onCopy]);

  useEffect(() => {
    const onWindowPaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const files = clipboardImageFiles(event.clipboardData);
      if (!files.length) return;
      event.preventDefault();
      void onPaste(files);
    };

    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
  }, [onPaste]);

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
            left: "50%",
            top: "50%",
            width: displaySize?.w ? `${displaySize.w}px` : undefined,
            height: displaySize?.h ? `${displaySize.h}px` : undefined,
            zIndex: 1,
            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        />
        <canvas
          ref={overlayRef}
          className="overlay"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: displaySize?.w ? `${displaySize.w}px` : undefined,
            height: displaySize?.h ? `${displaySize.h}px` : undefined,
            background: "transparent",
            pointerEvents: editMode ? "auto" : "none",
            zIndex: 2,
            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
          {...overlayHandlers}
        />
        {showReset && (
          <div className="zoom-hud">
            <span className="icon">🔍</span>
            <span>{Math.round(zoom * 100)}%</span>
            <button className="secondary tiny" onClick={resetZoom}>
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(
    element &&
      (element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.tagName === "SELECT" ||
        element.isContentEditable),
  );
}

function clipboardImageFiles(clipboard: DataTransfer | null): File[] {
  if (!clipboard) return [];

  const fromItems = Array.from(clipboard.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .flatMap((item) => {
      const file = item.getAsFile();
      return file ? [file] : [];
    });
  if (fromItems.length) return fromItems;

  return Array.from(clipboard.files).filter((file) =>
    file.type.startsWith("image/"),
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

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
