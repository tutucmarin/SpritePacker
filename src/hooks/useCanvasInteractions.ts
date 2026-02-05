import { useRef, useState } from "react";
import type { ComponentBox } from "@/src/lib/types";

type Params = {
  img: HTMLImageElement | null;
  boxes: ComponentBox[];
  selected: number | null;
  overlayRef: React.RefObject<HTMLCanvasElement>;
  editMode: boolean;
  onSelect: (idx: number | null) => void;
  onMoveBox: (updater: (prev: ComponentBox[]) => ComponentBox[]) => void;
  onAddBox: (box: ComponentBox) => number | null;
};

export function useCanvasInteractions({
  img,
  boxes,
  selected,
  overlayRef,
  editMode,
  onSelect,
  onMoveBox,
  onAddBox,
}: Params) {
  const actionRef = useRef<"draw" | "move" | null>(null);
  const startPtRef = useRef<{ x: number; y: number } | null>(null);
  const startBoxRef = useRef<ComponentBox | null>(null);
  const panStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const MIN_DRAW = 6;

  const toImgPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const x = Math.max(0, Math.min(canvas.width - 1, Math.round(cx)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round(cy)));
    return { x, y };
  };

  const resetDrag = () => {
    actionRef.current = null;
    startPtRef.current = null;
    startBoxRef.current = null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.metaKey) {
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        px: pan.x,
        py: pan.y,
      };
      setIsPanning(true);
      return;
    }
    const pt = toImgPoint(e);
    if (!pt) return;
    const hit = boxes.findIndex(
      (b) =>
        pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h,
    );
    if (!editMode) {
      if (hit >= 0) onSelect(selected === hit ? null : hit);
      return;
    }
    if (hit >= 0) {
      onSelect(selected === hit ? null : hit);
      startPtRef.current = pt;
      startBoxRef.current = { ...boxes[hit] };
      actionRef.current = "move";
    } else {
      onSelect(null);
      startPtRef.current = pt;
      startBoxRef.current = { x: pt.x, y: pt.y, w: 0, h: 0 };
      actionRef.current = "draw";
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panStartRef.current) {
      const { x, y, px, py } = panStartRef.current;
      setPan({ x: px + (e.clientX - x), y: py + (e.clientY - y) });
      return;
    }
    if (!editMode) return;
    const pt = toImgPoint(e);
    const startPt = startPtRef.current;
    const startBox = startBoxRef.current;
    if (!pt || !startPt || !startBox) return;
    if (actionRef.current === "move" && selected != null) {
      const dx = pt.x - startPt.x;
      const dy = pt.y - startPt.y;
      onMoveBox((prev) =>
        prev.map((b, i) =>
          i === selected
            ? {
                ...b,
                x: clamp(startBox.x + dx, 0, (img?.width || b.x) - b.w),
                y: clamp(startBox.y + dy, 0, (img?.height || b.y) - b.h),
              }
            : b,
        ),
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panStartRef.current) {
      panStartRef.current = null;
      setIsPanning(false);
      return;
    }
    if (!editMode) return;
    const pt = toImgPoint(e);
    const startPt = startPtRef.current;
    const startBox = startBoxRef.current;
    if (!pt || !startPt || !startBox) {
      resetDrag();
      return;
    }
    if (actionRef.current === "draw") {
      const x1 = Math.min(startBox.x, pt.x);
      const y1 = Math.min(startBox.y, pt.y);
      const x2 = Math.max(startBox.x, pt.x);
      const y2 = Math.max(startBox.y, pt.y);
      const b = {
        id: Date.now(),
        x: x1,
        y: y1,
        w: Math.max(2, x2 - x1),
        h: Math.max(2, y2 - y1),
      };
      if (b.w >= MIN_DRAW && b.h >= MIN_DRAW) {
        const idx = onAddBox(b);
        if (idx != null) onSelect(idx);
      }
    }
    resetDrag();
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!img) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    setZoom((z) => clamp(z * factor, 0.2, 5));
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return {
    zoom,
    pan,
    isPanning,
    overlayHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave: onPointerUp,
    },
    onWheel,
    resetZoom,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
