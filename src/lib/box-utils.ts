import type { ComponentBox } from "./types";

export function overlaps(a: ComponentBox, b: ComponentBox) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

export function filterNonOverlapping(boxes: ComponentBox[]) {
  const kept: ComponentBox[] = [];
  for (const b of boxes) {
    if (kept.some((k) => overlaps(k, b))) continue;
    kept.push(b);
  }
  return kept;
}

export function orderBoxes(boxes: ComponentBox[]) {
  const arr = boxes.map((b) => ({ ...b }));
  const temp = arr.map((b) => ({ ...b, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }));
  temp.sort((a, b) => a.cy - b.cy);
  const hs = temp.map((t) => t.h).sort((a, b) => a - b);
  const medianH = hs.length ? hs[Math.floor(hs.length / 2)] : 0;
  const tol = Math.max(2, Math.round(medianH * 0.6));
  const rows: (typeof temp)[] = [];
  let current: typeof temp = [];
  let refCy: number | null = null;
  for (const t of temp) {
    if (refCy == null || Math.abs(t.cy - refCy) <= tol) {
      current.push(t);
      refCy =
        refCy == null
          ? t.cy
          : (refCy * (current.length - 1) + t.cy) / current.length;
    } else {
      rows.push(current);
      current = [t];
      refCy = t.cy;
    }
  }
  if (current.length) rows.push(current);
  rows.sort((ra, rb) => {
    const ya = ra.reduce((s, v) => s + v.cy, 0) / ra.length;
    const yb = rb.reduce((s, v) => s + v.cy, 0) / rb.length;
    return ya - yb;
  });
  const ordered: ComponentBox[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.cx - b.cx);
    for (const t of row) {
      const orig = arr.find((b) => b.id === t.id) || t;
      ordered.push(orig);
    }
  }
  return ordered;
}
