import { ComponentBox } from "./types";

export class ComponentDetector {
  estimateHasAlpha(imageData: ImageData) {
    const d = imageData.data;
    const N = d.length / 4;
    let count = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 250) {
        count++;
        if (count > N * 0.001) return true;
      }
    }
    return false;
  }

  alphaMask(imageData: ImageData, thr: number) {
    const d = imageData.data;
    const N = d.length / 4;
    const out = new Uint8Array(N);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) out[j] = d[i + 3] > thr ? 1 : 0;
    return out;
  }

  colorKeyMask(imageData: ImageData, bg: { r: number; g: number; b: number }, tol: number) {
    const d = imageData.data;
    const N = d.length / 4;
    const out = new Uint8Array(N);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const dr = Math.abs(d[i] - bg.r),
        dg = Math.abs(d[i + 1] - bg.g),
        db = Math.abs(d[i + 2] - bg.b);
      out[j] = Math.max(dr, dg, db) > tol ? 1 : 0;
    }
    return out;
  }

  sampleBackground(imageData: ImageData) {
    const { data, width: w, height: h } = imageData;
    const pts = [
      [1, 1],
      [w - 2, 1],
      [1, h - 2],
      [w - 2, h - 2]
    ];
    let r = 0,
      g = 0,
      b = 0,
      a = 0,
      n = 0;
    for (const [x, y] of pts) {
      const i = (y * w + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      a += data[i + 3];
      n++;
    }
    return { r: (r / n) | 0, g: (g / n) | 0, b: (b / n) | 0, a: (a / n) | 0 };
  }

  nonBackgroundMask(imageData: ImageData, bg: { r: number; g: number; b: number }, tol: number) {
    const { data } = imageData;
    const N = data.length / 4;
    const out = new Uint8Array(N);
    const t = tol | 0;
    const aThr = 8;
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const a = data[i + 3];
      const isBg = a <= aThr || Math.max(Math.abs(data[i] - bg.r), Math.abs(data[i + 1] - bg.g), Math.abs(data[i + 2] - bg.b)) <= t;
      out[j] = isBg ? 0 : 1;
    }
    return out;
  }

  findComponents(mask: Uint8Array, w: number, h: number): ComponentBox[] {
    const vis = new Uint8Array(w * h);
    const boxes: ComponentBox[] = [];
    const qx = new Int32Array(w * h);
    const qy = new Int32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const id = y * w + x;
        if (mask[id] === 1 && !vis[id]) {
          let head = 0,
            tail = 0;
          let minx = x,
            miny = y,
            maxx = x,
            maxy = y;
          vis[id] = 1;
          qx[tail] = x;
          qy[tail] = y;
          tail++;
          while (head < tail) {
            const cx = qx[head],
              cy = qy[head];
            head++;
            const nb = [
              [cx + 1, cy],
              [cx - 1, cy],
              [cx, cy + 1],
              [cx, cy - 1]
            ];
            for (const [nx, ny] of nb) {
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const idx = ny * w + nx;
              if (mask[idx] === 1 && !vis[idx]) {
                vis[idx] = 1;
                qx[tail] = nx;
                qy[tail] = ny;
                tail++;
                if (nx < minx) minx = nx;
                if (ny < miny) miny = ny;
                if (nx > maxx) maxx = nx;
                if (ny > maxy) maxy = ny;
              }
            }
          }
          boxes.push({ x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 });
        }
      }
    }
    return boxes;
  }
}
