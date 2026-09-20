import type { ComponentBox } from "./types";
import { loadImageFromCanvas } from "./image-utils";

type PackerMode = "default" | "optimal" | "maxrect";

type RepackOptions = {
  rotate?: {
    index: number;
    direction: "left" | "right";
  };
};

export async function repackSprites(
  mode: PackerMode,
  originalImg: HTMLImageElement | null,
  originalBoxes: ComponentBox[],
  spacing = 0,
  targetW?: number | null,
  targetH?: number | null,
  options: RepackOptions = {},
): Promise<{ img: HTMLImageElement; boxes: ComponentBox[] } | null> {
  if (!originalImg || !originalBoxes.length) return null;
  if (mode === "default" && !options.rotate) {
    const requiredW = Math.max(...originalBoxes.map((box) => box.x + box.w));
    const requiredH = Math.max(...originalBoxes.map((box) => box.y + box.h));
    const atlasW = targetW && targetW > 0
      ? Math.max(requiredW, targetW)
      : originalImg.width;
    const atlasH = targetH && targetH > 0
      ? Math.max(requiredH, targetH)
      : originalImg.height;
    if (atlasW === originalImg.width && atlasH === originalImg.height) {
      return { img: originalImg, boxes: originalBoxes };
    }

    const canvas = document.createElement("canvas");
    canvas.width = atlasW;
    canvas.height = atlasH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(originalImg, 0, 0);
    return { img: await loadImageFromCanvas(canvas), boxes: originalBoxes };
  }

  const crops = originalBoxes.map((b, idx) => {
    const source = document.createElement("canvas");
    source.width = b.w;
    source.height = b.h;
    const sourceCtx = source.getContext("2d")!;
    sourceCtx.imageSmoothingEnabled = false;
    sourceCtx.drawImage(originalImg, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);

    if (options.rotate?.index !== idx) {
      return { ...b, idx, canvas: source };
    }

    const rotated = document.createElement("canvas");
    rotated.width = b.h;
    rotated.height = b.w;
    const rotatedCtx = rotated.getContext("2d")!;
    rotatedCtx.imageSmoothingEnabled = false;
    rotatedCtx.save();
    if (options.rotate.direction === "right") {
      rotatedCtx.translate(rotated.width, 0);
      rotatedCtx.rotate(Math.PI / 2);
    } else {
      rotatedCtx.translate(0, rotated.height);
      rotatedCtx.rotate(-Math.PI / 2);
    }
    rotatedCtx.drawImage(source, 0, 0);
    rotatedCtx.restore();
    source.width = 0;
    source.height = 0;
    return { ...b, w: rotated.width, h: rotated.height, idx, canvas: rotated };
  });

  crops.sort((a, b) => {
    if (mode === "optimal") return b.h - a.h || b.w - a.w;
    if (mode === "maxrect") {
      const areaA = a.w * a.h;
      const areaB = b.w * b.h;
      return areaB - areaA;
    }
    return a.idx - b.idx;
  });

  const totalArea = crops.reduce((s, b) => s + b.w * b.h, 0);
  const pad = Math.max(0, spacing);
  const minWidth = Math.max(...crops.map((b) => b.w));
  const sqrtW = Math.floor(Math.sqrt(totalArea));
  const candidates = new Set<number>([
    minWidth,
    Math.max(minWidth, sqrtW),
    Math.max(minWidth, sqrtW + pad),
    Math.max(minWidth, sqrtW - pad),
  ]);
  if (targetW && targetW > 0) candidates.add(Math.max(minWidth, targetW));

  let best:
    | {
        placements: (ComponentBox & { idx: number; canvas: HTMLCanvasElement })[];
        w: number;
        h: number;
      }
    | null = null;

  for (const cand of candidates) {
    const width = cand;
    let x = 0;
    let y = 0;
    let rowH = 0;
    let maxRowW = 0;
    const placements: (ComponentBox & {
      idx: number;
      canvas: HTMLCanvasElement;
    })[] = [];
    for (const b of crops) {
      if (x > 0 && x + b.w + pad > width) {
        x = 0;
        y += rowH + pad;
        rowH = 0;
      }
      placements.push({ ...b, x, y });
      x += b.w + pad;
      rowH = Math.max(rowH, b.h);
      maxRowW = Math.max(maxRowW, x - pad);
    }
    const h = y + rowH;
    const w = Math.max(width, maxRowW);
    if (
      !best ||
      Math.abs(w - h) < Math.abs(best.w - best.h) ||
      (Math.abs(w - h) === Math.abs(best.w - best.h) && w * h < best.w * best.h)
    ) {
      best = { placements, w, h };
    }
  }

  if (!best) return null;

  const atlasW = targetW && targetW > 0 ? Math.max(best.w, targetW) : best.w;
  const atlasH = targetH && targetH > 0 ? Math.max(best.h, targetH) : best.h;
  const canvas = document.createElement("canvas");
  canvas.width = atlasW;
  canvas.height = atlasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  for (const p of best.placements) {
    ctx.drawImage(p.canvas, 0, 0, p.w, p.h, p.x, p.y, p.w, p.h);
  }
  const newImg = await loadImageFromCanvas(canvas);
  crops.forEach((crop) => {
    crop.canvas.width = 0;
    crop.canvas.height = 0;
  });
  const backToOrder = best.placements
    .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0))
    .map((p) => {
      const { idx, canvas: _c, ...rest } = p;
      return rest;
    });
  return { img: newImg, boxes: backToOrder };
}
