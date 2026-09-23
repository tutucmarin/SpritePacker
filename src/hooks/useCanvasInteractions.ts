import { useRef, useState } from "react";
import type { ComponentBox } from "@/src/lib/types";

type Params = {
  img: HTMLImageElement | null;
  boxes: ComponentBox[];
  selected: number[];
  overlayRef: React.RefObject<HTMLCanvasElement>;
  editMode: boolean;
  onSelect: (idx: number | null, additive?: boolean) => void;
  onSelectMany: (indices: number[], additive?: boolean) => void;
  onMoveBox: (updater: (prev: ComponentBox[]) => ComponentBox[]) => void;
};

export function useCanvasInteractions({
  img,
  boxes,
  selected,
  overlayRef,
  editMode,
  onSelect,
  onSelectMany,
  onMoveBox,
}: Params) {
  const actionRef = useRef<"select" | "move" | null>(null);
  const startPtRef = useRef<{ x: number; y: number } | null>(null);
  const startBoxesRef = useRef<Map<number, ComponentBox>>(new Map());
  const moveIndicesRef = useRef<number[]>([]);
  const additiveSelectionRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [draftBox, setDraftBox] = useState<ComponentBox | null>(null);
  const MIN_SELECTION_DRAG = 3;

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
    startBoxesRef.current.clear();
    moveIndicesRef.current = [];
    additiveSelectionRef.current = false;
    setDraftBox(null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.altKey) {
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        px: pan.x,
        py: pan.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsPanning(true);
      return;
    }

    const pt = toImgPoint(e);
    if (!pt || !editMode) return;
    const additive = e.metaKey || e.ctrlKey || e.shiftKey;
    const hit = findHitIndex(boxes, pt);

    e.currentTarget.setPointerCapture(e.pointerId);
    setDraftBox(null);
    if (hit >= 0) {
      if (additive) {
        onSelect(hit, true);
        return;
      }

      const moving = selected.includes(hit) ? selected : [hit];
      if (!selected.includes(hit)) onSelect(hit);
      startPtRef.current = pt;
      moveIndicesRef.current = moving;
      startBoxesRef.current = new Map(
        moving.map((index) => [index, { ...boxes[index] }]),
      );
      actionRef.current = "move";
      return;
    }

    if (!additive) onSelect(null);
    startPtRef.current = pt;
    additiveSelectionRef.current = additive;
    setDraftBox({ x: pt.x, y: pt.y, w: 1, h: 1 });
    actionRef.current = "select";
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
    if (!pt || !startPt) return;

    if (actionRef.current === "move" && moveIndicesRef.current.length) {
      const starts = [...startBoxesRef.current.values()];
      const minX = Math.min(...starts.map((box) => box.x));
      const minY = Math.min(...starts.map((box) => box.y));
      const maxRight = Math.max(...starts.map((box) => box.x + box.w));
      const maxBottom = Math.max(...starts.map((box) => box.y + box.h));
      const dx = clamp(pt.x - startPt.x, -minX, (img?.width ?? maxRight) - maxRight);
      const dy = clamp(pt.y - startPt.y, -minY, (img?.height ?? maxBottom) - maxBottom);
      onMoveBox((prev) =>
        prev.map((box, index) => {
          const start = startBoxesRef.current.get(index);
          return start ? { ...box, x: start.x + dx, y: start.y + dy } : box;
        }),
      );
      return;
    }

    if (actionRef.current === "select") {
      setDraftBox(rectFromPoints(startPt, pt));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (panStartRef.current) {
      panStartRef.current = null;
      setIsPanning(false);
      return;
    }
    if (!editMode) return;

    const pt = toImgPoint(e);
    const startPt = startPtRef.current;
    if (actionRef.current === "select" && pt && startPt) {
      const selection = rectFromPoints(startPt, pt);
      if (selection.w >= MIN_SELECTION_DRAG || selection.h >= MIN_SELECTION_DRAG) {
        const matches = boxes
          .map((box, index) => ({ box, index }))
          .filter(({ box }) => intersects(selection, box))
          .map(({ index }) => index);
        onSelectMany(matches, additiveSelectionRef.current);
      }
    }
    resetDrag();
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!img) return;
    e.preventDefault();
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
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
    draftBox,
    overlayHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
    onWheel,
    resetZoom,
  };
}

function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.max(1, Math.abs(b.x - a.x)),
    h: Math.max(1, Math.abs(b.y - a.y)),
  };
}

function intersects(a: ComponentBox, b: ComponentBox) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

function findHitIndex(
  boxes: ComponentBox[],
  point: { x: number; y: number },
) {
  for (let index = boxes.length - 1; index >= 0; index--) {
    const box = boxes[index];
    if (
      point.x >= box.x &&
      point.x <= box.x + box.w &&
      point.y >= box.y &&
      point.y <= box.y + box.h
    ) {
      return index;
    }
  }
  return -1;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
