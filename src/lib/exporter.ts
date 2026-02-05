import type { ComponentBox, GridSettings } from "./types";
import { applyPattern } from "./naming";

export type MimeInfo = { mime: string; ext: "png" | "jpg" | "webp"; lossy: boolean };

export class Exporter {
  constructor(private download = downloadDataUrl) {}

  exportGrid(params: {
    img: HTMLImageElement | OffscreenCanvas | HTMLCanvasElement;
    settings: GridSettings;
    names: string[];
    mime: MimeInfo;
    quality?: number;
    scale?: number;
  }) {
    const { img, settings, names, mime, quality, scale = 1 } = params;
    const { cols, rows, offx, offy, gapx, gapy } = settings;
    const cellW = Math.floor((img.width - offx * 2 - gapx * (cols - 1)) / cols);
    const cellH = Math.floor((img.height - offy * 2 - gapy * (rows - 1)) / rows);
    const outW = Math.max(1, Math.round(cellW * scale));
    const outH = Math.max(1, Math.round(cellH * scale));
    const tmp = document.createElement("canvas");
    const tctx = tmp.getContext("2d")!;
    tmp.width = outW;
    tmp.height = outH;
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sx = offx + c * (cellW + gapx);
        const sy = offy + r * (cellH + gapy);
        tctx.clearRect(0, 0, outW, outH);
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(img, sx, sy, cellW, cellH, 0, 0, outW, outH);
        const base = names[idx] || String(idx + 1);
        const dataUrl = quality != null ? tmp.toDataURL(mime.mime, quality) : tmp.toDataURL(mime.mime);
        this.download(dataUrl, `${base}.${mime.ext}`);
        idx++;
      }
    }
  }

  exportComponents(params: {
    img: HTMLImageElement | HTMLCanvasElement;
    boxes: ComponentBox[];
    mime: MimeInfo;
    quality?: number;
    names?: string[];
    orderMode?: "row" | "x" | "manual";
    manualOrder?: number[];
    scale?: number;
    namePerRow?: boolean;
  }) {
    const { img, boxes, mime, quality, scale = 1 } = params;
    const tmp = document.createElement("canvas");
    const tctx = tmp.getContext("2d")!;
    boxes.forEach((b, i) => {
      const outW = Math.max(1, Math.round(b.w * scale));
      const outH = Math.max(1, Math.round(b.h * scale));
      tmp.width = outW;
      tmp.height = outH;
      tctx.clearRect(0, 0, outW, outH);
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(img, b.x, b.y, b.w, b.h, 0, 0, outW, outH);
      const base = b.name?.trim() || String(i + 1);
      const dataUrl = quality != null ? tmp.toDataURL(mime.mime, quality) : tmp.toDataURL(mime.mime);
      this.download(dataUrl, `${base}.${mime.ext}`);
    });
  }
}

export function currentMimeAndExt(fmt: string): MimeInfo {
  const f = (fmt || "png").toLowerCase();
  if (f === "jpeg") return { mime: "image/jpeg", ext: "jpg", lossy: true };
  if (f === "webp") return { mime: "image/webp", ext: "webp", lossy: true };
  return { mime: "image/png", ext: "png", lossy: false };
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
