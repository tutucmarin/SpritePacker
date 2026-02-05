import { GridSettings } from "./types";

export class GridCalculator {
  calcCells(settings: GridSettings, imgWidth: number, imgHeight: number) {
    const cols = Math.max(1, settings.cols | 0);
    const rows = Math.max(1, settings.rows | 0);
    const offx = settings.offx | 0;
    const offy = settings.offy | 0;
    const gapx = settings.gapx | 0;
    const gapy = settings.gapy | 0;
    const effW = imgWidth - offx * 2 - gapx * (cols - 1);
    const effH = imgHeight - offy * 2 - gapy * (rows - 1);
    const cellW = Math.max(1, Math.floor(effW / cols));
    const cellH = Math.max(1, Math.floor(effH / rows));
    return { cols, rows, offx, offy, gapx, gapy, cellW, cellH };
  }

  calibrateX(mask: Uint8Array, width: number, height: number, clickX1: number, clickX2: number, currentCols: number) {
    const x1 = Math.min(clickX1, clickX2);
    const x2 = Math.max(clickX1, clickX2);
    const colNonBg = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      let s = 0;
      for (let y = 0; y < height; y++) s += mask[y * width + x];
      colNonBg[x] = s / height;
    }
    const runs = booleanRuns(colNonBg, (v) => v > 0.02, 1).filter((r) => r.start >= x1 && r.end <= x2);
    const cols = runs.length || Math.max(1, currentCols);
    const leftMargin = x1;
    const rightMargin = width - 1 - x2;
    const gapsX: number[] = [];
    for (let i = 0; i < runs.length - 1; i++) gapsX.push(runs[i + 1].start - runs[i].end - 1);
    const gapX = Math.max(0, Math.round(average(gapsX) || 0));
    const offx = Math.max(0, Math.round((leftMargin + rightMargin) / 2));
    return { cols, offx, gapx: gapX };
  }

  calibrateY(mask: Uint8Array, width: number, height: number, clickY1: number, clickY2: number, currentRows: number) {
    const y1 = Math.min(clickY1, clickY2);
    const y2 = Math.max(clickY1, clickY2);
    const rowNonBg = new Float32Array(height);
    for (let y = 0; y < height; y++) {
      let s = 0;
      const off = y * width;
      for (let x = 0; x < width; x++) s += mask[off + x];
      rowNonBg[y] = s / width;
    }
    const runs = booleanRuns(rowNonBg, (v) => v > 0.02, 1).filter((r) => r.start >= y1 && r.end <= y2);
    const rows = runs.length || Math.max(1, currentRows);
    const topMargin = y1;
    const bottomMargin = height - 1 - y2;
    const gapsY: number[] = [];
    for (let i = 0; i < runs.length - 1; i++) gapsY.push(runs[i + 1].start - runs[i].end - 1);
    const gapY = Math.max(0, Math.round(average(gapsY) || 0));
    const offy = Math.max(0, Math.round((topMargin + bottomMargin) / 2));
    return { rows, offy, gapy: gapY };
  }
}

export function average(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export function booleanRuns(arr: ArrayLike<number>, predicate: (v: number) => boolean, minLen: number) {
  const runs: { start: number; end: number }[] = [];
  let inRun = false;
  let start = 0;
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    const v = predicate(arr[i]);
    if (v && !inRun) {
      inRun = true;
      start = i;
    } else if (!v && inRun) {
      const end = i - 1;
      if (end - start + 1 >= minLen) runs.push({ start, end });
      inRun = false;
    }
  }
  if (inRun) {
    const end = n - 1;
    if (end - start + 1 >= minLen) runs.push({ start, end });
  }
  return runs;
}
