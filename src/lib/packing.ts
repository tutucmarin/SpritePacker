import type { ComponentBox } from "./types";

type PackerMode = "default" | "optimal" | "maxrect";

export async function repackSprites(
  mode: PackerMode,
  originalImg: HTMLImageElement | null,
  originalBoxes: ComponentBox[],
  spacing = 0,
  targetW?: number | null,
  targetH?: number | null,
): Promise<{ img: HTMLImageElement; boxes: ComponentBox[] } | null> {
  if (!originalImg || !originalBoxes.length) return null;
  if (mode === "default") {
    return { img: originalImg, boxes: originalBoxes };
  }

  const crops = originalBoxes.map((b, idx) => {
    const c = document.createElement("canvas");
    c.width = b.w;
    c.height = b.h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(originalImg, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    return { ...b, idx, canvas: c };
  });

  crops.sort((a, b) => {
    if (mode === "optimal") return b.h - a.h || b.w - a.w;
    const areaA = a.w * a.h;
    const areaB = b.w * b.h;
    return areaB - areaA;
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
  const backToOrder = best.placements
    .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0))
    .map((p) => {
      const { idx, canvas: _c, ...rest } = p;
      return rest;
    });
  return { img: newImg, boxes: backToOrder };
}

function loadImageFromCanvas(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = canvas.toDataURL("image/png");
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}
